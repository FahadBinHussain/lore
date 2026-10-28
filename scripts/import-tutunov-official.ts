// Official-site importer: tutunov.org -> artist 'sergey-tutunov' + artworks + artwork_external_ids.
// The official gallery is the base inventory: every gallery item inserts (artwork rows stay canonical).
// Official-official same-work twins (identical scans published under two files / repeated crops)
// collapse to a lead + `official-same` links (isPrimary:false). Suspect pairs (TWIN_MAX < d <= SUSPECT_MAX)
// block --apply until adjudicated in PAIR_DECISIONS with a written reason. Downloads images only
// transiently for dHash (C:\tmp) and stores URLs — refs-only rule holds.
// Run: esbuild bundle -> `node --env-file=.env --env-file=.env.local <bundle>.cjs <mode> [--apply]`
// Modes: seed | scrape | urls | hash | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { and, eq, sql } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://tutunov.org';
const KARTINY_URL = `${SITE}/%d0%ba%d0%b0%d1%80%d1%82%d0%b8%d0%bd%d1%8b/`;
const BIO_URL = `${SITE}/%d0%b1%d0%b8%d0%be%d0%b3%d1%80%d0%b0%d1%84%d0%b8%d1%8f/`;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ARTIST_PROVIDER = 'official';
const ARTIST_EXTERNAL_ID = 'sergey-tutunov';
const ARTIST_SLUG = 'sergey-tutunov';
const ARTIST_NAME = 'Sergey Tutunov';
const EXT_PREFIX = 'tutunov:';

// Main-page tile display order (data-alb_gal_id). Names are read from the page, never hardcoded.
const ALBUM_ORDER = [7, 8, 12, 11, 9, 10];

const SCRAPE_PATH = 'C:/tmp/tutunov-official-scrape.json';
const HASH_IN = 'C:/tmp/tutunov-hash-input.json';
const HASH_STATE = 'C:/tmp/tutunov-hashes.json';
const HASH_JOBS = 'C:/tmp/tutunov-hash-jobs.json';
const HASH_JOBS_OUT = 'C:/tmp/tutunov-hash-out.json';
const HASH_CACHE = 'C:/tmp/tutunov-hash-cache';
const HASH_PS1 = 'scripts/import-schikaneder-hash.ps1';
const REPORT_PATH = 'C:/tmp/tutunov-official-import-report.md';

const TWIN_MAX = 3; // <= this = same-work twin (lead + official-same link)
const SUSPECT_MAX = 8; // (TWIN_MAX, SUSPECT_MAX] = blocks --apply until adjudicated in PAIR_DECISIONS
const NEAR_PRINT_MAX = 12; // printed for review only

// One written verdict per adjudicated suspect pair (key "relA||relB" in scrape order).
// 'same' merges the pair; 'distinct' keeps both. Never a heuristic — only filled after inspection.
const PAIR_DECISIONS: Record<string, { kind: 'same' | 'distinct'; why: string }> = {
  // vision-verified 2026-10-16 by side-by-side read of the downloaded JPEGs (refs-only, transient).
  'Kartini/Portret/Миша (портрет М.А.Трубецкого).jpg||Kartini/Portret/Портрет Юры Иванова.jpg': {
    kind: 'distinct',
    why: 'different paintings: Миша (1983, Х.М. 48Х64) is a shorter-haired fuller-faced man with the head tilted in a near-black field; Портрет Юры Иванова (1981, К.М. 70Х50) has long shoulder-length wavy hair, a thinner face, lighter brown ground and crossed arms with a hand visible bottom-right. dHash 7 is a frontal-portrait composition collision, not a twin.',
  },
};

