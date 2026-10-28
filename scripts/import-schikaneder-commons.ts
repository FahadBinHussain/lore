// Wikimedia Commons importer: Jakub Schikaneder -> artworks + artwork_external_ids.
// Second consumer of AGENTS "Artwork multi-source backing" (after simonstalenhag.se).
// Matching rule: exact normalized title+year (±1 year tolerance — deliberate, documented
// in AGENTS) first, then transient dHash; ambiguous/near results are held and reported
// loudly, never guessed. Downloads images only transiently for hashing (C:\tmp) and
// stores URLs — refs-only rule holds. The artist's existing wikiart rows are the only
// match targets.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs <mode>`
// Modes: scrape | urls | hash | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { eq, and, sql } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const WD_API = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';
const WIKI_QID = 'Q1376646'; // Jakub Schikaneder — asserted against its label in scrape
const ROOT_CATEGORY = 'Category:Jakub Schikaneder';
const SEARCH_TERM = 'Schikaneder';
const UA = 'LoreMediaTracker/1.0 (commons artwork import; local agent)';
const SCRAPE = 'C:/tmp/schikaneder-scrape.json';
const META_CACHE = 'C:/tmp/schikaneder-meta-cache.json'; // incremental — a 429 mid-run keeps completed batches
const HASH_IN = 'C:/tmp/schikaneder-hash-input.json';
const HASH_OUT = 'C:/tmp/schikaneder-hashes.json';
const HASH_CACHE = 'C:/tmp/schikaneder-hash-cache'; // local image cache for dHash (scratch, gitignored)
const HASH_JOBS = 'C:/tmp/schikaneder-hash-jobs.json'; // {key,path} - local files for the PS1
const HASH_JOBS_OUT = 'C:/tmp/schikaneder-hash-jobs-out.json';
const REPORT = 'C:/tmp/schikaneder-import-report.md';
const HASH_PS1 = 'scripts/import-schikaneder-hash.ps1';

const ARTIST_SLUG = 'jakub-schikaneder';
const PROVIDER = 'commons';
const THUMB_WIDTH = 1200;

// dHash decision bands — same shape as the Stålenhag importer (its measured wiki-wiki
// unrelated floor was 13 on the 2026-09-28 run). This corpus gets its own floor check in
// `import` (min pairwise distance across the wikiart rows) and the apply run aborts loudly
// if two DIFFERENT wikiart works sit at <= MATCH_MAX, because that would prove the bands
// unsafe for these scans.
const MATCH_MAX = 8;
const NEAR_MAX = 12;
const TITLE_CONFLICT_MAX = 20; // title match whose hash distance exceeds this is held as a conflict

// Deliberate deviation from the Stålenhag Stage A (strict year equality): painting dates
// are routinely disputed by a year between museum/wikidata and wikiart (e.g. By the Girl's
// Bed: wikidata 1909 vs wikiart 1910). Exact title + |dyear| <= 1 stays a strong match
// candidate; the hash cross-check still holds it when the visuals disagree.
const TITLE_YEAR_TOLERANCE = 1;

// Creation-year sanity window for this artist (active ~1878-1918, died 1924). Anything
// outside is treated as digitization/upload metadata and dropped from year resolution.
const YEAR_MIN = 1850;
const YEAR_MAX = 1935;

// Resolutions from the 2026-10-15 image-verdict batch (direct side-by-side compare of the
// transient downloads). A verdict only ever rewrites a HELD decision — a confident
// title/hash link is left alone so a future better match is never overridden. Each entry
// names the exact Commons file (from the scrape JSON) and links it onto an existing row.
const isHeld = (d: Decision): boolean =>
  d.type === 'ambiguous-title' || d.type === 'ambiguous-hash' || d.type === 'near' || d.type === 'dup-target' || d.type === 'hold-nohash';
// held commons file -> existing wikiart artwork id it was verified to be the same painting as
const VERDICT_LINK: Record<string, { wikiId: number; dist: number | null; why: string }> = {
  'Jakub Schikaneder - Truchlivy navrat (1886-7).jpg': {
    wikiId: 171233,
    dist: null,
    why:
      'direct image verdict 2026-10-15: same painting as The Sad Way (white-haired figure in a dark cart, horse at right, pale-shirted figure walking behind on a rutted track, frozen water + bare trees, same "63cm" ruler) — different-resolution crop of the same scan; the dist-21 hash was a crop artifact, not a second work',
  },
  'Jakub Schikaneder - Symbolicky vyjev (1895-7).jpg': {
    wikiId: 171232,
    dist: 0,
    why:
      'direct image verdict 2026-10-15: same painting as Symbolic Composition O 14683 (lit doorway with dark standing figure, pale descending steps, leaning figure at left railing, orange autumn bush at right) — warmer/lighter scan of the same work; the hash-only second claim was a duplicate file, not a distinct work',
  },
};

// Known non-artwork files inside the category tree / search hits. Per file with its own
// reason (HASH_EXCLUDE pattern) — extend per file, never a silent pattern match.
// Reviewed against the full scrape output (571 candidates) on 2026-10-08. Keys are the
// exact Commons filenames — copy them from the scrape JSON (the grave key silently never
// matched before because `malíř`/`Hřbitov` lost their carons when typed).
const SCRAPE_EXCLUDE: Record<string, string> = {
  'Jakob Schikaneder 01.jpg': 'portrait photograph of the artist, not a painting',
  'Hrob-Schikaneder Jakub-malíř, Hřbitov Vinohrady 28.jpg': "photograph of the artist's grave, not a painting",
  'Jakub Schikaneder - signatura.jpg': 'photograph of the artist’s signature detail, not a painting',
  'Jakub Schikaneder 1887 Mukarovsky.png': 'credited to Josef Mukařovík (1851-1921) — a work/portrait by another artist, not by Jakub Schikaneder',
  'Rodin & Schikaneder.jpg': '2023 photograph in the artist category (DateTimeOriginal 2023-11-10), not a painting',
  'Jakub Schikaneder, Murder in the house, detail.jpg': 'detail crop of Murder in the House — a crop can only dHash its parent plate at 9-12 (permanent hold; Stålenhag crop rule)',
};

// Safety caps on the category walk: the artist category must stay artist-scoped. A broader
// category sneaking in as a subcat would balloon the file count — fail loudly instead.
const MAX_CATEGORY_FILES = 1500;
const MAX_CATEGORY_PAGES = 80;

// Loose shapes for the three APIs (Commons action API, Wikidata entity API, WDQS SPARQL).
// Typed field-by-field so the script typechecks under strict mode without `any`.
type ImageInfo = {
  url?: string;
  descriptionurl?: string;
  thumburl?: string;
  width?: number;
  extmetadata?: Record<string, { value?: string }>;
};
type PageInfo = { title: string; imageinfo?: ImageInfo[] };
type ApiJson = {
  query?: {
    categorymembers?: { ns: number; title: string }[];
    search?: { title: string }[];
    pages?: PageInfo[];
  };
  continue?: { cmcontinue?: string; sroffset?: string };
  entities?: Record<string, { labels?: Record<string, { value: string }> }>;
  results?: { bindings?: Record<string, { value: string }>[] };
  error?: { code?: string; info?: string };
};

