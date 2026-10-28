// Artpoisk importer: archived gallery (Wayback 2018-12-28) -> links/inserts for artist 'sergey-tutunov'.
// Source site is dead; the gallery snapshot is archived locally and parsed from disk. Every work is titled,
// so the folded-title ladder leads; dHash (shared state with the official run, keys o:/a:) is the tiebreak
// for multi-candidate and no-candidate cases. Ambiguous hash results are HELD loudly — never a silent pick.
// Images (238px archived thumbs) are downloaded transiently for hashing only (C:\tmp) — refs-only rule holds.
// TRANSPORT: downloads go through curl.exe via the local proxy (socks5h://127.0.0.1:7891) — Wayback's bot
// filter 429s both node undici AND direct curl from this host's IP after any burst (a block that outlives
// minutes of cooldown), while the proxy egress serves every URL fine. One source (Wayback), one documented
// egress; every run prints the transport line.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs <mode> [--apply]`
// Modes: parse | urls | hash | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks, artworkExternalIds } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { and, eq, like } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARTIST_PROVIDER = 'official';
const ARTIST_SLUG = 'sergey-tutunov';
const PROVIDER = 'artpoisk';
const EXT_PREFIX = 'artpoisk:';

const WB_TS = '20181218022246';
const SITE = 'http://artpoisk.info';
const ARTIST_BASE = `${SITE}/artist/tutunov_sergey_andreevich_1925/`;
const WB_ARTIST_BASE = `https://web.archive.org/web/${WB_TS}/${ARTIST_BASE}`;
const GALLERY_WB = `${WB_ARTIST_BASE}gallery/`;

const GALLERY_LOCAL = 'C:/tmp/tutunov-artpoisk-gallery.html';
const SCRAPE_PATH = 'C:/tmp/tutunov-artpoisk-scrape.json';
const HASH_IN = 'C:/tmp/tutunov-artpoisk-hash-input.json';
const HASH_STATE = 'C:/tmp/tutunov-hashes.json'; // shared with the official run: o:<rel> official, a:<slug> artpoisk
const HASH_JOBS = 'C:/tmp/tutunov-artpoisk-hash-jobs.json';
const HASH_JOBS_OUT = 'C:/tmp/tutunov-artpoisk-hash-out.json';
const HASH_CACHE = 'C:/tmp/tutunov-hash-cache';
const HASH_PS1 = 'scripts/import-schikaneder-hash.ps1';
const REPORT_PATH = 'C:/tmp/tutunov-artpoisk-import-report.md';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Bands for cross-scan (different photograph of the same painting) matching. Calibrated from the
// title-matched pairs in the dry report before --apply; a same-work pair from two different scans hashes
// larger than the official-official same-scan twins, so do NOT reuse the 3/8 twin bands here.
const MATCH_MAX = 8;
const NEAR_MAX = 12;
const TITLE_CONFLICT_MAX = 20;

// Post-hold adjudications: items whose organic ladder ends HELD but whose identity is settled by the
// two catalogs' own caption metadata (year / medium / dimensions / holder), cross-checked field by field.
// Both sources carry the data; artpoisk's medium text shows transcription variance, so dimensions +
// holder are the strong signals. Only ever rewrites a HELD decision — a confident title/hash link is
// never overridden (a future better match survives). A map entry matching no scraped item throws loudly.
const ITEM_DECISIONS: Record<string, { target: number; note: string }> = {
  detstvo: {
    target: 194506,
    note: 'official caption "Детство" (вариант). 1960 г. Х.Темпера. 64Х90, Воронежский обл. музей — year/medium/dims/holder all exact vs artpoisk «Холст, темпера, 64 х 90», «Воронежский областной художественный музей имени И.Н. Крамского»; artpoisk scan id 10979 = official file 10979.jpg (same scan)',
  },
  avtoportret_101: {
    target: 194509,
    note: 'official caption "Автопортрет" 1979 г. К.М. 54Х37, Государственная Третьяковская галерея — year/medium/holder/base-title exact vs artpoisk «Картон, масло, 55 х 40», «Государственная Третьяковская галерея»; dims variance 54Х37 vs 55 х 40 noted; 194510 ("Автопортрет в шапке" 1979 Х.М. 55Х41) ruled out (canvas, no holder)',
  },
  portret_zherara_befa: {
    target: 194517,
    note: 'official caption "Портрет инженера" (Жерар Бёф) 1983 г. Х.М. 69Х52, Государственная Третьяковская галерея — year/person/medium/dims/holder all exact vs artpoisk «Портрет Жерара Бёфа», «Холст, масло, 69 х 52», «Государственная Третьяковская галерея»',
  },
  potret_e_v_tutunovoy: {
    target: 194516,
    note: 'official caption "Портрет Е.В.Тутуновой" 1987 г. Х.М. 55Х45 — year/person/dims exact vs artpoisk «Потрет Е.В. Тутуновой» (typo), 1987, «55 х 45», «Частное собрание» (official caption states no holder, consistent); medium variance (artpoisk «Картон, масло» vs official Х.М.) noted, not blocking',
  },
};