type ScrapeItem = {
  rel: string;
  imageId: string;
  url: string;
  caption: string;
  albumId: number;
  albumName: string;
  albumUrl: string;
};
type ScrapeAlbum = { id: number; name: string; url: string; pages: number; count: number };
type ScrapeDoc = { scrapedAt: string; albums: ScrapeAlbum[]; items: ScrapeItem[] };
type ParsedCaption = { title: string | null; year: number | null; years: number[]; unpairedQuote: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string): Promise<string> {
  const backoff = [0, 1500, 5000, 12000];
  let lastErr = '';
  for (const wait of backoff) {
    if (wait) await sleep(wait);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return await r.text();
      lastErr = `HTTP ${r.status}`;
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`fetch FAILED ${url} — ${lastErr} (no fallback)`);
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

function relFromHref(href: string): string {
  const marker = '/photo-gallery/';
  const i = href.indexOf(marker);
  if (i < 0) throw new Error(`item href without ${marker}: ${href}`);
  const rel = decodeURIComponent(href.slice(i + marker.length).split('?')[0]);
  if (rel.startsWith('thumb/') || rel.includes('/thumb/')) throw new Error(`thumb URL leaked into items: ${href}`);
  if (!rel) throw new Error(`empty rel after ${marker}: ${href}`);
  return rel;
}

// Year = LAST bounded 4-digit year token (range END per the standing rule; multi-year tokens are
// collected for review). Title = caption up to the FIRST year token; a leading quote pair is removed
// (first pair only) so `"Title" rest 1959` keeps its clarifying `rest` without the wrapping quotes.
function parseCaption(caption: string): ParsedCaption {
  const years: number[] = [];
  let firstIdx = -1;
  const re = /(?<!\d)(19\d{2}|20[0-2]\d)(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caption))) {
    if (firstIdx < 0) firstIdx = m.index;
    years.push(Number(m[1]));
  }
  const year = years.length ? years[years.length - 1] : null;
  let pre = firstIdx < 0 ? caption.trim() : caption.slice(0, firstIdx).trim();
  pre = pre.replace(/[\s.,;:]+$/g, '').trim();
  let unpairedQuote = false;
  if (pre.startsWith('"')) {
    const close = pre.indexOf('"', 1);
    if (close > 0) {
      pre = `${pre.slice(1, close)}${pre.slice(close + 1)}`.replace(/\s+/g, ' ').trim();
    } else {
      unpairedQuote = true;
    }
  }
  // The site occasionally writes the medium code BEFORE the year (`"Снежные вершины" К.М. 1950`,
  // `... Прощание" »Х.К.М. 1950`, `... У окна" К 1960 г.г. К.М.`), so it lands inside the pre-year
  // title fragment. Strip that trailing fragment only (Cyrillic + Latin homoglyphs, optional `»`).
  pre = pre.replace(/\s+["»]?\s*[ХКXK](?:\.[\s]*(?:Х|К|М|X|K|M)){0,3}\.?\s*$/u, '').replace(/[\s.,;:]+$/g, '').trim();
  return { title: pre || null, year, years, unpairedQuote };
}

function dhashDistance(a: string, b: string): number {
  if (a.length !== 64 || b.length !== 64) {
    throw new Error(`bad hash lengths ${a.length}/${b.length} — expected 64 binary chars (nibble-loop bug guard)`);
  }
  let d = 0;
  for (let i = 0; i < 64; i += 1) if (a[i] !== b[i]) d += 1;
  return d;
}

function keyOf(rel: string): string {
  return `o:${rel}`;
}

function loadScrape(): ScrapeDoc {
  if (!existsSync(SCRAPE_PATH)) throw new Error(`scrape missing ${SCRAPE_PATH} — run scrape first, no fallback`);
  return JSON.parse(readFileSync(SCRAPE_PATH, 'utf8')) as ScrapeDoc;
}

function albumUrlOf(id: number, page = 1): string {
  let u = `${KARTINY_URL}?type_0=gallery&album_gallery_id_0=${id}`;
  if (page > 1) u += `&page_number_0=${page}`;
  return u;
}

function parseAlbumNames(html: string): Map<number, string> {
  const map = new Map<number, string>();
  const re = /data-alb_gal_id="(\d+)"[^>]*?data-title="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = Number(m[1]);
    const name = decodeEntities(m[2]).trim();
    if (name && !map.has(id)) map.set(id, name);
  }
  return map;
}