type CommonsItem = {
  file: string; // filename without the File: prefix (stable external-id key)
  src: string; // = file
  url: string; // thumburl (hash + imageUrl), falls back to the original url
  original: string;
  page: string; // descriptionurl (sourceUrl / paintingUrl)
  objectName: string | null;
  wikidataTitle: string | null;
  year: number | null;
  yearSource: 'filename' | 'wikidata' | 'extmetadata' | null;
  credit: string | null;
  license: string | null;
  title: string;
  titleSource: 'objectname' | 'filename' | 'wikidata';
  signals: string[]; // wikidata | category | filename | artist-credit
  exclude?: string;
};
type WikiWork = {
  id: number;
  title: string;
  year: number | null;
  imageUrl: string | null;
  paintingUrl: string | null;
  externalId: string;
};
type Decision =
  | { type: 'title'; wikiId: number; confidence: 100 }
  | { type: 'hash'; wikiId: number; dist: number; confidence: 90 }
  | { type: 'ambiguous-title'; cands: { id: number; file: string }[]; conflictDist?: number }
  | { type: 'ambiguous-hash'; cands: { file: string; dist: number }[] }
  | { type: 'near'; best: { id: number; dist: number }; second: { id: number; dist: number } | null }
  | { type: 'dup-target'; wikiId: number; dist: number }
  | { type: 'commons-same'; of: string } // same artwork as another commons file (title+year+hash agree)
  | { type: 'hold-nohash' }
  | { type: 'new' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(base: string, params: Record<string, string>): Promise<ApiJson> {
  const url = `${base}?${new URLSearchParams(params).toString()}`;
  let lastErr = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) {
        const body = (await res.json()) as ApiJson;
        if ('error' in body && body.error) {
          throw new Error(`API error ${body.error.code}: ${body.error.info} — no fallback, aborting`);
        }
        return body;
      }
      lastErr = `status=${res.status}`;
      if (res.status !== 429 && res.status < 500) throw new Error(`request FAILED url=${url} ${lastErr} — no fallback, aborting`);
      // Wikimedia's 429 throttle lasts longer than a network blip — back off harder for it.
      await sleep(Math.min(30000, res.status === 429 ? 4000 * attempt : 1500 * attempt));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/no fallback/.test(msg)) throw e;
      lastErr = `network:${msg}`;
      await sleep(1500 * attempt);
    }
    console.log(`retry attempt=${attempt} ${lastErr}`);
  }
  throw new Error(`request FAILED url=${url} ${lastErr} after 8 attempts — no fallback, aborting`);
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s
    // hidden QuickStatements divs (`label QS:Lcs,"..."`, `date QS:P571,...`) are structured
    // junk, not content — drop them wholesale before any other text extraction
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return t || null;
}

// ObjectName on these files is either plain text or Commons' language-template HTML whose
// visible titles sit in <i> elements (English bold lang="en", Czech lang="cs"). Prefer the
// English <i> (wikiart's own titles are a cs/en mix; the hash stage is the backstop either
// way), else the first <i>, else the tag-stripped text. Then strip known structural junk —
// language-tag prefix, artist-name prefix, museum inventory suffix, medium/collection tail,
// trailing date parens. Removals only; never invent a title.
function cleanObjectName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const en = /lang="en"[^>]*><i>([\s\S]*?)<\/i>/.exec(raw);
  const hit = en ?? /<i>([\s\S]*?)<\/i>/.exec(raw);
  let s = hit ? hit[1] : (stripHtml(raw) ?? '');
  s = s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return junkStrip(s);
}

// Removals only, never invent a title. Applied to BOTH the ObjectName text and the
// filename-stem fallback — file names carry the same artist-prefix/medium/year junk
// ('Schikaneder Jakub - Park', 'Utonulá (1893), pastel na kartonu...', 'Ruch 1883').
function junkStrip(s0: string): string | null {
  let s = s0;
  if (!s) return null;
  s = s.replace(/^(Czech|German|English|Polish|French|Slovak):\s*/i, '');
  // NB: hyphen escaped inside the classes — unescaped between ',' and '–' it forms a
  // U+002C–U+2013 range that matches every letter and eats the whole title.
  s = s.replace(/^(Jakub|Jakob)\s*,?\s+Schikaneder[\s,\-–—]*/i, '');
  s = s.replace(/^Schikaneder\s+(Jakub|Jakob)[\s,\-–—]*/i, '');
  s = s.replace(/^Schikaneder[\s,\-–—]*/i, '');
  s = s.replace(/\s+(?:CZE\s+)?(?:NG\.[KO]|NG|O|DO)\s*\d{3,6}$/, '');
  const medIdx = s.search(/,\s+(?:olej|pl[áa]tno|pastel|kartonu|akvarel|akryl|tempera|kusovna|d[řr]evo|lepenka|canvas|oil on)\b/i);
  if (medIdx !== -1) s = s.slice(0, medIdx);
  // medium described inside trailing parens: '(pastel na papíře)', '(uhel, lavírovaná...)'
  s = s.replace(/\s*\((?:pastel|uhel|olej|akvarel|kresba|lavírovan\w*|tu[šs]|kvas|karton\w*)[^)]*\)$/i, '');
  s = s.replace(/\s*\(po roce \d{4}\)\s*$/i, '');
  s = s.replace(/\s*\((?:18|19)\d{2}(?:\s*[-–]\s*\d{1,4})?\)\s*$/, '');
  s = s.replace(/,\s*(?:18|19)\d{2}\s+(?:18|19)\d{2}\s*$/, '');
  s = s.replace(/\s*,?\s+by\s+(Jakub|Jakob)\s+Schikaneder\s*$/i, '');
  s = s.replace(/\s+(?:18|19)\d{2}$/, ''); // 'Ruch 1883' -> 'Ruch' (wikiart carries no years in titles)
  s = s.replace(/\s+[-–—,]\s*$/, '').trim();
  return s || null;
}

function normTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Hashes are 64-char binary strings ('0'/'1'), not hex — compare every bit.
function hammingBits(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) d += 1;
  return d + Math.abs(a.length - b.length);
}

function rangeYear(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return raw >= YEAR_MIN && raw <= YEAR_MAX ? raw : null;
}

function firstYearIn(s: string): number | null {
  // a year RANGE denotes the painting's window — take its END (filename `(1900-10)` is
  // wikiart's 1910, `(1886-90)` is 1890); a single/fallback 4-digit keeps the first
  const range = /(\d{4})\s*[-–]\s*(\d{2,4})/.exec(s);
  if (range) {
    const start = Number(range[1]);
    let end = Number(range[2]);
    if (range[2].length <= 3) end = Math.floor(start / 100) * 100 + end;
    const yr = rangeYear(end) ?? rangeYear(start);
    if (yr != null) return yr;
  }
  const m = /(\d{4})/.exec(s);
  return m ? rangeYear(Number(m[1])) : null;
}

// Mechanical filename parsing (identifier, not invention): strip the artist-name prefix,
// known museum/GAP suffixes, extension; underscores become spaces. Kept verbatim otherwise.
function stemFromFilename(file: string): string | null {
  let stem = file.replace(/\.[A-Za-z]+$/, '').replace(/_/g, ' ').trim();
  const leadingYear = /^\d{4}\s+/.exec(stem);
  if (leadingYear) stem = stem.slice(leadingYear[0].length);
  stem = stem.replace(/^(Jakub|Jakob)\s+Schikaneder\s*[-–—,:]?\s*/i, '');
  stem = stem.replace(/^Schikaneder\s*[-–—,]\s*/i, '');
  stem = stem.replace(/\s*-\s*Google Art Project$/i, '');
  stem = stem.replace(/\s*[-–—]\s*(?:O|DO)\s*\d{3,6}\s*[-–—]\s*National Gallery Prague$/i, '');
  stem = stem.replace(/\s*[-–—]\s*National Gallery Prague$/i, '');
  stem = stem.replace(/\s*[-–—]\s*Nationalgalerie Prag(?: anagoria)?$/i, '');
  stem = stem.replace(/\s*\(\d{4}\)\s*$/, '');
  stem = stem.replace(/\s*[-–—]\s*anagoria$/i, '');
  stem = stem.trim().replace(/^[-–—,\s]+|[-–—,\s]+$/g, '');
  return stem.length > 0 ? stem : null;
}

async function collectCategoryFiles(): Promise<{ files: Set<string>; cats: number }> {
  const queue: string[] = [ROOT_CATEGORY];
  const seen = new Set<string>();
  const files = new Set<string>();
  while (queue.length > 0) {
    const cat = queue.shift()!;
    if (seen.has(cat)) continue;
    seen.add(cat);
    if (seen.size > MAX_CATEGORY_PAGES) {
      throw new Error(`category walk hit ${MAX_CATEGORY_PAGES} pages — the tree is broader than an artist category should be, refusing to crawl blind`);
    }
    let cont: string | undefined;
    do {
      const params: Record<string, string> = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: cat,
        cmlimit: '500',
        cmtype: 'file|subcat',
        format: 'json',
        formatversion: '2',
      };
      if (cont) params.cmcontinue = cont;
      const j = await api(API, params);
      for (const m of j.query?.categorymembers ?? []) {
        if (m.ns === 6) files.add(m.title);
        else if (m.ns === 14) queue.push(m.title);
      }
      cont = j.continue?.cmcontinue;
      await sleep(250);
    } while (cont);
    if (files.size > MAX_CATEGORY_FILES) {
      throw new Error(`category walk exceeded ${MAX_CATEGORY_FILES} files — refusing to crawl blind`);
    }
  }
  return { files, cats: seen.size };
}