type ScrapeItem = {
  slug: string;
  title: string;
  yearText: string;
  year: number | null;
  decade: boolean;
  desc: string;
  collection: string;
  imageId: string;
  detailUrl: string; // wayback detail page (accessible ref)
  originalDetailUrl: string; // artpoisk canonical URL (dead site)
  thumbUrl: string; // wayback 238px thumb (accessible ref + hash source)
  originalThumbUrl: string;
};
type ScrapeDoc = { parsedAt: string; sourcePage: string; items: ScrapeItem[] };

type Decision =
  | { kind: 'link'; item: ScrapeItem; target: number; how: 'title' | 'title+year' | 'hash' | 'text-evidence'; dist: number | null; note: string }
  | { kind: 'insert'; item: ScrapeItem; note: string }
  | { kind: 'held'; item: ScrapeItem; why: string; detail: string }
  | { kind: 'already'; item: ScrapeItem };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function keyOf(slug: string): string {
  return `a:${slug}`;
}

function loadScrape(): ScrapeDoc {
  if (!existsSync(SCRAPE_PATH)) throw new Error(`scrape missing ${SCRAPE_PATH} — run parse first, no fallback`);
  return JSON.parse(readFileSync(SCRAPE_PATH, 'utf8')) as ScrapeDoc;
}

function foldTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

function dhashDistance(a: string, b: string): number {
  if (a.length !== 64 || b.length !== 64) {
    throw new Error(`bad hash lengths ${a.length}/${b.length} — expected 64 binary chars (nibble-loop bug guard)`);
  }
  let d = 0;
  for (let i = 0; i < 64; i += 1) if (a[i] !== b[i]) d += 1;
  return d;
}

function stripWayback(url: string): string {
  const marker = `/web/${WB_TS}`;
  const i = url.indexOf(marker);
  if (i < 0) throw new Error(`wayback URL without ${marker}: ${url}`);
  let rest = url.slice(i + marker.length);
  if (rest.startsWith('im_')) rest = rest.slice(3);
  if (!rest.startsWith('/')) throw new Error(`unexpected wayback URL shape: ${url}`);
  return rest.slice(1);
}

// ---- parse ----------------------------------------------------------------

function parse(): void {
  if (!existsSync(GALLERY_LOCAL)) {
    throw new Error(`archived gallery missing ${GALLERY_LOCAL} — capture it first, no fallback`);
  }
  const html = readFileSync(GALLERY_LOCAL, 'utf8');
  if (!html.includes('tutunov_sergey_andreevich_1925') || !html.includes('Тутунов')) {
    throw new Error('gallery file does not look like the Tutunov artpoisk page — no fallback');
  }
  const segs = html.split('<li itemscope itemtype="http://schema.org/ImageObject">').slice(1);
  const items: ScrapeItem[] = [];
  const seen = new Set<string>();
  for (const seg of segs) {
    const hrefM = seg.match(/<a itemprop="contentUrl"[^>]*href="([^"]+)"/);
    if (!hrefM) throw new Error('item without contentUrl href — markup changed, no fallback');
    const detailUrl = decodeEntities(hrefM[1]);
    if (!detailUrl.includes(ARTIST_BASE)) throw new Error(`item href outside artist base: ${detailUrl}`);
    const slugTail = detailUrl.slice(detailUrl.indexOf(ARTIST_BASE) + ARTIST_BASE.length);
    const slug = slugTail.replace(/\/$/, '');
    if (!slug || slug.includes('/')) throw new Error(`bad slug parsed from href: ${detailUrl}`);
    if (seen.has(slug)) throw new Error(`duplicate slug in gallery: ${slug}`);
    seen.add(slug);

    const imgM = seg.match(/<img src="([^"]+)"/);
    if (!imgM) throw new Error(`item ${slug} without img — markup changed, no fallback`);
    const thumbUrl = decodeEntities(imgM[1]);
    const imgIdM = thumbUrl.match(/_thumbs\/(\d+)\/238x0\.jpg/);
    if (!imgIdM) throw new Error(`item ${slug} thumb not the expected 238x0 shape: ${thumbUrl}`);

    const nameM = seg.match(/<div class="name"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/div>/);
    if (!nameM) throw new Error(`item ${slug} without name block — markup changed, no fallback`);
    const title = decodeEntities(nameM[1]).replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim();
    if (!title) throw new Error(`item ${slug} has an empty title — no invented titles allowed`);
    const yearText = decodeEntities(nameM[2]).replace(/\s+/g, ' ').trim();
    const yearTokens = [...yearText.matchAll(/(19\d{2}|20[0-2]\d)/g)].map((m) => Number(m[1]));
    const year = yearTokens.length ? yearTokens[yearTokens.length - 1] : null; // range END per the standing rule
    const decade = yearTokens.length === 1 && /-е\s*$|-х\s*$|х годов/.test(yearText);
    if (year === null) console.log(`NO-YEAR ${slug} — yearText="${yearText}"`);

    const descM = seg.match(/<div class="desc"[^>]*>([\s\S]*?)<\/div>/);
    const desc = descM ? decodeEntities(descM[1]).replace(/\s+/g, ' ').trim() : '';
    const colM = seg.match(/<div class="val">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const collection = colM ? decodeEntities(colM[1]).replace(/\s+/g, ' ').trim() : '';

    items.push({
      slug,
      title,
      yearText,
      year,
      decade,
      desc,
      collection,
      imageId: imgIdM[1],
      detailUrl,
      originalDetailUrl: stripWayback(detailUrl),
      thumbUrl,
      originalThumbUrl: stripWayback(thumbUrl),
    });
  }
  if (items.length < 25) {
    throw new Error(`parsed only ${items.length} items — expected ~33 (pagination/markup regression), no fallback`);
  }
  const doc: ScrapeDoc = { parsedAt: new Date().toISOString(), sourcePage: GALLERY_WB, items };
  writeFileSync(SCRAPE_PATH, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`PARSE done: items=${items.length} noYear=${items.filter((i) => i.year === null).length} -> ${SCRAPE_PATH}`);
}