function parseAlbumItems(html: string, album: { id: number; name: string; url: string }): ScrapeItem[] {
  const opens = [...html.matchAll(/<a\s[^>]*bwg_lightbox[^>]*>/g)];
  const items: ScrapeItem[] = [];
  for (let k = 0; k < opens.length; k += 1) {
    const open = opens[k];
    if (open.index === undefined) throw new Error('regex match without index — cannot slice item segment');
    const start = open.index;
    const next = opens[k + 1];
    const end = next && next.index !== undefined ? next.index : Math.min(html.length, start + 4000);
    const seg = html.slice(start, end);
    const hrefM = open[0].match(/\shref="([^"]+)"/);
    if (!hrefM) throw new Error(`item anchor without href: ${open[0].slice(0, 140)}`);
    const href = decodeEntities(hrefM[1]).split('?')[0];
    const idM = open[0].match(/\sdata-image-id="(\d+)"/);
    let caption = '';
    const imgM = seg.match(/<img\s[^>]*>/);
    if (imgM) {
      const altM = imgM[0].match(/\salt="([^"]*)"/);
      if (altM && altM[1].trim()) caption = decodeEntities(altM[1]);
    }
    if (!caption) {
      const t2 = seg.match(/<div class="bwg-title2">([\s\S]*?)<\/div>/);
      if (t2) caption = decodeEntities(t2[1].replace(/<[^>]+>/g, ' '));
    }
    caption = caption.replace(/\s+/g, ' ').trim();
    items.push({
      rel: relFromHref(href),
      imageId: idM ? idM[1] : '',
      url: href,
      caption,
      albumId: album.id,
      albumName: album.name,
      albumUrl: album.url,
    });
  }
  return items;
}

async function scrape(): Promise<void> {
  const main = await fetchText(KARTINY_URL);
  const names = parseAlbumNames(main);
  const missing = ALBUM_ORDER.filter((id) => !names.has(id));
  if (missing.length) {
    throw new Error(`album names missing on main page for ids ${missing.join(',')} — markup changed, no fallback`);
  }
  const albums: ScrapeAlbum[] = [];
  const all: ScrapeItem[] = [];
  const seen = new Map<string, ScrapeItem>();
  for (const id of ALBUM_ORDER) {
    const name = names.get(id) as string;
    const url = albumUrlOf(id);
    let html = await fetchText(url);
    const pagesVals = [...html.matchAll(/data-pages-count="(\d+)"/g)].map((m) => Number(m[1]));
    if (pagesVals.some((n) => !Number.isFinite(n) || n < 1)) throw new Error(`bad pages count for album ${id}`);
    const pages = pagesVals.length ? pagesVals[0] : 1;
    if (pagesVals.some((n) => n !== pages)) {
      throw new Error(`conflicting data-pages-count values for album ${id}: ${pagesVals.join(',')} — no fallback`);
    }
    const albumMeta: ScrapeAlbum = { id, name, url, pages, count: 0 };
    const albumItems: ScrapeItem[] = [];
    for (let p = 1; p <= pages; p += 1) {
      if (p > 1) {
        await sleep(400);
        html = await fetchText(albumUrlOf(id, p));
        const cur = html.match(/name="bwg_current_page" value="(\d+)"/);
        if (!cur || Number(cur[1]) !== p) {
          throw new Error(
            `page param did not switch album ${id} to page ${p} (current=${cur ? cur[1] : 'n/a'}) — no fallback`,
          );
        }
      }
      albumItems.push(...parseAlbumItems(html, albumMeta));
    }
    if (pages > 1) {
      const lastVals = [...html.matchAll(/data-pages-count="(\d+)"/g)].map((m) => Number(m[1]));
      if (!lastVals.length || lastVals.some((n) => n !== pages)) {
        throw new Error(`last page of album ${id} reports pages=${lastVals.join(',')} — expected ${pages}, no fallback`);
      }
    }
    const local = new Set<string>();
    for (const it of albumItems) {
      if (local.has(it.rel)) throw new Error(`duplicate rel within album ${id}: ${it.rel}`);
      local.add(it.rel);
    }
    albumMeta.count = albumItems.length;
    albums.push(albumMeta);
    for (const it of albumItems) {
      const prev = seen.get(it.rel);
      if (prev) {
        console.log(
          `ALBUM-OVERLAP ${it.rel} — first in album ${prev.albumId} (${prev.albumName}), repeated in album ${it.albumId} (${it.albumName}) — keeping first`,
        );
        continue;
      }
      seen.set(it.rel, it);
      all.push(it);
    }
  }
  const parsed = all.map((it) => ({ it, p: parseCaption(it.caption) }));
  const noCaption = all.filter((it) => !it.caption).map((it) => it.rel);
  const yearless = parsed.filter((x) => x.p.year === null).map((x) => `${x.it.rel} — "${x.it.caption}"`);
  const multiYear = parsed
    .filter((x) => x.p.years.length > 1)
    .map((x) => `${x.it.rel} — years ${x.p.years.join(',')} — "${x.it.caption}"`);
  const unpaired = parsed.filter((x) => x.p.unpairedQuote).map((x) => `${x.it.rel} — "${x.it.caption}"`);
  const doc: ScrapeDoc = { scrapedAt: new Date().toISOString(), albums, items: all };
  writeFileSync(SCRAPE_PATH, JSON.stringify(doc, null, 2), 'utf8');
  for (const a of albums) console.log(`ALBUM ${a.id} ${a.name} pages=${a.pages} items=${a.count}`);
  console.log(
    `SCRAPE done: items=${all.length} noCaption=${noCaption.length} yearless=${yearless.length} multiYear=${multiYear.length} -> ${SCRAPE_PATH}`,
  );
  for (const s of noCaption) console.log(`NO-CAPTION ${s} — title falls back to the rel identifier`);
  for (const s of yearless) console.log(`NO-YEAR ${s}`);
  for (const s of multiYear) console.log(`MULTI-YEAR ${s}`);
  for (const s of unpaired) console.log(`QUOTE-UNPAIRED ${s}`);
  if (all.length < 140) {
    throw new Error(`scraped only ${all.length} items — pagination regression (expected > 140); no fallback`);
  }
}