async function collectSearchFiles(): Promise<Set<string>> {
  const files = new Set<string>();
  let cont: string | undefined;
  do {
    const params: Record<string, string> = {
      action: 'query',
      list: 'search',
      srsearch: SEARCH_TERM,
      srnamespace: '6',
      srlimit: '500',
      format: 'json',
      formatversion: '2',
    };
    if (cont) params.sroffset = cont;
    const j = await api(API, params);
    for (const h of j.query?.search ?? []) files.add(h.title);
    cont = j.continue?.sroffset;
    await sleep(300);
  } while (cont);
  return files;
}

type WdWork = { title: string | null; year: number | null };
async function collectWikidata(): Promise<Map<string, WdWork>> {
  // Assert the Q-id still resolves to this artist before trusting anything it says.
  const ent = await api(WD_API, { action: 'wbgetentities', ids: WIKI_QID, props: 'labels', languages: 'en', format: 'json' });
  const label = ent.entities?.[WIKI_QID]?.labels?.en?.value;
  if (label !== 'Jakub Schikaneder') throw new Error(`wikidata ${WIKI_QID} label is "${label}", expected "Jakub Schikaneder" — no fallback, aborting`);

  const query = `SELECT ?work ?workLabel ?img ?date WHERE {
    ?work wdt:P170 wd:${WIKI_QID}; wdt:P18 ?img.
    OPTIONAL { ?work wdt:P571 ?date. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. }
  } LIMIT 500`;
  const j = await api(SPARQL, { query, format: 'json' });
  const bindings = j.results?.bindings ?? [];
  if (bindings.length === 0) throw new Error('wikidata SPARQL returned 0 P18 image works for Q1376646 — expected ~17, no fallback, aborting');
  const byFile = new Map<string, WdWork>();
  for (const b of bindings) {
    const img = b.img?.value ?? '';
    const marker = 'Special:FilePath/';
    const idx = img.indexOf(marker);
    if (idx === -1) continue;
    const file = decodeURIComponent(img.slice(idx + marker.length));
    const labelV = b.workLabel?.value ?? '';
    const wdTitle = /^Q\d+$/.test(labelV) ? null : labelV || null; // bare Q-id = entity has no English label
    const dateV = b.date?.value ?? '';
    const year = dateV ? rangeYear(Number(dateV.slice(0, 4))) : null;
    byFile.set(file, { title: wdTitle, year });
  }
  if (byFile.size === 0) throw new Error('wikidata SPARQL results yielded no parsable File: links — no fallback, aborting');
  return byFile;
}

async function fetchMetadata(titles: string[]): Promise<Map<string, PageInfo>> {
  const cache: Record<string, PageInfo> = existsSync(META_CACHE) ? (JSON.parse(readFileSync(META_CACHE, 'utf8')) as Record<string, PageInfo>) : {};
  const missing = titles.filter((t) => !cache[t]);
  console.log(`metadata: ${titles.length - missing.length} cached, ${missing.length} to fetch`);
  for (let i = 0; i < missing.length; i += 20) {
    const batch = missing.slice(i, i + 20);
    const params: Record<string, string> = {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      titles: batch.join('|'),
      format: 'json',
      formatversion: '2',
    };
    const j = await api(API, params);
    for (const p of j.query?.pages ?? []) cache[p.title] = p;
    // save after every batch — a 429 abort must not lose completed fetches
    writeFileSync(META_CACHE, JSON.stringify(cache), 'utf8');
    console.log(`metadata ${Math.min(i + 20, missing.length)}/${missing.length}`);
    await sleep(600);
  }
  const out = new Map<string, PageInfo>();
  for (const t of titles) {
    const hit = cache[t];
    if (hit) out.set(t, hit);
  }
  const stillMissing = titles.filter((t) => !out.has(t));
  if (stillMissing.length > 0) throw new Error(`metadata missing for ${stillMissing.length} file(s) after fetch (e.g. ${stillMissing[0]}) — no fallback, aborting`);
  return out;
}

async function scrape(): Promise<void> {
  console.log('[1/5] asserting wikidata identity + collecting P18 works...');
  const wd = await collectWikidata();
  console.log(`  wikidata image works: ${wd.size}`);

  console.log('[2/5] walking the Commons category tree...');
  const { files: catFiles, cats } = await collectCategoryFiles();
  console.log(`  ${catFiles.size} files across ${cats} categories`);

  console.log('[3/5] namespace-6 search backstop...');
  const searchFiles = await collectSearchFiles();
  console.log(`  ${searchFiles.size} search hits`);

  const all = new Set<string>([...catFiles, ...searchFiles]);
  console.log(`[4/5] union: ${all.size} candidate files — fetching metadata...`);
  const titles = [...all];
  const meta = await fetchMetadata(titles);

  console.log('[5/5] building items...');
  const items: CommonsItem[] = [];
  const dropped: string[] = [];
  for (const fileTitle of titles) {
    const file = fileTitle.replace(/^File:/, '');
    const page = meta.get(fileTitle);
    if (!page || !Array.isArray(page.imageinfo) || page.imageinfo.length === 0) {
      dropped.push(`${file} — no imageinfo (not a regular image)`);
      continue;
    }
    const ii = page.imageinfo[0];
    const ext = ii.extmetadata ?? {};
    const objectName = cleanObjectName(ext.ObjectName?.value);
    const credit = stripHtml(ext.Artist?.value);
    const license = stripHtml(ext.LicenseShortName?.value);
    const extDate = stripHtml(ext.DateTimeOriginal?.value);
    const wdHit = wd.get(file);

    // Attribution must name Jakub/Jakob, not the bare surname: "Schikaneder" on Commons is
    // dominated by Emanuel Schikaneder (Mozart's librettist) — opera scans, memorial plaques
    // and libretto PDFs flooded the search backstop (241 of 306 kept files before this
    // required the given name; verified none were Jakub works).
    const signals: string[] = [];
    if (wdHit) signals.push('wikidata');
    if (catFiles.has(fileTitle)) signals.push('category');
    if (/schikaneder/i.test(file) && /\b(Jakub|Jakob)\b/i.test(file)) signals.push('filename');
    if (credit && /schikaneder/i.test(credit) && /\b(Jakub|Jakob)\b/i.test(credit)) signals.push('artist-credit');

    const extYear = firstYearIn(extDate ?? '');
    const fileNameYear = firstYearIn(file);
    let year: number | null = null;
    let yearSource: CommonsItem['yearSource'] = null;
    if (fileNameYear != null) {
      year = fileNameYear;
      yearSource = 'filename';
    } else if (wdHit?.year != null) {
      year = wdHit.year;
      yearSource = 'wikidata';
    } else if (extYear != null) {
      year = extYear;
      yearSource = 'extmetadata';
    }

    const stem = stemFromFilename(file);
    let title: string | null = objectName;
    let titleSource: CommonsItem['titleSource'] | null = objectName ? 'objectname' : null;
    if (!title && stem) {
      title = junkStrip(stem) ?? stem;
      titleSource = 'filename';
    }
    if (title && normTitle(title) === 'schikaneder') {
      // filename is just the artist's name (e.g. Schikaneder.jpg) — fall through to wikidata
      title = null;
      titleSource = null;
    }
    if (!title && wdHit?.title) {
      title = wdHit.title;
      titleSource = 'wikidata';
    }

    let exclude: string | undefined = SCRAPE_EXCLUDE[file];
    if (!exclude && signals.length === 0) {
      const bareMention = /schikaneder/i.test(file) || (credit != null && /schikaneder/i.test(credit));
      exclude = bareMention
        ? 'Schikaneder mentioned but no Jakub/Jakob attribution (Emanuel Schikaneder / Mozart-era material)'
        : 'no attribution signal (Schikaneder only mentioned on the file page)';
    }
    if (!exclude && !title) exclude = 'no parseable title (no ObjectName, filename is not a title, no wikidata label)';

    items.push({
      file,
      src: file,
      url: ii.thumburl || ii.url || '',
      original: ii.url || '',
      page: ii.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
      objectName,
      wikidataTitle: wdHit?.title ?? null,
      year,
      yearSource,
      credit,
      license,
      title: title ?? '',
      titleSource: titleSource ?? 'filename',
      signals,
      ...(exclude ? { exclude } : {}),
    });
  }
  items.sort((a, b) => a.file.localeCompare(b.file));

  writeFileSync(SCRAPE, JSON.stringify(items, null, 2), 'utf8');
  const kept = items.filter((i) => !i.exclude);
  const counts: Record<string, number> = {};
  for (const i of kept) for (const s of i.signals) counts[s] = (counts[s] ?? 0) + 1;
  console.log(`SCRAPE done: ${items.length} candidates -> ${kept.length} kept, ${items.length - kept.length} excluded, ${dropped.length} non-images`);
  console.log(`  signals: ${Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ')}`);
  for (const d of dropped) console.log(`  DROPPED ${d}`);
  for (const i of items.filter((x) => x.exclude)) console.log(`  EXCLUDED ${i.file} — ${i.exclude}`);
  console.log(`-> ${SCRAPE}`);
}