// ---- urls / hash ----------------------------------------------------------

function urls(): void {
  const doc = loadScrape();
  const input = doc.items.map((it) => ({ key: keyOf(it.slug), url: it.thumbUrl }));
  writeFileSync(HASH_IN, JSON.stringify(input, null, 2), 'utf8');
  console.log(`URLS done: items=${input.length} -> ${HASH_IN}`);
}

async function hash(): Promise<void> {
  if (!existsSync(HASH_IN)) throw new Error(`hash input missing ${HASH_IN} — run urls first, no fallback`);
  const input = JSON.parse(readFileSync(HASH_IN, 'utf8')) as { key: string; url: string }[];
  const state = existsSync(HASH_STATE)
    ? (JSON.parse(readFileSync(HASH_STATE, 'utf8')) as Record<string, string | null>)
    : {};
  const missingAll = input.filter((e) => state[e.key] === undefined);
  // --only <k1,k2,…> restricts this wave to the listed keys, IN THE GIVEN ORDER (priority order matters while
  // Wayback throttles: fetch the decision-critical images first). Every skip is printed loud; no silent filtering.
  const onlyIdx = process.argv.indexOf('--only');
  let missing = missingAll;
  if (onlyIdx >= 0) {
    const keys = (process.argv[onlyIdx + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!keys.length) throw new Error('--only requires a comma-separated key list, e.g. --only a:foo,a:bar');
    const byKey = new Map(missingAll.map((e) => [e.key, e]));
    for (const k of keys) if (!byKey.has(k)) console.error(`ONLY-note ${k} — not in the missing set (already hashed?); skipped`);
    missing = keys.filter((k) => byKey.has(k)).map((k) => byKey.get(k) as { key: string; url: string });
    console.log(`ONLY filter: ${missing.length}/${missingAll.length} missing entries scheduled for this wave (${keys.join(' ')})`);
  }
  mkdirSync(HASH_CACHE, { recursive: true });
  const cacheFile = (key: string) => join(HASH_CACHE, `${createHash('sha1').update(key).digest('hex').slice(0, 20)}.img`);
  const failedDl: string[] = [];
  const egressIdx = process.argv.indexOf('--egress');
  const egressName = egressIdx >= 0 ? (process.argv[egressIdx + 1] ?? '') : 'proxy';
  if (egressName !== 'proxy' && egressName !== 'direct') throw new Error(`--egress must be proxy|direct (got "${egressName}") — no default guess`);
  const egressArgs = egressName === 'proxy' ? ['-x', 'socks5h://127.0.0.1:7891'] : [];
  const paceIdx = process.argv.indexOf('--pace');
  const paceBase = paceIdx >= 0 ? Number(process.argv[paceIdx + 1]) : 30000;
  if (!Number.isFinite(paceBase) || paceBase < 1000) throw new Error(`--pace must be a ms value >= 1000 (got "${process.argv[paceIdx + 1] ?? ''}")`);
  console.log(`TRANSPORT curl.exe via ${egressName === 'proxy' ? 'socks5h://127.0.0.1:7891 (mihomo)' : 'DIRECT host egress'} — one egress per wave, printed loud; Wayback 429s bursts from both egresses, so the cooled one is chosen deliberately.`);
  console.log(`PACE base=${paceBase}ms; fail ladder +60s per consecutive failure capped 300s; wave stops after 5 consecutive failures.`);
  console.log(`HASH dl-start: to-check=${missing.length} cache=${HASH_CACHE}`);
  let done = 0;
  let paceMs = paceBase;
  let consecFail = 0;
  for (const e of missing) {
    const file = cacheFile(e.key);
    if (existsSync(file)) continue;
    let ok = false;
    let lastErr = '';
    const res = spawnSync('curl.exe', ['-s', '-L', ...egressArgs, '--max-time', '60', '-A', UA, '-o', file, '-w', '%{http_code}', e.url], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const code = (res.stdout ?? '').trim();
    if (res.error) {
      lastErr = `curl spawn error: ${res.error.message}`;
    } else if (code !== '200') {
      lastErr = `curl HTTP ${code || `exit ${res.status}`}`;
      rmSync(file, { force: true });
    } else {
      const buf = readFileSync(file);
      if (buf.length < 500) {
        lastErr = `too small (${buf.length}b)`;
        rmSync(file, { force: true });
      } else if (!buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && !buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        lastErr = `not an image (magic ${buf.subarray(0, 4).toString('hex')}) — wayback may have served an error page`;
        rmSync(file, { force: true });
      } else {
        ok = true;
      }
    }
    if (ok) {
      done += 1;
      consecFail = 0;
      paceMs = paceBase;
      console.log(`DL ${done}/${missing.length} ${e.key} — ${readFileSync(file).length}b`);
    } else {
      consecFail += 1;
      paceMs = Math.min(300000, paceBase + 60000 * consecFail);
      console.error(`DL-FAIL ${e.key} — ${lastErr} (pace ${paceMs}ms, consecFail ${consecFail})`);
      failedDl.push(`${e.key} — ${lastErr}`);
      if (consecFail >= 5) {
        console.error('WAVE-STOP: 5 consecutive failures — Wayback is blocking; state is persisted, re-run after cooldown');
        break;
      }
    }
    await sleep(paceMs);
  }
  // The failure throw lives AFTER the state merge below, so a partial wave still merges every downloaded
  // image into the shared hash state before exiting loud.
  const jobs = missing.map((e) => ({ key: e.key, path: cacheFile(e.key) })).filter((j) => existsSync(j.path));
  writeFileSync(HASH_JOBS, JSON.stringify(jobs, null, 2), 'utf8');
  const res = spawnSync('pwsh', ['-NoProfile', '-File', HASH_PS1, '-JobsPath', HASH_JOBS, '-OutPath', HASH_JOBS_OUT], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (res.status !== 0) throw new Error(`hash PS1 failed (${res.status}): ${res.stderr || res.stdout}`);
  const out = JSON.parse(readFileSync(HASH_JOBS_OUT, 'utf8')) as Record<string, string | null>;
  let hashed = 0;
  let unreadable = 0;
  for (const [k, v] of Object.entries(out)) {
    if (state[k] === undefined) {
      state[k] = v;
      if (v) hashed += 1;
      else unreadable += 1;
    }
  }
  writeFileSync(HASH_STATE, JSON.stringify(state, null, 2), 'utf8');
  console.log(
    `HASH done: new=${jobs.length} hashed=${hashed} unreadable=${unreadable} state=${Object.keys(state).length} -> ${HASH_STATE}`,
  );
  for (const [k, v] of Object.entries(state)) if (v === null) console.error(`HASH-FAILED ${k} — image unreadable/undownloaded`);
  if (failedDl.length) {
    console.error(`DOWNLOAD FAILURES ${failedDl.length}/${missing.length} — completed downloads were merged into the state above; re-run after cooldown.`);
    for (const f of failedDl) console.error(`  ${f}`);
    throw new Error('image downloads FAILED — merged state holds every completed download, re-run for the rest, no fallback');
  }
}

// ---- import ---------------------------------------------------------------

async function runImport(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const doc = loadScrape();
  const state = existsSync(HASH_STATE)
    ? (JSON.parse(readFileSync(HASH_STATE, 'utf8')) as Record<string, string | null>)
    : {};

  const [artist] = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(and(eq(artists.provider, ARTIST_PROVIDER), eq(artists.slug, ARTIST_SLUG)))
    .limit(1);
  if (!artist) throw new Error(`artist ${ARTIST_PROVIDER}/${ARTIST_SLUG} not found — seed it first, no fallback`);

  const artRows = await db
    .select({ id: artworks.id, title: artworks.title, year: artworks.year })
    .from(artworks)
    .where(eq(artworks.artistId, artist.id));
  if (artRows.length === 0) throw new Error(`artist ${artist.id} has zero artworks — official import missing, no fallback`);

  // donor rels (official) -> artworkId; donors feed the hash tiebreak
  const donorExts = await db
    .select({ ext: artworkExternalIds.externalId, artworkId: artworkExternalIds.artworkId })
    .from(artworkExternalIds)
    .where(and(eq(artworkExternalIds.provider, ARTIST_PROVIDER), like(artworkExternalIds.externalId, 'tutunov:%')));
  const relByArtwork = new Map<number, string[]>();
  for (const r of donorExts) {
    const rel = r.ext.replace('tutunov:', '');
    const list = relByArtwork.get(r.artworkId) ?? [];
    list.push(rel);
    relByArtwork.set(r.artworkId, list);
  }
  const donorHash = (artworkId: number, itemHash: string): { dist: number; rel: string } | null => {
    const rels = relByArtwork.get(artworkId);
    if (!rels) return null;
    let best: { dist: number; rel: string } | null = null;
    for (const rel of rels) {
      const h = state[`o:${rel}`];
      if (!h) continue;
      const d = dhashDistance(itemHash, h);
      if (!best || d < best.dist) best = { dist: d, rel };
    }
    return best;
  };
  // When a title match hash-conflicts (> TITLE_CONFLICT_MAX) the image is NOT the title candidate's work, so
  // scan every tracked donor before holding: a UNIQUE donor within MATCH_MAX identifies the image's true work
  // (cross-catalog titles differ — artpoisk's "Боровск" 1951 is the official "Вид на Боровск" 1951). Zero or
  // multiple in-band donors keep the hold — never a silent pick.
  const fullDonorScan = (itemHash: string): { row: { id: number; title: string; year: number | null }; dist: number }[] => {
    const inBand: { row: { id: number; title: string; year: number | null }; dist: number }[] = [];
    for (const row of artRows) {
      const d = donorHash(row.id, itemHash);
      if (d && d.dist <= MATCH_MAX) inBand.push({ row, dist: d.dist });
    }
    return inBand;
  };

  const existing = await db
    .select({ ext: artworkExternalIds.externalId })
    .from(artworkExternalIds)
    .where(eq(artworkExternalIds.provider, PROVIDER));
  const alreadyExts = new Set(existing.map((r) => r.ext));

  const titleIndex = new Map<string, { id: number; title: string; year: number | null }[]>();
  for (const row of artRows) {
    const key = foldTitle(row.title);
    const list = titleIndex.get(key) ?? [];
    list.push(row);
    titleIndex.set(key, list);
  }

  const decisions: Decision[] = [];
  const calibration: string[] = [];
  const nearNotes: string[] = [];

  for (const it of doc.items) {
    const ext = EXT_PREFIX + it.slug;
    if (alreadyExts.has(ext)) {
      decisions.push({ kind: 'already', item: it });
      continue;
    }
    const itemHash = state[keyOf(it.slug)];
    const candidates = titleIndex.get(foldTitle(it.title)) ?? [];

    if (candidates.length === 1) {
      const c = candidates[0];
      let dist: number | null = null;
      if (itemHash) {
        const d = donorHash(c.id, itemHash);
        if (d) {
          dist = d.dist;
          calibration.push(`| ${it.title} | ${it.year ?? '—'} | ${c.year ?? '—'} | ${c.id} | ${d.dist} |`);
        }
      }
      if (dist !== null && itemHash && dist > TITLE_CONFLICT_MAX) {
        const inBand = fullDonorScan(itemHash);
        if (inBand.length === 1) {
          decisions.push({
            kind: 'link',
            item: it,
            target: inBand[0].row.id,
            how: 'hash',
            dist: inBand[0].dist,
            note: `title "${c.title}" (#${c.id}) hash-conflicted at ${dist} > ${TITLE_CONFLICT_MAX}; full donor scan: UNIQUE identity "${inBand[0].row.title}" (#${inBand[0].row.id}) at dHash ${inBand[0].dist} <= ${MATCH_MAX}`,
          });
          continue;
        }
        decisions.push({
          kind: 'held',
          item: it,
          why: `title matched "${c.title}" (#${c.id}) but dHash ${dist} > ${TITLE_CONFLICT_MAX} — conflict`,
          detail: `year artpoisk=${it.year ?? '—'} db=${c.year ?? '—'}; full donor scan: ${inBand.length === 0 ? `no donor within ${MATCH_MAX}` : `${inBand.length} donors within ${MATCH_MAX} — ambiguous`}`,
        });
        continue;
      }
      decisions.push({
        kind: 'link',
        item: it,
        target: c.id,
        how: 'title',
        dist,
        note:
          it.year !== null && c.year !== null && it.year !== c.year
            ? `year artpoisk=${it.year} db=${c.year} (tolerated, title exact)`
            : '',
      });
      continue;
    }

    if (candidates.length >= 2) {
      let pool = candidates;
      let how: 'title' | 'title+year' = 'title';
      if (it.year !== null) {
        const exact = candidates.filter((c) => c.year === it.year);
        if (exact.length === 1) {
          pool = exact;
          how = 'title+year';
        }
      }
      if (pool.length === 1) {
        const c = pool[0];
        let dist: number | null = null;
        if (itemHash) {
          const d = donorHash(c.id, itemHash);
          if (d) {
            dist = d.dist;
            calibration.push(`| ${it.title} | ${it.year ?? '—'} | ${c.year ?? '—'} | ${c.id} | ${d.dist} |`);
          }
        }
        if (dist !== null && itemHash && dist > TITLE_CONFLICT_MAX) {
          const inBand = fullDonorScan(itemHash);
          if (inBand.length === 1) {
            decisions.push({
              kind: 'link',
              item: it,
              target: inBand[0].row.id,
              how: 'hash',
              dist: inBand[0].dist,
              note: `title${how === 'title+year' ? '+year' : ''} "${c.title}" (#${c.id}) hash-conflicted at ${dist} > ${TITLE_CONFLICT_MAX}; full donor scan: UNIQUE identity "${inBand[0].row.title}" (#${inBand[0].row.id}) at dHash ${inBand[0].dist} <= ${MATCH_MAX}`,
            });
            continue;
          }
          decisions.push({
            kind: 'held',
            item: it,
            why: `title${how === 'title+year' ? '+year' : ''} matched "${c.title}" (#${c.id}) but dHash ${dist} > ${TITLE_CONFLICT_MAX} — conflict`,
            detail: `year artpoisk=${it.year ?? '—'} db=${c.year ?? '—'}; full donor scan: ${inBand.length === 0 ? `no donor within ${MATCH_MAX}` : `${inBand.length} donors within ${MATCH_MAX} — ambiguous`}`,
          });
          continue;
        }
        decisions.push({ kind: 'link', item: it, target: c.id, how, dist, note: `disambiguated among ${candidates.length} title twins` });
        continue;
      }
      // hash tiebreak among the title twins
      if (!itemHash) {
        decisions.push({
          kind: 'held',
          item: it,
          why: `${pool.length} title candidates and no hash for ${keyOf(it.slug)} — cannot disambiguate`,
          detail: pool.map((c) => `#${c.id} "${c.title}" (${c.year ?? '—'})`).join('; '),
        });
        continue;
      }
      const scored = pool
        .map((c) => ({ c, d: donorHash(c.id, itemHash) }))
        .filter(
          (s): s is { c: { id: number; title: string; year: number | null }; d: { dist: number; rel: string } } => s.d !== null,
        )
        .sort((a, b) => a.d.dist - b.d.dist);
      if (scored.length === 0) {
        decisions.push({
          kind: 'held',
          item: it,
          why: `${pool.length} title candidates and no candidate donor hash available`,
          detail: pool.map((c) => `#${c.id} "${c.title}" (${c.year ?? '—'})`).join('; '),
        });
        continue;
      }
      const inBand = scored.filter((s) => s.d.dist <= MATCH_MAX);
      if (inBand.length === 1) {
        decisions.push({
          kind: 'link',
          item: it,
          target: inBand[0].c.id,
          how: 'hash',
          dist: inBand[0].d.dist,
          note: `hash disambiguated among ${pool.length} title twins (pairwise ${scored.map((s) => `#${s.c.id}=${s.d.dist}`).join(' ')})`,
        });
        continue;
      }
      decisions.push({
        kind: 'held',
        item: it,
        why:
          inBand.length === 0
            ? `${pool.length} title candidates, nearest dHash ${scored[0].d.dist} > ${MATCH_MAX} — ambiguous`
            : `${inBand.length} title candidates within dHash ${MATCH_MAX} — ambiguous`,
        detail: scored.map((s) => `#${s.c.id} "${s.c.title}" (${s.c.year ?? '—'}) d=${s.d.dist}`).join('; '),
      });
      continue;
    }

    // no title candidate: hash ladder against all donors
    if (!itemHash) {
      decisions.push({
        kind: 'held',
        item: it,
        why: `no title match and no hash for ${keyOf(it.slug)} — cannot verify anything`,
        detail: '',
      });
      continue;
    }
    const all = artRows
      .map((c) => ({ c, d: donorHash(c.id, itemHash) }))
      .filter((s): s is { c: { id: number; title: string; year: number | null }; d: { dist: number; rel: string } } => s.d !== null)
      .sort((a, b) => a.d.dist - b.d.dist);
    const near = all.filter((s) => s.d.dist <= NEAR_MAX).slice(0, 4);
    if (near.length === 0) {
      decisions.push({ kind: 'insert', item: it, note: `nearest donor dHash ${all.length ? all[0].d.dist : 'n/a'} > ${NEAR_MAX}` });
      continue;
    }
    nearNotes.push(
      `- ${it.slug} "${it.title}" (${it.year ?? '—'}) → ${near.map((s) => `#${s.c.id} "${s.c.title}" (${s.c.year ?? '—'}) d=${s.d.dist}`).join('; ')}`,
    );
    const inBand = near.filter((s) => s.d.dist <= MATCH_MAX);
    if (inBand.length === 1) {
      decisions.push({
        kind: 'link',
        item: it,
        target: inBand[0].c.id,
        how: 'hash',
        dist: inBand[0].d.dist,
        note: `no title match; unique donor within dHash ${MATCH_MAX}`,
      });
      continue;
    }
    decisions.push({
      kind: 'held',
      item: it,
      why:
        inBand.length === 0
          ? `no title match, nearest dHash ${near[0].d.dist} in (${MATCH_MAX}, ${NEAR_MAX}] — review`
          : `no title match, ${inBand.length} donors within dHash ${MATCH_MAX} — ambiguous`,
      detail: near.map((s) => `#${s.c.id} "${s.c.title}" (${s.c.year ?? '—'}) d=${s.d.dist}`).join('; '),
    });
  }

  // ---- post-hold adjudications (ITEM_DECISIONS) --------------------------
  // Only ever rewrites a HELD decision — a confident title/hash link is never overridden, so a
  // future better match survives. A map entry matching no scraped item throws (stale map).
  for (const [slug, fix] of Object.entries(ITEM_DECISIONS)) {
    const current = decisions.find((d) => d.item.slug === slug);
    if (!current) throw new Error(`ITEM_DECISIONS entry "${slug}" matches no scraped item — stale map, no fallback`);
    if (current.kind === 'already') continue; // idempotent re-runs: nothing to rewrite
    if (current.kind !== 'held') {
      console.log(`VERDICT-SKIP ${slug} — organic decision is "${current.kind}", confident results are never overridden`);
      continue;
    }
    const idx = decisions.indexOf(current);
    decisions[idx] = {
      kind: 'link',
      item: current.item,
      target: fix.target,
      how: 'text-evidence',
      dist: null,
      note: fix.note,
    };
    console.log(`VERDICT-LINK ${slug} -> #${fix.target} (text-evidence; was held: ${current.why})`);
  }

  const counts = {
    total: doc.items.length,
    already: decisions.filter((d) => d.kind === 'already').length,
    link: decisions.filter((d) => d.kind === 'link').length,
    insert: decisions.filter((d) => d.kind === 'insert').length,
    held: decisions.filter((d) => d.kind === 'held').length,
  };
  const linkBreak = {
    title: decisions.filter((d) => d.kind === 'link' && (d.how === 'title' || d.how === 'title+year')).length,
    hash: decisions.filter((d) => d.kind === 'link' && d.how === 'hash').length,
    text: decisions.filter((d) => d.kind === 'link' && d.how === 'text-evidence').length,
  };

  // ---- write report -----------------------------------------------------
  const lines: string[] = [];
  lines.push(`# Tutunov artpoisk import report (${apply ? 'APPLY' : 'dry'})`);
  lines.push('');
  lines.push(`- source: ${doc.sourcePage}`);
  lines.push(`- items: ${counts.total} — already=${counts.already} link=${counts.link} (title=${linkBreak.title} hash=${linkBreak.hash} text=${linkBreak.text}) insert=${counts.insert} HELD=${counts.held}`);
  lines.push(`- bands: MATCH_MAX=${MATCH_MAX} NEAR_MAX=${NEAR_MAX} TITLE_CONFLICT_MAX=${TITLE_CONFLICT_MAX}`);
  lines.push('');
  lines.push(`## Calibration — title-matched pairs (same work, two different scans)`);
  lines.push('');
  lines.push('| title | artpoisk year | db year | artwork | dHash |');
  lines.push('| --- | --- | --- | --- | --- |');
  lines.push(...(calibration.length ? calibration : ['| (none with hashes) | | | | |']));
  lines.push('');
  lines.push('## LINKED');
  lines.push('');
  for (const d of decisions.filter((x): x is Extract<Decision, { kind: 'link' }> => x.kind === 'link')) {
    lines.push(
      `- ${d.item.slug} "${d.item.title}" (${d.item.year ?? '—'}) -> #${d.target} [${d.how}${d.dist !== null ? ` d=${d.dist}` : ''}] ${d.note}`,
    );
  }
  lines.push('');
  lines.push('## INSERTS');
  lines.push('');
  for (const d of decisions.filter((x): x is Extract<Decision, { kind: 'insert' }> => x.kind === 'insert')) {
    lines.push(
      `- ${d.item.slug} "${d.item.title}" (${d.item.year ?? '—'}${d.item.decade ? ', decade' : ''}) — ${d.item.desc} / ${d.item.collection} — ${d.note}`,
    );
  }
  lines.push('');
  lines.push('## HELD (loud — never silently picked)');
  lines.push('');
  for (const d of decisions.filter((x): x is Extract<Decision, { kind: 'held' }> => x.kind === 'held')) {
    lines.push(`- ${d.item.slug} "${d.item.title}" (${d.item.year ?? '—'}) — ${d.why}${d.detail ? ` — ${d.detail}` : ''}`);
  }
  lines.push('');
  lines.push('## Near-miss notes (no title match, donors within NEAR_MAX — captured for review)');
  lines.push('');
  lines.push(...(nearNotes.length ? nearNotes : ['- (none)']));
  lines.push('');
  lines.push('Notes: artpoisk.info is dead; refs point at the Wayback Machine (2018-12-18 snapshot pages, 238px archived thumbs).');
  lines.push('liveinternet + sovcom works are report-only (no image/ref resolution yet). Refs-only: only URLs stored, images transient in C:\\tmp.');
  writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(
    `PLAN ${apply ? 'apply' : 'dry'}: total=${counts.total} already=${counts.already} title=${linkBreak.title} hash=${linkBreak.hash} text=${linkBreak.text} insert=${counts.insert} HELD=${counts.held} calib=${calibration.length} -> ${REPORT_PATH}`,
  );
  for (const d of decisions.filter((x): x is Extract<Decision, { kind: 'held' }> => x.kind === 'held')) {
    console.log(`HELD ${d.item.slug} — ${d.why}`);
  }
  if (!apply) return;

  // ---- apply ------------------------------------------------------------
  if (counts.held > 0) {
    console.log(`NOTE: ${counts.held} held item(s) stay unlinked/reported — apply proceeds for the rest (loud, by design)`);
  }
  const now = new Date();
  let inserted = 0;
  let linked = 0;
  const newIds: number[] = [];
  for (const d of decisions) {
    if (d.kind === 'already') continue;
    if (d.kind === 'held') continue;
    const it = d.item;
    const ext = EXT_PREFIX + it.slug;
    if (d.kind === 'link') {
      await upsertArtworkSource({
        artworkId: d.target,
        provider: PROVIDER,
        externalId: ext,
        sourceUrl: it.detailUrl,
        imageUrl: it.thumbUrl,
        title: it.title,
        isPrimary: false,
        lastSyncedAt: now,
      });
      linked += 1;
      console.log(`LINK ${it.slug} -> #${d.target} (${d.how})`);
      continue;
    }
    const existingTitles = new Set(artRows.map((r) => r.title));
    let title = it.title;
    if (existingTitles.has(title)) {
      title = `${it.title} (${it.slug})`;
      console.log(`TITLE-SUFFIX ${it.slug} "${it.title}" -> "${title}" (identifier suffix, never invented words)`);
    }
    const [row] = await db
      .insert(artworks)
      .values({
        artistId: artist.id,
        provider: PROVIDER,
        externalId: ext,
        title,
        year: it.year,
        imageUrl: it.thumbUrl,
        paintingUrl: it.detailUrl,
        metadata: {
          yearText: it.yearText,
          decade: it.decade,
          desc: it.desc,
          collection: it.collection,
          imageId: it.imageId,
          originalDetailUrl: it.originalDetailUrl,
          originalThumbUrl: it.originalThumbUrl,
          sourcePage: doc.sourcePage,
        },
        lastSyncedAt: now,
      })
      .returning({ id: artworks.id });
    if (!row) throw new Error(`insert returned no row for ${it.slug} — no fallback`);
    artRows.push({ id: row.id, title, year: it.year });
    newIds.push(row.id);
    await upsertArtworkSource({
      artworkId: row.id,
      provider: PROVIDER,
      externalId: ext,
      sourceUrl: it.detailUrl,
      imageUrl: it.thumbUrl,
      title,
      isPrimary: true,
      lastSyncedAt: now,
    });
    inserted += 1;
    console.log(`INSERT #${row.id} ${it.slug} — "${title}" (${it.year ?? 'no year'})`);
  }

  const totalPost = await db.select({ id: artworks.id }).from(artworks).where(eq(artworks.artistId, artist.id));
  if (totalPost.length !== artRows.length) {
    throw new Error(`post-apply artwork count mismatch: db=${totalPost.length} expected=${artRows.length} — no fallback`);
  }
  const dupTitles = new Set<string>();
  const seenTitles = new Set<string>();
  for (const r of artRows) {
    const key = r.title;
    if (seenTitles.has(key)) dupTitles.add(key);
    seenTitles.add(key);
  }
  if (dupTitles.size) throw new Error(`duplicate artwork titles after apply: ${[...dupTitles].join(' | ')}`);
  console.log(`APPLY done: inserted=${inserted} linked=${linked} already=${counts.already} held=${counts.held} artworkCount=${artRows.length}`);
  if (newIds.length) console.log(`NEW-IDS ${newIds.join(',')}`);
}

// ---- main -----------------------------------------------------------------

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'parse') parse();
  else if (mode === 'urls') urls();
  else if (mode === 'hash') await hash();
  else if (mode === 'import') await runImport();
  else throw new Error(`unknown mode "${mode ?? ''}" — use parse | urls | hash | import [--apply]`);
}

main().catch((err) => {
  console.error(`FATAL ${(err as Error).message}`);
  process.exit(1);
});