function urls(): void {
  const doc = loadScrape();
  const input = doc.items.map((it) => ({ key: keyOf(it.rel), url: it.url }));
  writeFileSync(HASH_IN, JSON.stringify(input, null, 2), 'utf8');
  console.log(`URLS done: items=${input.length} -> ${HASH_IN}`);
}

async function hash(): Promise<void> {
  if (!existsSync(HASH_IN)) throw new Error(`hash input missing ${HASH_IN} — run urls first, no fallback`);
  const input = JSON.parse(readFileSync(HASH_IN, 'utf8')) as { key: string; url: string }[];
  const state = existsSync(HASH_STATE)
    ? (JSON.parse(readFileSync(HASH_STATE, 'utf8')) as Record<string, string | null>)
    : {};
  const missing = input.filter((e) => state[e.key] === undefined);
  mkdirSync(HASH_CACHE, { recursive: true });
  const cacheFile = (key: string) => join(HASH_CACHE, `${createHash('sha1').update(key).digest('hex').slice(0, 20)}.img`);
  const failedDl: string[] = [];
  for (const e of missing) {
    const file = cacheFile(e.key);
    if (existsSync(file)) continue;
    let ok = false;
    let lastErr = '';
    for (const wait of [0, 8000, 20000, 40000]) {
      if (wait) await sleep(wait);
      try {
        const r = await fetch(e.url, { headers: { 'User-Agent': UA } });
        if (!r.ok) {
          lastErr = `HTTP ${r.status}`;
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 500) {
          lastErr = `too small (${buf.length}b)`;
          continue;
        }
        writeFileSync(file, buf);
        ok = true;
        break;
      } catch (err) {
        lastErr = (err as Error).message;
      }
    }
    if (!ok) failedDl.push(`${e.key} — ${lastErr}`);
    await sleep(350);
  }
  if (failedDl.length) {
    console.error(`DOWNLOAD FAILURES ${failedDl.length}/${missing.length}:`);
    for (const f of failedDl) console.error(`  ${f}`);
    throw new Error('image downloads FAILED — completed downloads persisted, re-run after cooldown, no fallback');
  }
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
}