function loadItems(): CommonsItem[] {
  return JSON.parse(readFileSync(SCRAPE, 'utf8')) as CommonsItem[];
}
function partitionExcluded(items: CommonsItem[]): { kept: CommonsItem[]; excluded: CommonsItem[] } {
  const excluded = items.filter((i) => i.exclude);
  const kept = items.filter((i) => !i.exclude);
  for (const i of excluded) console.log(`SCRAPE-EXCLUDED ${i.file} — ${i.exclude}`);
  if (excluded.length) console.log(`SCRAPE-EXCLUDED ${excluded.length} file(s), ${kept.length} kept`);
  return { kept, excluded };
}

async function loadArtistAndWiki(): Promise<{ artistRow: { id: number }; wiki: WikiWork[] }> {
  const [artistRow] = await db.select({ id: artists.id }).from(artists).where(and(eq(artists.provider, 'wikiart'), eq(artists.slug, ARTIST_SLUG)));
  if (!artistRow) throw new Error(`artist ${ARTIST_SLUG} not found — no fallback`);
  const wiki = (await db
    .select({
      id: artworks.id,
      title: artworks.title,
      year: artworks.year,
      imageUrl: artworks.imageUrl,
      paintingUrl: artworks.paintingUrl,
      externalId: artworks.externalId,
    })
    .from(artworks)
    .where(and(eq(artworks.artistId, artistRow.id), eq(artworks.provider, 'wikiart')))) as WikiWork[];
  if (wiki.length === 0) throw new Error('artist has zero wikiart rows — refusing to match against an empty set');
  return { artistRow, wiki };
}

async function urls(): Promise<void> {
  const { wiki } = await loadArtistAndWiki();
  const { kept: items } = partitionExcluded(loadItems());
  const commonsEntries = items.map((i) => ({ key: `c:${i.src}`, url: i.url }));
  // The API only serves a thumburl while the original is wider than THUMB_WIDTH; narrower
  // files keep their upload.wikimedia.org original URL — and that host 429s this IP (600s
  // ban window, verified 2026-10-08) while thumb.wikimedia.org serves fine. Re-request a
  // smaller thumb width for exactly those files; dHash only needs 9x8 pixels anyway.
  const byKey = new Map(commonsEntries.map((e) => [e.key, e]));
  const plain = items.filter((i) => i.url.startsWith('https://upload.wikimedia.org/'));
  if (plain.length > 0) {
    // widths first, then a deterministic thumb URL per file. Direct thumb requests are
    // rejected outside Wikimedia's standard bucket sizes (400 "Use thumbnail sizes listed
    // on https://w.wiki/GHai", policy since 2025/2026) — pick the largest bucket strictly
    // below the original width (MediaWiki refuses to upscale tiny scans).
    const THUMB_BUCKETS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];
    const sizes = new Map<string, number>();
    for (let i = 0; i < plain.length; i += 20) {
      const batch = plain.slice(i, i + 20);
      const params: Record<string, string> = {
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url|size',
        titles: batch.map((it) => `File:${it.src}`).join('|'),
        format: 'json',
        formatversion: '2',
      };
      const j = await api(API, params);
      for (const p of j.query?.pages ?? []) {
        const w = p.imageinfo?.[0]?.width;
        if (w != null) sizes.set(p.title.replace(/^File:/, ''), w);
      }
      await sleep(400);
    }
    const noThumb: string[] = [];
    for (const it of plain) {
      const entry = byKey.get(`c:${it.src}`);
      const w = sizes.get(it.src);
      const orig = (entry?.url ?? it.url).split('?')[0];
      const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2})\/(.+)$/.exec(orig);
      const target = w == null ? undefined : [...THUMB_BUCKETS].reverse().find((b) => b < w);
      if (!entry || !target || !m) {
        noThumb.push(it.src);
        continue;
      }
      const rendered = m[2].toLowerCase().endsWith('.svg') ? `${m[2]}.png` : m[2]; // svg thumbs render as png
      entry.url = `https://thumb.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${target}px-${rendered}`;
    }
    console.log(`urls: ${plain.length - noThumb.length}/${plain.length} original-host entries rewritten to thumb URLs`);
    if (noThumb.length > 0) {
      throw new Error(`no thumb-host URL for ${noThumb.length} file(s) (original below smallest bucket 20px / unparsable URL): ${noThumb.join(' | ')} - no fallback`);
    }
  }
  const input = [
    ...wiki.map((w) => ({ key: `w:${w.id}`, url: w.imageUrl })),
    ...commonsEntries,
  ].filter((e) => !!e.url);
  writeFileSync(HASH_IN, JSON.stringify(input, null, 2), 'utf8');
  const noUrl = wiki.filter((w) => !w.imageUrl).length + items.filter((i) => !i.url).length;
  console.log(`URLS done: wikiart=${wiki.length} commons=${items.length} (no url: ${noUrl}) to hash -> ${HASH_IN}`);
}

// TS owns the network half of hashing: PowerShell's WebClient trips Wikimedia's
// bot-traffic 429 on thumb.wikimedia.org while the identical URL succeeds from node
// fetch (verified 2026-10-08), so images download here (with backoff) into a local
// cache and the PS1 helper only reads local files. null in HASH_OUT = caller holds.
async function hash(): Promise<void> {
  const input = JSON.parse(readFileSync(HASH_IN, 'utf8')) as { key: string; url: string }[];
  const out: Record<string, string | null> = existsSync(HASH_OUT)
    ? (JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>)
    : {};
  const missing = input.filter((e) => !out[e.key]);
  mkdirSync(HASH_CACHE, { recursive: true });
  const jobs: { key: string; path: string }[] = [];
  const failedDl: string[] = [];
  let dl = 0;
  for (const e of missing) {
    const path = join(HASH_CACHE, `${createHash('sha1').update(e.key).digest('hex').slice(0, 20)}.img`);
    if (!existsSync(path)) {
      let lastErr = 'not attempted';
      let done = false;
      for (const wait of [0, 15000, 45000, 90000]) {
        if (wait) {
          console.log(`  backoff ${wait / 1000}s (${lastErr}) for ${e.key}`);
          await sleep(wait);
        }
        try {
          const res = await fetch(e.url, { headers: { 'User-Agent': UA } });
          if (!res.ok) {
            lastErr = `HTTP ${res.status}`;
            if (res.status === 429 || res.status >= 500) continue;
            break; // non-retryable status -> recorded as failed below
          }
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 100) {
            lastErr = `tiny body (${buf.length}B)`;
            continue;
          }
          writeFileSync(path, buf);
          done = true;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err); // network layer -> retry
        }
      }
      if (!done) {
        // attempt every remaining URL rather than aborting on the first throttle - a ban
        // window makes progress only if cached successes survive the run (fail loud at the end)
        console.error(`  download FAILED ${e.key}: ${lastErr}`);
        failedDl.push(e.key);
        continue;
      }
    }
    jobs.push({ key: e.key, path });
    console.log(`  dl ${++dl}/${missing.length}: ${e.key}`);
    if (dl < missing.length) await sleep(3000); // paced - thumb.wikimedia.org 429s on bursts
  }
  if (jobs.length > 0) {
    writeFileSync(HASH_JOBS, JSON.stringify(jobs, null, 2));
    const res = spawnSync('pwsh', ['-NoProfile', '-File', HASH_PS1], { encoding: 'utf8', cwd: process.cwd() });
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    if (res.status !== 0) throw new Error(`hash script FAILED status=${res.status} - no fallback`);
    if (!existsSync(HASH_JOBS_OUT)) throw new Error(`hash jobs output missing ${HASH_JOBS_OUT} - no fallback`);
    Object.assign(out, JSON.parse(readFileSync(HASH_JOBS_OUT, 'utf8')) as Record<string, string | null>);
    writeFileSync(HASH_OUT, JSON.stringify(out, null, 2));
  }
  const failed = input.filter((e) => !out[e.key]).map((e) => e.key);
  for (const k of failed) console.error(`HASH-FAILED ${k}`);
  console.log(`HASH done: total=${input.length} failed=${failed.length}`);
  if (failedDl.length > 0) {
    throw new Error(`image downloads FAILED for ${failedDl.length}/${missing.length} file(s) - throttle/URL error above; completed hashes persisted, re-run after cooldown - no fallback`);
  }
}

function yearsCompat(a: number | null, b: number | null): boolean {
  return a == null || b == null || Math.abs(a - b) <= TITLE_YEAR_TOLERANCE;
}

async function runImport(apply: boolean): Promise<void> {
  const { kept: items, excluded: excludedItems } = partitionExcluded(loadItems());
  const hashes = JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>;
  const { artistRow, wiki } = await loadArtistAndWiki();
  const wikiHash = new Map<number, string>();
  const wikiClaimed = new Set<number>();
  const wikiById = new Map(wiki.map((w) => [w.id, w]));
  for (const w of wiki) {
    const h = hashes[`w:${w.id}`];
    if (h) wikiHash.set(w.id, h);
  }
  const execRes = await db.execute(sql`SELECT external_id, artwork_id FROM artwork_external_ids WHERE provider = 'commons'`);
  const execRows = (Array.isArray(execRes) ? execRes : ((execRes as unknown as { rows?: unknown[] }).rows ?? [])) as {
    external_id: string;
    artwork_id: number;
  }[];
  const already = new Set(execRows.map((r) => r.external_id));
  // Re-run safety (same fix as the Stålenhag importer 2026-10-08): a commons source row
  // already attached to a wikiart artwork means that artwork is claimed — even though its
  // owning file is skipped above. Without the pre-claim a re-run frees the row and the next
  // commons file at dist <= MATCH_MAX links straight onto it instead of landing in dup-target.
  for (const r of execRows) if (wikiById.has(r.artwork_id)) wikiClaimed.add(r.artwork_id);

  // Band safety: min pairwise distance among the DISTINCT wikiart works (all are different
  // paintings, so every pair is unrelated). If two of them sit <= MATCH_MAX the bands cannot
  // safely separate twins in this corpus — apply aborts.
  let floor = 64;
  let floorPair = '';
  const wh = [...wikiHash.entries()];
  for (let i = 0; i < wh.length; i += 1) {
    for (let j = i + 1; j < wh.length; j += 1) {
      const d = hammingBits(wh[i][1], wh[j][1]);
      if (d < floor) {
        floor = d;
        floorPair = `${wh[i][0]}/${wh[j][0]}`;
      }
    }
  }
  console.log(`wiki-wiki unrelated floor = ${floor} (pair ${floorPair}, n=${wh.length} hashed wikiart rows)`);
  if (apply && floor <= MATCH_MAX) {
    throw new Error(`band check FAILED: two distinct wikiart works sit at dist ${floor} <= MATCH_MAX=${MATCH_MAX} — bands unsafe for this corpus, refusing to apply`);
  }

  const decisions = new Map<string, Decision>();
  const extId = (src: string) => `${PROVIDER}:${src}`;

  // Stage A: exact normalized title + tolerant year (captioned/attributed works).
  // A title match whose hash still agrees (<= TITLE_CONFLICT_MAX) attaches even when the
  // wikiart row already carries a Commons source — that is the multi-source feature, not a
  // conflict (several separate photos of Murder in the House all belong on one artwork).
  // dup-target survives here only when no hash exists to verify the claim; hash-ONLY second
  // claims stay held in Stage B (the Stålenhag by_conception rule).
  for (const item of items) {
    if (already.has(extId(item.src)) || !item.title) continue;
    const nt = normTitle(item.title);
    const cands = wiki.filter((w) => normTitle(w.title) === nt && yearsCompat(w.year, item.year));
    const oh = hashes[`c:${item.src}`];
    const dTo = (id: number): number | null => {
      const h = wikiHash.get(id);
      return oh && h ? hammingBits(oh, h) : null;
    };
    if (cands.length === 1) {
      const target = cands[0];
      const d = dTo(target.id);
      if (d != null && d > TITLE_CONFLICT_MAX) {
        decisions.set(item.src, { type: 'ambiguous-title', cands: [{ id: target.id, file: item.file }], conflictDist: d });
      } else if (d == null && wikiClaimed.has(target.id)) {
        decisions.set(item.src, { type: 'dup-target', wikiId: target.id, dist: -1 });
      } else {
        wikiClaimed.add(target.id);
        decisions.set(item.src, { type: 'title', wikiId: target.id, confidence: 100 });
      }
    } else if (cands.length > 1) {
      // two wikiart rows share this title (the Kontemplace pair) — only the hash may pick;
      // without exactly one <= MATCH_MAX candidate the item is held for review.
      const scored = cands.map((c) => ({ id: c.id, dist: dTo(c.id) }));
      const unknown = scored.some((s) => s.dist == null);
      const close = scored.filter((s) => s.dist != null && s.dist <= MATCH_MAX);
      if (!unknown && close.length === 1) {
        const best = close[0]!;
        wikiClaimed.add(best.id);
        decisions.set(item.src, { type: 'title', wikiId: best.id, confidence: 100 });
        console.log(`TITLE-TIEBREAK ${item.file} -> wikiart ${best.id} (shared title, hash=${best.dist})`);
      } else {
        decisions.set(item.src, { type: 'ambiguous-title', cands: cands.map((c) => ({ id: c.id, file: item.file })) });
      }
    }
    // 0 candidates -> hash stage below
  }

  // Stage B: dHash against the wikiart rows.
  for (const item of items) {
    if (decisions.has(item.src) || already.has(extId(item.src))) continue;
    const oh = hashes[`c:${item.src}`];
    if (!oh) {
      decisions.set(item.src, { type: 'hold-nohash' });
      continue;
    }
    const dists = [...wikiHash.entries()]
      .map(([id, h]) => ({ id, dist: hammingBits(oh, h) }))
      .sort((a, b) => a.dist - b.dist);
    const best = dists[0] ?? null;
    const second = dists[1] ?? null;
    if (best && best.dist <= MATCH_MAX) {
      if (second && second.dist <= MATCH_MAX) {
        decisions.set(item.src, { type: 'ambiguous-hash', cands: [best, second].map((c) => ({ file: item.file, dist: c.dist })) });
      } else if (wikiClaimed.has(best.id)) {
        decisions.set(item.src, { type: 'dup-target', wikiId: best.id, dist: best.dist });
      } else {
        wikiClaimed.add(best.id);
        decisions.set(item.src, { type: 'hash', wikiId: best.id, dist: best.dist, confidence: 90 });
      }
    } else if (best && best.dist <= NEAR_MAX) {
      decisions.set(item.src, { type: 'near', best, second });
    } else {
      decisions.set(item.src, { type: 'new' });
    }
  }

  // Adjudicated holds: the 2026-10-15 image-verdict batch looked at every held pair, so the
  // two held Commons claims are resolved here instead of staying HELD forever. HELD only.
  for (const [file, v] of Object.entries(VERDICT_LINK)) {
    const item = items.find((i) => i.file === file);
    if (!item) { console.error(`VERDICT-LINK ${file} — not in this scrape, skipped loudly`); continue; }
    if (already.has(extId(item.src))) continue;
    const d = decisions.get(item.src);
    if (d && isHeld(d)) {
      wikiClaimed.add(v.wikiId);
      decisions.set(item.src, { type: 'title', wikiId: v.wikiId, confidence: 100 });
      console.log(`VERDICT-LINK ${file} -> wikiart ${v.wikiId} — ${v.why}`);
    } else if (d) {
      console.log(`VERDICT-LINK ${file} - natural decision ${d.type} kept (not a hold)`);
    }
  }

  // Follow commons-same chains to the artwork row that will exist for a file.
  const primaryOf = (src: string): string => {
    let cur = src;
    for (let guard = 0; guard < 20; guard += 1) {
      const d = decisions.get(cur);
      if (d?.type === 'commons-same') cur = d.of;
      else return cur;
    }
    throw new Error(`commons-same chain too deep at ${src}`);
  };
  // Holding a primary must hold every file linked to it: pass 3 resolves commons-same
  // targets by (provider, external_id) of the PRIMARY, so a held primary would strand its
  // twins (the pass-3 lookup throws loudly). Cascade the hold down the chain instead.
  // holdDecision names the CONFLICTING file (the reason everything got held), never the
  // held file itself.
  const cascadeHold = (rootSrc: string, holdDecision: Decision) => {
    const root = primaryOf(rootSrc);
    for (const it of items) {
      const d = decisions.get(it.src);
      if (d?.type === 'commons-same' && primaryOf(it.src) === root) decisions.set(it.src, holdDecision);
    }
    const rd = decisions.get(root);
    if (rd?.type === 'new' || rd?.type === 'commons-same') decisions.set(root, holdDecision);
  };

  // Stage C1: same-work clusters among commons files — title+year agree and the hash confirms
  // (<= MATCH_MAX) -> the later file links to the earlier one's artwork row. Title agrees but
  // the hash disagrees -> BOTH held (either two works sharing a title or two wildly different
  // captures of one work — never guess which). One hash missing -> hold the later file as
  // unproven, the earlier stays insertable as primary.
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const di = decisions.get(item.src);
    if (!di || di.type !== 'new' || !item.title) continue;
    for (let j = 0; j < i; j += 1) {
      const prior = items[j];
      const pd = decisions.get(prior.src);
      if (!pd || (pd.type !== 'new' && pd.type !== 'commons-same') || !prior.title) continue;
      if (normTitle(prior.title) !== normTitle(item.title) || !yearsCompat(prior.year, item.year)) continue;
      const target = primaryOf(prior.src);
      const ha = hashes[`c:${item.src}`];
      const hb = hashes[`c:${target}`];
      if (ha && hb) {
        const d = hammingBits(ha, hb);
        if (d <= MATCH_MAX) {
          decisions.set(item.src, { type: 'commons-same', of: target });
          console.log(`COMMONS-SAME ${item.src} = ${target} (title+year, dist=${d})`);
        } else {
          console.error(`TITLE-VISUAL-CONFLICT ${target} ~ ${item.file} dist=${d} — both held`);
          cascadeHold(target, { type: 'ambiguous-title', cands: [{ id: -1, file: item.file }], conflictDist: d });
          decisions.set(item.src, { type: 'ambiguous-title', cands: [{ id: -1, file: target }], conflictDist: d });
        }
      } else {
        decisions.set(item.src, { type: 'ambiguous-title', cands: [{ id: -1, file: target }] });
      }
      break;
    }
  }

  // Stage C2: near-identical visuals under different titles among would-be-new works
  // (same piece under two filenames). Every `new` member is already proven > NEAR_MAX from
  // every wikiart row (Stage B), so an identical component cannot duplicate wikiart —
  // adjudicate instead of holding (2026-10-09): the first member in scrape order is the
  // lead and inserts, every other member attaches to it as a second source. Image identity
  // at dist <= MATCH_MAX needs no vision — the visioned dist-0 pairs of the Stålenhag run
  // resolved the same way (one artwork, files attached). Components handle 3+-file
  // clusters: one lead per component keeps exactly one artwork.
  const newItems = items.filter((i) => decisions.get(i.src)?.type === 'new');
  const parent = new Map<string, string>();
  for (const i of newItems) parent.set(i.src, i.src);
  const findRoot = (s: string): string => {
    let r = s;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = s;
    while (parent.get(c) !== c) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const pairCand = new Map<string, { file: string; dist: number }>(); // member -> first conflicting partner
  for (let i = 0; i < newItems.length; i += 1) {
    for (let j = i + 1; j < newItems.length; j += 1) {
      const a = newItems[i];
      const b = newItems[j];
      const ha = hashes[`c:${a.src}`];
      const hb = hashes[`c:${b.src}`];
      if (!ha || !hb) continue;
      const d = hammingBits(ha, hb);
      if (d <= MATCH_MAX) {
        const ra = findRoot(a.src);
        const rb = findRoot(b.src);
        if (ra !== rb) parent.set(ra, rb);
        if (!pairCand.has(a.src)) pairCand.set(a.src, { file: b.file, dist: d });
        if (!pairCand.has(b.src)) pairCand.set(b.src, { file: a.file, dist: d });
      }
    }
  }
  const compMembers = new Map<string, string[]>(); // component root -> member srcs (items order)
  for (const i of newItems) {
    const r = findRoot(i.src);
    const list = compMembers.get(r);
    if (list) list.push(i.src);
    else compMembers.set(r, [i.src]);
  }
  const bySrc = new Map(items.map((i) => [i.src, i]));
  for (const [, members] of compMembers) {
    if (members.length < 2) continue;
    const lead = members[0]!;
    const leadItem = bySrc.get(lead)!;
    for (const src of members.slice(1)) {
      const member = bySrc.get(src)!;
      const cand = pairCand.get(src);
      console.error(`DUP-COMMONS ${member.file} ~ ${leadItem.file} dist=${cand?.dist ?? '?'} — same work: lead inserts, follower attaches (${members.length}-file component)`);
      decisions.set(src, { type: 'commons-same', of: lead });
    }
  }

  // ---------------- title plan ----------------
  // Pre-existing artist rows: groups where >= 2 EXISTING rows share a normTitle get each
  // member suffixed with its own source identifier (Stålenhag book-plate rule). Planned
  // inserts in a group of size > 1 get their full Commons filename (minus extension) — an
  // identifier, never invented words.
  const existingRows = (await db
    .select({
      id: artworks.id,
      title: artworks.title,
      provider: artworks.provider,
      paintingUrl: artworks.paintingUrl,
      externalId: artworks.externalId,
    })
    .from(artworks)
    .where(eq(artworks.artistId, artistRow.id))) as {
    id: number;
    title: string;
    provider: string;
    paintingUrl: string | null;
    externalId: string;
  }[];

  const identifierFor = (row: { provider: string; paintingUrl: string | null; externalId: string }): string => {
    if (row.provider === 'wikiart' && row.paintingUrl) {
      const segs = row.paintingUrl.replace(/\/+$/, '').split('/');
      const last = segs[segs.length - 1] ?? '';
      const slug = /^painting$/i.test(last) ? (segs[segs.length - 2] ?? row.externalId) : last;
      return slug;
    }
    if (row.provider === PROVIDER) return row.externalId.replace(/^commons:/, '').replace(/\.[A-Za-z]+$/, '');
    return row.externalId;
  };

  const plannedInserts = items.filter((i) => decisions.get(i.src)?.type === 'new');
  type Group = { existing: typeof existingRows; inserts: CommonsItem[] };
  const groups = new Map<string, Group>();
  for (const row of existingRows) {
    const k = normTitle(row.title);
    const g = groups.get(k) ?? { existing: [], inserts: [] };
    g.existing.push(row);
    groups.set(k, g);
  }
  for (const it of plannedInserts) {
    const k = normTitle(it.title);
    const g = groups.get(k) ?? { existing: [], inserts: [] };
    g.inserts.push(it);
    groups.set(k, g);
  }

  const repairs: { id: number; from: string; to: string }[] = [];
  const finalTitle = new Map<string, string>();
  for (const [, g] of groups) {
    const groupSize = g.existing.length + g.inserts.length;
    if (g.existing.length >= 2) {
      for (const row of g.existing) repairs.push({ id: row.id, from: row.title, to: `${row.title} (${identifierFor(row)})` });
    }
    for (const it of g.inserts) {
      if (groupSize > 1) finalTitle.set(it.src, `${it.title} (${it.file.replace(/\.[A-Za-z]+$/, '')})`);
      else finalTitle.set(it.src, it.title);
    }
  }
  // Uniqueness pre-assert over every title we are about to have on record (existing after
  // repairs + planned inserts). Fail BEFORE any write.
  const finalKeys: string[] = [];
  for (const row of existingRows) {
    const rep = repairs.find((r) => r.id === row.id);
    finalKeys.push(normTitle(rep ? rep.to : row.title));
  }
  for (const it of plannedInserts) finalKeys.push(normTitle(finalTitle.get(it.src)!));
  const dupKeys = [...new Set(finalKeys.filter((k, i) => finalKeys.indexOf(k) !== i))];
  if (dupKeys.length > 0) {
    throw new Error(`title uniqueness pre-assert FAILED: ${dupKeys.length} duplicate normTitle key(s): ${dupKeys.join(' | ')}`);
  }

  // ---------------- report ----------------
  const buckets: Record<string, CommonsItem[]> = {
    title: [],
    hash: [],
    new: [],
    'commons-same': [],
    'ambiguous-title': [],
    'ambiguous-hash': [],
    near: [],
    'dup-target': [],
    'hold-nohash': [],
  };
  const skipped = items.filter((i) => already.has(extId(i.src)));
  for (const item of items) {
    if (already.has(extId(item.src))) continue;
    const d = decisions.get(item.src);
    if (d) buckets[d.type].push(item);
  }
  const wikiOnly = wiki.filter((w) => !wikiClaimed.has(w.id));
  const claimedByOf = (src: string, wikiId: number): string => {
    const other = items.find((o) => {
      if (o.src === src || already.has(extId(o.src))) return false;
      const d = decisions.get(o.src);
      return (d?.type === 'title' || d?.type === 'hash') && d.wikiId === wikiId;
    });
    if (other) return other.src;
    const prior = execRows.find((r) => r.artwork_id === wikiId);
    return prior ? prior.external_id.replace(/^commons:/, '') : '(unknown)';
  };

  const lines: string[] = [];
  lines.push('# Jakub Schikaneder — Wikimedia Commons import report');
  lines.push('');
  lines.push(`- scrape candidates: ${items.length + excludedItems.length} (already imported: ${skipped.length}, excluded from matching: ${excludedItems.length})`);
  lines.push(`- title matches: ${buckets.title.length}, hash matches (<=${MATCH_MAX}): ${buckets.hash.length}, same-work twins: ${buckets['commons-same'].length}, new works: ${buckets.new.length}`);
  lines.push(`- HELD: ambiguous-title ${buckets['ambiguous-title'].length}, ambiguous-hash ${buckets['ambiguous-hash'].length}, near(<=${NEAR_MAX}) ${buckets.near.length}, dup-target ${buckets['dup-target'].length}, nohash ${buckets['hold-nohash'].length}`);
  lines.push(`- wikiart-only works (no Commons counterpart): ${wikiOnly.length}`);
  lines.push(`- wiki-wiki unrelated floor: ${floor} (bands: MATCH_MAX=${MATCH_MAX}, NEAR_MAX=${NEAR_MAX}, TITLE_CONFLICT_MAX=${TITLE_CONFLICT_MAX})`);
  lines.push('');
  if (excludedItems.length) {
    lines.push(`## EXCLUDED from matching (${excludedItems.length})`);
    for (const i of excludedItems) lines.push(`- ${i.file} — ${i.exclude}`);
    lines.push('');
  }
  if (repairs.length) {
    lines.push(`## title-uniqueness repairs (${repairs.length})`);
    for (const r of repairs) lines.push(`- artwork ${r.id}: "${r.from}" -> "${r.to}"`);
    lines.push('');
  }
  const pushSection = (label: string, list: CommonsItem[], f: (i: CommonsItem, d: Decision) => string) => {
    if (!list.length) return;
    lines.push(`## ${label} (${list.length})`);
    for (const i of list) lines.push(`- ${f(i, decisions.get(i.src)!)}`);
    lines.push('');
  };
  pushSection('title matches', buckets.title, (i, d) => {
    const id = (d as { wikiId: number }).wikiId;
    const oh = hashes[`c:${i.src}`];
    const whh = wikiHash.get(id);
    const hd = oh && whh ? hammingBits(oh, whh) : null;
    return `${i.file} -> wikiart ${id} ("${wikiById.get(id)?.title}" ${wikiById.get(id)?.year ?? ''}, commons="${i.title}" ${i.year ?? ''}, yearSource=${i.yearSource}, hashDist=${hd ?? 'n/a'})`;
  });
  pushSection(`hash matches (dist<=${MATCH_MAX})`, buckets.hash, (i, d) => {
    const dd = d as { wikiId: number; dist: number };
    return `${i.file} -> wikiart ${dd.wikiId} ("${wikiById.get(dd.wikiId)?.title}", commons="${i.title}" ${i.year ?? ''}, dist=${dd.dist})`;
  });
  pushSection('SAME WORK as another Commons file (title+year+hash, or image-identical under differing titles)', buckets['commons-same'], (i, d) => `${i.file} = ${(d as { of: string }).of}`);
  pushSection('NEW works (would insert)', buckets.new, (i) => `${i.file} title="${finalTitle.get(i.src)}" year=${i.year ?? 'null'} (${i.yearSource ?? 'no-year'}) titleSource=${i.titleSource} signals=${i.signals.join('+')} license=${i.license ?? '?'}`);
  pushSection('HELD ambiguous-title', buckets['ambiguous-title'], (i, d) => {
    const dd = d as { cands: { id: number; file: string }[]; conflictDist?: number };
    const candTxt = dd.cands.map((c) => (c.id >= 0 ? `${c.id}:${c.file}` : c.file)).join(',');
    return `${i.file} commons="${i.title}" cands=${candTxt}${dd.conflictDist != null ? ` VISUAL-CONFLICT dist=${dd.conflictDist}` : ''}`;
  });
  pushSection('HELD ambiguous-hash', buckets['ambiguous-hash'], (i, d) => {
    const dd = d as { cands: { file: string; dist: number }[] };
    return `${i.file} cands=${dd.cands.map((c) => `${c.file}@${c.dist}`).join(',')}`;
  });
  pushSection(`HELD near (dist<=${NEAR_MAX})`, buckets.near, (i, d) => {
    const dd = d as { best: { id: number; dist: number }; second: { id: number; dist: number } | null };
    const t = (id: number) => wikiById.get(id)?.title ?? '?';
    return `${i.file} best=${dd.best.dist} to wikiart ${dd.best.id} "${t(dd.best.id)}"${dd.second ? ` second=${dd.second.dist} to ${dd.second.id}` : ''}`;
  });
  pushSection('HELD dup-target (wikiart row already claimed)', buckets['dup-target'], (i, d) => {
    const dd = d as { wikiId: number; dist: number };
    return `${i.file} -> wikiart ${dd.wikiId} "${wikiById.get(dd.wikiId)?.title}" claimed by ${claimedByOf(i.src, dd.wikiId)} dist=${dd.dist < 0 ? 'n/a' : dd.dist}`;
  });
  pushSection('HELD nohash (download failed, no insert without proof)', buckets['hold-nohash'], (i) => `${i.file}`);
  if (wikiOnly.length) {
    lines.push(`## wikiart-only works (${wikiOnly.length})`);
    for (const w of wikiOnly) lines.push(`- ${w.id} "${w.title}" ${w.year ?? ''}`);
    lines.push('');
  }

  // ---------------- apply ----------------
  const linked: string[] = [];
  const inserted: string[] = [];
  const samelinks: string[] = [];
  const doneRepairs: string[] = [];
  if (apply) {
    for (const r of repairs) {
      await db.update(artworks).set({ title: r.to, updatedAt: new Date() }).where(eq(artworks.id, r.id));
      doneRepairs.push(`artwork ${r.id} "${r.from}" -> "${r.to}"`);
      console.log(`TITLE-REPAIR artwork ${r.id}: "${r.from}" -> "${r.to}"`);
    }
    // pass 1: insert new works (with their final, possibly identifier-suffixed titles)
    for (const item of plannedInserts) {
      const title = finalTitle.get(item.src)!;
      const externalId = extId(item.src);
      const [row] = await db
        .insert(artworks)
        .values({
          artistId: artistRow.id,
          provider: PROVIDER,
          externalId,
          title,
          year: item.year,
          imageUrl: item.url,
          paintingUrl: item.page,
          metadata: {
            commonsFile: item.file,
            commonsOriginal: item.original,
            objectName: item.objectName,
            wikidataTitle: item.wikidataTitle,
            yearSource: item.yearSource,
            artistCredit: item.credit,
            license: item.license,
            titleSource: item.titleSource,
            signals: item.signals,
          },
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({ target: [artworks.provider, artworks.externalId], set: { updatedAt: new Date() } })
        .returning({ id: artworks.id });
      await upsertArtworkSource({
        artworkId: row.id,
        provider: PROVIDER,
        externalId,
        sourceUrl: item.page,
        imageUrl: item.url,
        title,
        confidence: 100,
        isPrimary: true,
        lastSyncedAt: new Date(),
      });
      inserted.push(`artwork ${row.id} "${title}" <- ${item.file}`);
      console.log(`INSERT artwork ${row.id} "${title}" <- ${item.file}`);
    }
    // pass 2: links onto existing wikiart rows
    for (const item of items) {
      if (already.has(extId(item.src))) continue;
      const d = decisions.get(item.src);
      if (!d || (d.type !== 'title' && d.type !== 'hash')) continue;
      await upsertArtworkSource({
        artworkId: d.wikiId,
        provider: PROVIDER,
        externalId: extId(item.src),
        sourceUrl: item.page,
        imageUrl: item.url,
        title: item.title,
        confidence: d.confidence,
        isPrimary: false,
        lastSyncedAt: new Date(),
      });
      const distTxt = d.type === 'hash' ? ` dist=${d.dist}` : '';
      linked.push(`${item.file} -> wikiart ${d.wikiId} (${d.type}${distTxt})`);
      console.log(`LINK ${item.file} -> wikiart ${d.wikiId} (${d.type}${distTxt})`);
    }
    // pass 3: same-work twins link onto their primary (inserted in pass 1)
    for (const item of items) {
      if (already.has(extId(item.src))) continue;
      const d = decisions.get(item.src);
      if (!d || d.type !== 'commons-same') continue;
      const target = await db
        .select({ id: artworks.id })
        .from(artworks)
        .where(and(eq(artworks.provider, PROVIDER), eq(artworks.externalId, extId(d.of))));
      if (target.length !== 1) {
        throw new Error(`COMMONS-SAME target ${d.of} resolved to ${target.length} artwork rows — no fallback (primary must be inserted in pass 1)`);
      }
      await upsertArtworkSource({
        artworkId: target[0].id,
        provider: PROVIDER,
        externalId: extId(item.src),
        sourceUrl: item.page,
        imageUrl: item.url,
        title: item.title,
        confidence: 90,
        isPrimary: false,
        lastSyncedAt: new Date(),
      });
      samelinks.push(`${item.file} -> artwork ${target[0].id} (same work as ${d.of})`);
      console.log(`LINK ${item.file} -> artwork ${target[0].id} (same work as ${d.of})`);
    }

    // ---------------- post-write asserts (loud) ----------------
    const fails: string[] = [];
    const after = (await db.select({ id: artworks.id, title: artworks.title }).from(artworks).where(eq(artworks.artistId, artistRow.id))) as {
      id: number;
      title: string;
    }[];
    const keys = after.map((r) => normTitle(r.title));
    const dupAfter = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
    if (dupAfter.length > 0) fails.push(`post-write title uniqueness FAILED: ${dupAfter.length} dup key(s) ${dupAfter.join(' | ')}`);
    if (inserted.length !== plannedInserts.length) fails.push(`inserted ${inserted.length} != planned ${plannedInserts.length}`);
    const plannedLinks = items.filter((i) => {
      if (already.has(extId(i.src))) return false;
      const d = decisions.get(i.src);
      return d?.type === 'title' || d?.type === 'hash';
    }).length;
    const plannedSame = items.filter((i) => !already.has(extId(i.src)) && decisions.get(i.src)?.type === 'commons-same').length;
    if (linked.length !== plannedLinks) fails.push(`linked ${linked.length} != planned ${plannedLinks}`);
    if (samelinks.length !== plannedSame) fails.push(`commons-same ${samelinks.length} != planned ${plannedSame}`);
    const commonsRows = (
      await db
        .select({ id: artworks.id })
        .from(artworks)
        .where(and(eq(artworks.artistId, artistRow.id), eq(artworks.provider, PROVIDER)))
    ).length;
    const primaryRes = await db.execute(
      sql`SELECT count(*)::int AS n FROM artwork_external_ids e JOIN artworks a ON a.id = e.artwork_id WHERE e.provider = 'commons' AND e.is_primary = true AND a.provider = 'commons' AND a.artist_id = ${artistRow.id}`,
    );
    const primaryRows = (Array.isArray(primaryRes) ? primaryRes : ((primaryRes as unknown as { rows?: unknown[] }).rows ?? [])) as { n: number }[];
    if (primaryRows[0]?.n !== commonsRows) fails.push(`primary commons source rows ${primaryRows[0]?.n} != commons artworks ${commonsRows}`);
    if (fails.length > 0) {
      console.error('!! POST-WRITE ASSERT FAILED:');
      for (const f of fails) console.error(`   - ${f}`);
      process.exit(1);
    }
  }

  lines.push('## actions' + (apply ? '' : ' (DRY RUN — nothing written)'));
  lines.push(`- title repairs: ${apply ? doneRepairs.length : repairs.length}${apply ? '' : ` (would repair ${repairs.length})`}`);
  lines.push(`- linked: ${linked.length}${apply ? '' : ` (would link; matched set = ${buckets.title.length + buckets.hash.length})`}`);
  lines.push(`- same-work links: ${samelinks.length}${apply ? '' : ` (would link; ${buckets['commons-same'].length})`}`);
  lines.push(`- inserted: ${inserted.length}${apply ? '' : ` (would insert; ${buckets.new.length} new)`}`);
  if (apply) {
    for (const l of doneRepairs) lines.push(`  - REPAIR ${l}`);
    for (const l of linked) lines.push(`  - LINK ${l}`);
    for (const l of samelinks) lines.push(`  - LINK ${l}`);
    for (const i of inserted) lines.push(`  - INSERT ${i}`);
  }
  lines.push('');
  writeFileSync(REPORT, lines.join('\n'), 'utf8');

  const held =
    buckets['ambiguous-title'].length +
    buckets['ambiguous-hash'].length +
    buckets.near.length +
    buckets['dup-target'].length +
    buckets['hold-nohash'].length;
  console.log(`REPORT -> ${REPORT}`);
  console.log(
    `MODE=${apply ? 'APPLY' : 'DRY-RUN'} title=${buckets.title.length} hash=${buckets.hash.length} same=${buckets['commons-same'].length} new=${buckets.new.length} HELD=${held} wikiart-only=${wikiOnly.length} linked=${linked.length} inserted=${inserted.length} repaired=${apply ? doneRepairs.length : repairs.length}`,
  );
  for (const w of wikiOnly) console.log(`WIKIART-ONLY ${w.id} "${w.title}" ${w.year ?? ''}`);
  for (const i of buckets.new) console.log(`PLAN-INSERT "${finalTitle.get(i.src)}" <- ${i.file}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'scrape') await scrape();
  else if (mode === 'urls') await urls();
  else if (mode === 'hash') await hash();
  else if (mode === 'import') await runImport(process.argv.includes('--apply'));
  else throw new Error(`unknown mode "${mode}" — expected scrape|urls|hash|import [--apply]`);
}

main().catch((e) => {
  console.error(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