function extractBio(html: string): { text: string; markerFound: boolean } {
  const m = html.match(/<div class="entry-content"[^>]*>/);
  if (!m || m.index === undefined) {
    throw new Error('bio page: entry-content div not found — markup changed, no fallback');
  }
  let body = html.slice(m.index + m[0].length);
  const cut = body.search(/<\/article>|<div id="comments"/);
  if (cut > 0) body = body.slice(0, cut);
  const text = body
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((l) => decodeEntities(l).replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  const marker = text.indexOf('Виктор Сергеевич');
  const markerFound = marker > 0;
  return { text: markerFound ? text.slice(0, marker).trim() : text.trim(), markerFound };
}

async function seed(): Promise<void> {
  const bioHtml = await fetchText(BIO_URL);
  if (!bioHtml.includes('Тутунов') || !bioHtml.includes('1925')) {
    throw new Error('bio page fetched but does not look like the Tutunov biography — no fallback');
  }
  const { text: bio, markerFound } = extractBio(bioHtml);
  if (!markerFound) console.log('BIO-MARKER-MISSING — byline marker not found; storing the whole entry-content text');
  const pm = bioHtml.match(/https?:\/\/[^"']*img436-1(?:-\d+x\d+)?\.jpg/);
  if (!pm) throw new Error('bio page: img436-1.jpg (chosen portrait file) not found — no fallback');
  const portrait = pm[0].replace(/^http:/, 'https:').replace(/-\d+x\d+(\.jpg)$/, '$1');
  const [existing] = await db
    .select()
    .from(artists)
    .where(and(eq(artists.provider, ARTIST_PROVIDER), eq(artists.externalId, ARTIST_EXTERNAL_ID)));
  if (existing) {
    console.log(
      `SEED: artist already exists id=${existing.id} slug=${existing.slug} name=${existing.name} imageUrl=${existing.imageUrl ?? 'null'} bio=${existing.biography?.length ?? 0}ch`,
    );
    if (existing.slug !== ARTIST_SLUG || existing.name !== ARTIST_NAME) {
      throw new Error(`artist drift: slug=${existing.slug} name=${existing.name}`);
    }
    return;
  }
  const [row] = await db
    .insert(artists)
    .values({
      provider: ARTIST_PROVIDER,
      externalId: ARTIST_EXTERNAL_ID,
      slug: ARTIST_SLUG,
      name: ARTIST_NAME,
      imageUrl: portrait,
      biography: bio,
      birthYear: 1925,
      deathYear: 1998,
      sourceUrl: `${SITE}/`,
      metadata: {
        wikidata: 'Q60194797',
        nativeName: 'Тутунов Сергей Андреевич',
        aliases: [
          'Сергей Тутунов',
          'Сергей Андреевич Тутунов',
          'Sergei Tutunov',
          'Sergey Andreevich Tutunov',
        ],
        wikiRu: 'https://ru.wikipedia.org/wiki/Тутунов,_Сергей_Андреевич',
        officialSite: `${SITE}/`,
        biographySource: BIO_URL,
        biographyAuthor: 'Виктор Сергеевич Тутунов (ноябрь 2008) — мемуар на официальном сайте, обрезан по подписи автора',
        portraitNote:
          'official bio page photo img436-1.jpg; caption: «С.А.Тутунов и А.А. Тутунов около барака на «Пышкином огороде» (первая половина 1950 г.г.)»',
      },
      lastSyncedAt: new Date(),
    })
    .returning({ id: artists.id });
  if (!row) throw new Error('artist insert returned no row — no fallback');
  const [check] = await db
    .select({ id: artists.id, slug: artists.slug, name: artists.name, imageUrl: artists.imageUrl })
    .from(artists)
    .where(eq(artists.id, row.id));
  console.log(
    `SEEDED artist id=${row.id} slug=${ARTIST_SLUG} bio=${bio.length}ch portrait=${portrait} readback=${JSON.stringify(check)}`,
  );
}

async function importMode(apply: boolean): Promise<void> {
  const doc = loadScrape();
  const state: Record<string, string | null> = existsSync(HASH_STATE)
    ? (JSON.parse(readFileSync(HASH_STATE, 'utf8')) as Record<string, string | null>)
    : {};
  const [artist] = await db
    .select()
    .from(artists)
    .where(and(eq(artists.provider, ARTIST_PROVIDER), eq(artists.externalId, ARTIST_EXTERNAL_ID)));
  if (!artist) throw new Error(`artist ${ARTIST_PROVIDER}/${ARTIST_EXTERNAL_ID} missing — run seed first, no fallback`);
  if (artist.slug !== ARTIST_SLUG) throw new Error(`artist slug drift: expected ${ARTIST_SLUG}, found ${artist.slug}`);

  const items = doc.items;
  const existing = await db
    .select({ id: artworks.id, externalId: artworks.externalId, title: artworks.title })
    .from(artworks)
    .where(eq(artworks.artistId, artist.id));
  const existingByExt = new Map(existing.map((r) => [r.externalId, r]));

  const noHash: string[] = [];
  const hashes: (string | null)[] = items.map((it) => {
    const v = state[keyOf(it.rel)];
    if (v === undefined) {
      noHash.push(`${it.rel} — NOT-HASHED (run urls+hash)`);
      return null;
    }
    if (v === null) {
      noHash.push(`${it.rel} — UNREADABLE image`);
      return null;
    }
    return v;
  });

  // ---- pair measurement -------------------------------------------------
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = hashes[i];
      const b = hashes[j];
      if (!a || !b) continue;
      pairs.push({ i, j, d: dhashDistance(a, b) });
    }
  }
  const pairKey = (i: number, j: number) => `${items[i].rel}||${items[j].rel}`;
  // stale PAIR_DECISIONS guard — every key must exist in the current scrape
  for (const k of Object.keys(PAIR_DECISIONS)) {
    const [a, b] = k.split('||');
    if (!items.some((it) => it.rel === a) || !items.some((it) => it.rel === b)) {
      throw new Error(`stale PAIR_DECISIONS key not in scrape: ${k}`);
    }
  }
  const sameEdges: { i: number; j: number; d: number }[] = [];
  const unresolved: { i: number; j: number; d: number }[] = [];
  const resolvedDistinct: { i: number; j: number; d: number }[] = [];
  for (const p of pairs) {
    if (p.d > SUSPECT_MAX) continue;
    const dec = PAIR_DECISIONS[pairKey(p.i, p.j)];
    if (dec?.kind === 'same') sameEdges.push(p);
    else if (dec?.kind === 'distinct') resolvedDistinct.push(p);
    else if (p.d > TWIN_MAX) unresolved.push(p);
  }
  const nearPairs = pairs.filter((p) => p.d > SUSPECT_MAX && p.d <= NEAR_PRINT_MAX);

  // union-find, edges = d <= TWIN_MAX or an adjudicated 'same'
  const parent = items.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (x: number, y: number) => {
    parent[find(x)] = find(y);
  };
  for (const p of pairs) if (p.d <= TWIN_MAX) union(p.i, p.j);
  for (const p of sameEdges) union(p.i, p.j);
  const comps = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    const arr = comps.get(r) ?? [];
    arr.push(i);
    comps.set(r, arr);
  });
  const clusters = [...comps.values()].filter((c) => c.length > 1).sort((a, b) => a[0] - b[0]);
  const followerOf = new Map<number, number>();
  const clusterLines: string[] = [];
  for (const c of clusters) {
    const lead = c[0];
    let maxd = 0;
    for (const i of c) for (const j of c) if (i < j) maxd = Math.max(maxd, dhashDistance(hashes[i] as string, hashes[j] as string));
    for (const idx of c.slice(1)) followerOf.set(idx, lead);
    clusterLines.push(
      `CLUSTER lead=${items[lead].rel} members=${c.length} maxd=${maxd} — ${c.map((i) => items[i].rel).join(' + ')}`,
    );
  }
  for (const l of clusterLines) console.log(l);

  // ---- titles -----------------------------------------------------------
  const parsed: ParsedCaption[] = items.map((it) => parseCaption(it.caption));
  const titles = parsed.map((p, i) => p.title ?? items[i].rel);
  const counts = new Map<string, number>();
  for (const r of existing) counts.set(r.title, (counts.get(r.title) ?? 0) + 1);
  const canonIdx = items
    .map((_, i) => i)
    .filter((i) => !followerOf.has(i) && !existingByExt.has(EXT_PREFIX + items[i].rel));
  for (const i of canonIdx) counts.set(titles[i], (counts.get(titles[i]) ?? 0) + 1);
  const titleDups: string[] = [];
  for (const i of canonIdx) {
    if ((counts.get(titles[i]) ?? 0) > 1) {
      titles[i] = `${titles[i]} (${items[i].rel})`;
      titleDups.push(`${items[i].rel} — title suffixed with the rel identifier: "${titles[i]}"`);
    }
  }
  // final uniqueness assert over existing + planned canonical titles
  const finalCounts = new Map<string, number>();
  for (const r of existing) finalCounts.set(r.title, (finalCounts.get(r.title) ?? 0) + 1);
  for (const i of canonIdx) finalCounts.set(titles[i], (finalCounts.get(titles[i]) ?? 0) + 1);
  for (const [t, c] of finalCounts) {
    if (c > 1) throw new Error(`title still duplicated after suffixing: "${t}" x${c} — no fallback`);
  }

  const yearless = parsed
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p.year === null)
    .map((x) => `${items[x.i].rel} — "${items[x.i].caption}"`);
  const multiYear = parsed
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p.years.length > 1)
    .map((x) => `${items[x.i].rel} — years ${x.p.years.join(',')} — "${items[x.i].caption}"`);
  const unpaired = parsed
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p.unpairedQuote)
    .map((x) => `${items[x.i].rel} — "${items[x.i].caption}"`);
  const noCaption = items.filter((it) => !it.caption).map((it) => it.rel);

  // ---- plan -------------------------------------------------------------
  const resolvesToExisting = (rel: string) => existingByExt.has(EXT_PREFIX + rel);
  let insertsPlanned = 0;
  let followersPlanned = 0;
  let already = 0;
  const insertLines: string[] = [];
  const followerLines: string[] = [];
  for (let i = 0; i < items.length; i += 1) {
    if (resolvesToExisting(items[i].rel)) {
      already += 1;
      continue;
    }
    if (followerOf.has(i)) {
      followersPlanned += 1;
      followerLines.push(
        `FOLLOW ${items[i].rel} -> ${items[followerOf.get(i) as number].rel} (same work, second file)`,
      );
      continue;
    }
    insertsPlanned += 1;
    insertLines.push(`INSERT ${items[i].rel} — "${titles[i]}" (${parsed[i].year ?? 'no year'}) [${items[i].albumName}]`);
  }

  // ---- report -----------------------------------------------------------
  const report: string[] = [];
  report.push('# tutunov.org ingest report');
  report.push(`- date: ${new Date().toISOString()}`);
  report.push(`- mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  report.push(`- artist: ${artist.id} ${artist.name} (${artist.provider}/${artist.externalId})`);
  report.push(
    `- scraped items: ${items.length} (${doc.albums.map((a) => `${a.id} ${a.name}=${a.count}`).join(', ')})`,
  );
  report.push(`- existing official rows: ${existing.length}`);
  report.push(`- plan: inserts=${insertsPlanned} followers=${followersPlanned} already=${already}`);
  report.push(`- bands: TWIN_MAX=${TWIN_MAX} SUSPECT(${TWIN_MAX},${SUSPECT_MAX}] NEAR(${SUSPECT_MAX},${NEAR_PRINT_MAX}]`);
  report.push(`- clusters=${clusters.length} unresolvedSuspects=${unresolved.length} nearPairs=${nearPairs.length}`);
  report.push('');
  report.push('## Clusters (same-work twins -> lead + official-same)');
  report.push(...(clusterLines.length ? clusterLines : ['none']));
  report.push('');
  report.push('## Unresolved suspect pairs (block --apply until adjudicated in PAIR_DECISIONS)');
  report.push(...(unresolved.length ? unresolved.map((p) => `SUSPECT ${pairKey(p.i, p.j)} d=${p.d}`) : ['none']));
  report.push('');
  report.push('## Adjudicated distinct (kept apart)');
  report.push(...(resolvedDistinct.length ? resolvedDistinct.map((p) => `DISTINCT ${pairKey(p.i, p.j)} d=${p.d} — ${PAIR_DECISIONS[pairKey(p.i, p.j)]?.why ?? ''}`) : ['none']));
  report.push('');
  report.push('## Near pairs (review only, both sides insert)');
  report.push(...(nearPairs.length ? nearPairs.map((p) => `NEAR ${pairKey(p.i, p.j)} d=${p.d}`) : ['none']));
  report.push('');
  report.push('## Title duplicates (suffixed with rel identifier)');
  report.push(...(titleDups.length ? titleDups : ['none']));
  report.push('');
  report.push('## All planned inserts');
  report.push(...insertLines);
  report.push('');
  report.push('## Followers (official-same links)');
  report.push(...(followerLines.length ? followerLines : ['none']));
  report.push('');
  report.push('## Captions with no year');
  report.push(...(yearless.length ? yearless : ['none']));
  report.push('');
  report.push('## Captions with multiple year tokens (year = LAST)');
  report.push(...(multiYear.length ? multiYear : ['none']));
  report.push('');
  report.push('## Captions with an unpaired opening quote (kept verbatim)');
  report.push(...(unpaired.length ? unpaired : ['none']));
  report.push('');
  report.push('## Items with no caption (title = rel identifier)');
  report.push(...(noCaption.length ? noCaption : ['none']));
  report.push('');
  report.push('## Items without a usable hash (twin detection blind for these)');
  report.push(...(noHash.length ? noHash : ['none']));
  writeFileSync(REPORT_PATH, `${report.join('\n')}\n`, 'utf8');
  console.log(`REPORT -> ${REPORT_PATH}`);
  console.log(
    `PLAN inserts=${insertsPlanned} followers=${followersPlanned} already=${already} clusters=${clusters.length} suspects=${unresolved.length} near=${nearPairs.length} titleDup=${titleDups.length} noHash=${noHash.length}`,
  );

  if (!apply) {
    if (unresolved.length) {
      console.log('DRY-RUN — apply is BLOCKED until every suspect pair is adjudicated in PAIR_DECISIONS');
    } else {
      console.log('DRY-RUN — re-run with --apply to write');
    }
    return;
  }
  if (unresolved.length) {
    throw new Error(`${unresolved.length} unresolved suspect pair(s) — adjudicate in PAIR_DECISIONS before --apply (no fallback)`);
  }

  // ---- apply ------------------------------------------------------------
  const now = new Date();
  const resolvedIds = new Map<string, number>();
  for (const [ext, row] of existingByExt) resolvedIds.set(ext.replace(EXT_PREFIX, ''), row.id);
  let inserted = 0;
  let attached = 0;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const ext = EXT_PREFIX + it.rel;
    if (resolvesToExisting(it.rel)) continue;
    const leadIdx = followerOf.get(i);
    if (leadIdx === undefined) {
      const [row] = await db
        .insert(artworks)
        .values({
          artistId: artist.id,
          provider: ARTIST_PROVIDER,
          externalId: ext,
          title: titles[i],
          year: parsed[i].year,
          imageUrl: it.url,
          paintingUrl: it.albumUrl,
          metadata: {
            album: it.albumName,
            albumId: it.albumId,
            imageId: it.imageId || null,
            caption: it.caption || null,
          },
          lastSyncedAt: now,
        })
        .returning({ id: artworks.id });
      if (!row) throw new Error(`insert returned no row for ${it.rel} — no fallback`);
      resolvedIds.set(it.rel, row.id);
      inserted += 1;
      await upsertArtworkSource({
        artworkId: row.id,
        provider: ARTIST_PROVIDER,
        externalId: ext,
        sourceUrl: it.albumUrl,
        imageUrl: it.url,
        title: titles[i],
        isPrimary: true,
        lastSyncedAt: now,
      });
      console.log(`INSERT #${row.id} ${it.rel} — "${titles[i]}" (${parsed[i].year ?? 'no year'})`);
      // attach this lead's followers right away
      for (const [fIdx, lead] of followerOf) {
        if (lead !== i) continue;
        const fIt = items[fIdx];
        await upsertArtworkSource({
          artworkId: row.id,
          provider: ARTIST_PROVIDER,
          externalId: EXT_PREFIX + fIt.rel,
          sourceUrl: fIt.albumUrl,
          imageUrl: fIt.url,
          title: parsed[fIdx].title ?? fIt.rel,
          isPrimary: false,
          lastSyncedAt: now,
        });
        attached += 1;
        console.log(`OFFICIAL-SAME ${fIt.rel} -> #${row.id} (${items[lead].rel})`);
      }
    } else {
      const leadRel = items[leadIdx].rel;
      const leadId = resolvedIds.get(leadRel);
      if (!leadId) throw new Error(`follower ${it.rel}: lead ${leadRel} has no resolved artwork id — no fallback`);
      await upsertArtworkSource({
        artworkId: leadId,
        provider: ARTIST_PROVIDER,
        externalId: ext,
        sourceUrl: it.albumUrl,
        imageUrl: it.url,
        title: parsed[i].title ?? it.rel,
        isPrimary: false,
        lastSyncedAt: now,
      });
      attached += 1;
      console.log(`OFFICIAL-SAME ${it.rel} -> #${leadId} (${leadRel})`);
    }
  }
  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(artworks)
    .where(eq(artworks.artistId, artist.id));
  const total = countRow?.c ?? 0;
  await db
    .update(artists)
    .set({ artworkCount: total, lastSyncedAt: now, updatedAt: now })
    .where(eq(artists.id, artist.id));
  const expected = existing.length + inserted;
  if (total !== expected) throw new Error(`post-apply count mismatch: total=${total} expected=${expected} — investigate`);
  console.log(`APPLY done: inserted=${inserted} followersAttached=${attached} already=${already} artworkCount=${total}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const apply = process.argv.includes('--apply');
  switch (mode) {
    case 'seed':
      await seed();
      break;
    case 'scrape':
      await scrape();
      break;
    case 'urls':
      urls();
      break;
    case 'hash':
      await hash();
      break;
    case 'import':
      await importMode(apply);
      break;
    default:
      console.log('usage: <bundle>.cjs seed | scrape | urls | hash | import [--apply]');
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(`FAILED: ${(e as Error).message}`);
  process.exit(1);
});
