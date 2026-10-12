// Official-site importer: simonstalenhag.se -> artworks + artwork_external_ids.
// Matching rule (AGENTS "Artwork multi-source backing"): exact normalized title+year first,
// then transient dHash; ambiguous/near results are held and reported loudly, never guessed.
// Downloads images only transiently for hashing (C:\tmp) and stores URLs — refs-only rule holds.
// Run: esbuild bundle -> `node --env-file=.env --env-file=.env.local <bundle>.cjs <mode>`
// Modes: scrape | urls | hash | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks, artworkExternalIds } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { eq, and, sql } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SITE = 'https://www.simonstalenhag.se';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SECTIONS = ['es', 'labyrinth', 'other', 'paleo', 'svema', 'tftf', 'tftl'];
const SCRAPE = 'C:/tmp/stal-official-scrape.json';
const HASH_IN = 'C:/tmp/stal-hash-input.json';
const HASH_OUT = 'C:/tmp/stal-hashes.json';
const REPORT = 'C:/tmp/stal-official-import-report.md';
const HASH_PS1 = 'scripts/import-stalenhag-hash.ps1';

// dHash decision bands, set from the measured 2026-09-28 distribution (64-bit):
// wiki-wiki unrelated floor = 13; exactly 77 official images sit at <=8 (= wikiart's 77 twins);
// 9-12 = thin near band held for review; >=13 = distinct (by_procession's vision-verified 14 lands here).
const MATCH_MAX = 8;
const NEAR_MAX = 12;
const TITLE_CONFLICT_MAX = 20; // title match whose hash distance exceeds this is held as a conflict

// Files that can never produce a meaningful match, by manual image review 2026-10-08
// (AI Studio adjudication batch over the held items): one photographed book cover and
// seven detail crops of larger plates. A crop dHashes against the whole plate it was
// cut from at 9-12, so it parks in a HELD bucket forever and burns a vision run.
// Excluded srcs are dropped in `urls` and `import`: no decision, never linked, never
// inserted, each skip printed loudly and listed in the report. Reasons are per file —
// extend this map, never a silent pattern match.
const HASH_EXCLUDE: Record<string, string> = {
  'text/tftf_front.jpg': 'photographed hardcover (Things From The Flood) - not an artwork plate',
  'bilder/l_ash04_detalj4.jpg': 'detail crop of bilder/l_ash04.jpg - never matches the whole plate',
  'bilder/l_fb_08_detalj4.jpg': 'detail crop of bilder/l_fb_08.jpg - never matches the whole plate',
  'bilder/svema_05_detalj2.jpg': 'detail crop of bilder/svema_05.jpg - never matches the whole plate',
  'bilder/svema_07_detalj1.jpg': 'detail crop of bilder/svema_07.jpg - never matches the whole plate',
  'bilder/svema_09_detalj1.jpg': 'detail crop of bilder/svema_09.jpg - never matches the whole plate',
  'bilder/svema_10_detalj3.jpg': 'detail crop of bilder/svema_10.jpg - never matches the whole plate',
  'bilder/svema_19_detalj1.jpg': 'detail crop of bilder/svema_19.jpg - never matches the whole plate',
};

// Resolutions from the 2026-10-08 image-adjudication batch (AI Studio vision over the held
// pairs; raw verdicts + evidence: automata-private youtube.com\aistudio-title-batch\image-results.json).
// A verdict only ever rewrites a HELD decision - a confident title/hash link is left alone so a
// future better match is never overridden.
const HELD_TYPES = new Set(['ambiguous-title', 'ambiguous-hash', 'near', 'dup-official', 'hold-nohash']);
// one artwork published under two official files: insert `key`, then link `value` to that row
const VERDICT_SAME: Record<string, string> = { 'other/17.jpg': 'tftf/34.jpg' };
// verdicts "different"/"neither": the file is its own artwork and has no wikiart twin
const VERDICT_NEW: string[] = [
  'bilder/by_home.jpg',
  'bilder/by_home6.jpg',
  'tftf/45.jpg',
  'tftf/46.jpg',
  'tftf/47.jpg',
  'other/10.jpg',
  'bilder/svema_28.jpg',
  'bilder/l_int01.jpg',
  'other/20.jpg',
  'bilder/by_conception.jpg',
];

type OfficialItem = {
  section: string;
  src: string; // relative path (stable external-id + dedupe key)
  url: string; // absolute URL (download/hash/imageUrl)
  hires: string | null;
  captionTitle: string | null;
  captionYear: number | null;
};
type WikiWork = { id: number; title: string; year: number | null; imageUrl: string | null };
type Decision =
  | { type: 'title'; wikiId: number; confidence: 100 }
  | { type: 'hash'; wikiId: number; dist: number; confidence: 90 }
  | { type: 'ambiguous-title'; cands: number[]; conflictDist?: number }
  | { type: 'ambiguous-hash'; cands: { id: number; dist: number }[] }
  | { type: 'near'; best: { id: number; dist: number }; second: { id: number; dist: number } | null }
  | { type: 'dup-official'; wikiId: number; dist: number }
  | { type: 'official-same'; of: string } // adjudicated: same artwork as another official file
  | { type: 'hold-nohash' }
  | { type: 'new' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getText(url: string): Promise<string> {
  let lastErr = '';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return await res.text();
      lastErr = `status=${res.status}`;
      if (res.status !== 429 && res.status < 500) throw new Error(`request FAILED url=${url} ${lastErr} — no fallback, aborting`);
    } catch (e) {
      if (e instanceof Error && /aborting/.test(e.message)) throw e;
      lastErr = e instanceof Error ? `network:${e.message}` : `network:${String(e)}`;
    }
    console.log(`retry attempt=${attempt} ${lastErr} url=${url}`);
    await sleep(1500 * attempt);
  }
  throw new Error(`request FAILED url=${url} ${lastErr} after 5 attempts — no fallback, aborting`);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

// Caption forms seen on other.html: `"Bellbind And Fireweed". 2018. Solo piece.` and `Loop. 2019.`
function parseCaption(raw: string): { title: string; year: number } | null {
  const t = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  const q = /^"(.{1,150}?)"\.\s*(\d{4})\./.exec(t);
  if (q) return { title: q[1].trim(), year: Number(q[2]) };
  const u = /^([A-Za-z][A-Za-z0-9'’\- ]{0,60}?)\.\s*(\d{4})\./.exec(t);
  if (u) return { title: u[1].trim(), year: Number(u[2]) };
  return null;
}

async function scrape(): Promise<void> {
  const bySrc = new Map<string, OfficialItem>();
  for (const section of SECTIONS) {
    const html = await getText(`${SITE}/${section}.html`);
    const pairRe = /<a href="([^"]+)"[^>]*><img src="([^"]+)"[^>]*>/g;
    const pairSrcs = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(html)) !== null) {
      const href = m[1];
      const src = m[2];
      if (src.startsWith('gif/') || href.endsWith('.html')) continue;
      if (bySrc.has(src)) continue;
      pairSrcs.add(src);
      let captionTitle: string | null = null;
      let captionYear: number | null = null;
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 700);
      const pRe = /<p[^>]*>([^<]*)<\/p>/g;
      let pCount = 0;
      let pm: RegExpExecArray | null;
      while (pCount < 3 && (pm = pRe.exec(after)) !== null) {
        const body = decodeEntities(pm[1]).trim();
        if (!body || !body.replace(/[\s.]/g, '')) { pCount += 1; continue; }
        const cap = parseCaption(body);
        if (cap) { captionTitle = cap.title; captionYear = cap.year; }
        break;
      }
      bySrc.set(src, { section, src, url: `${SITE}/${src}`, hires: href.startsWith('http') ? href : `${SITE}/${href}`, captionTitle, captionYear });
    }
    // imgs outside the anchor pair (covers / book plates): text/tftl1.jpg etc.
    const allRe = /<img src="([^"]+)"[^>]*>/g;
    while ((m = allRe.exec(html)) !== null) {
      const src = m[1];
      if (src.startsWith('gif/') || pairSrcs.has(src) || bySrc.has(src)) continue;
      bySrc.set(src, { section, src, url: `${SITE}/${src}`, hires: null, captionTitle: null, captionYear: null });
    }
    console.log(`scraped ${section}.html (total so far: ${bySrc.size})`);
  }
  const items = [...bySrc.values()];
  writeFileSync(SCRAPE, JSON.stringify(items, null, 2), 'utf8');
  const captioned = items.filter((i) => i.captionTitle).length;
  console.log(`SCRAPE done: ${items.length} unique images across ${SECTIONS.length} sections, captioned=${captioned} -> ${SCRAPE}`);
}

// Shared by `urls` and `import`: drop HASH_EXCLUDE srcs and announce every one loudly.
function partitionExcluded(items: OfficialItem[]): { kept: OfficialItem[]; excluded: OfficialItem[] } {
  const excluded = items.filter((i) => HASH_EXCLUDE[i.src]);
  const kept = items.filter((i) => !HASH_EXCLUDE[i.src]);
  for (const i of excluded) console.log(`HASH-EXCLUDED ${i.src} — ${HASH_EXCLUDE[i.src]}`);
  if (excluded.length) console.log(`HASH-EXCLUDED ${excluded.length} file(s) skipped (cover/detail crop), ${kept.length} kept`);
  return { kept, excluded };
}

async function urls(): Promise<void> {
  const [artistRow] = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.provider, 'wikiart'), eq(artists.slug, 'simon-stalenhag')));
  if (!artistRow) throw new Error('artist simon-stalenhag not found — no fallback');
  const wiki = await db
    .select({ id: artworks.id, title: artworks.title, year: artworks.year, imageUrl: artworks.imageUrl })
    .from(artworks)
    .where(and(eq(artworks.artistId, artistRow.id), eq(artworks.provider, 'wikiart')));
  const { kept: items, excluded: dropped } = partitionExcluded(JSON.parse(readFileSync(SCRAPE, 'utf8')) as OfficialItem[]);
  const input = [
    ...wiki.map((w) => ({ key: `w:${w.id}`, url: w.imageUrl })),
    ...items.map((i) => ({ key: `o:${i.src}`, url: i.url })),
  ].filter((e) => !!e.url);
  writeFileSync(HASH_IN, JSON.stringify(input, null, 2), 'utf8');
  console.log(`URLS done: wikiart=${wiki.length} official=${items.length} (excluded ${dropped.length}) to hash -> ${HASH_IN}`);
}

function hash(): void {
  const res = spawnSync('pwsh', ['-NoProfile', '-File', HASH_PS1], { encoding: 'utf8', cwd: process.cwd() });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) throw new Error(`hash script FAILED status=${res.status} — no fallback`);
  if (!existsSync(HASH_OUT)) throw new Error(`hash output missing ${HASH_OUT} — no fallback`);
  const out = JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>;
  const failed = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
  for (const k of failed) console.error(`HASH-FAILED ${k}`);
  console.log(`HASH done: total=${Object.keys(out).length} failed=${failed.length}`);
}

// Hashes are 64-char binary strings ('0'/'1'), not hex — compare every bit.
function hammingBits(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) d += 1;
  return d + Math.abs(a.length - b.length);
}

function normTitle(s: string): string {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// No caption = no real title (the artist says filenames are photoshop doc names, never titles).
// The site's file path IS the official per-plate identifier (`tftf/34.jpg`) — use it verbatim,
// never wrap or invent (the earlier `Untitled (…)` wrapper was rejected: no invented text).
function stemTitle(src: string): string {
  return src;
}

async function runImport(apply: boolean): Promise<void> {
  const { kept: items, excluded: excludedItems } = partitionExcluded(JSON.parse(readFileSync(SCRAPE, 'utf8')) as OfficialItem[]);
  const hashes = JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>;
  const [artistRow] = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.provider, 'wikiart'), eq(artists.slug, 'simon-stalenhag')));
  if (!artistRow) throw new Error('artist simon-stalenhag not found — no fallback');
  const wiki = await db
    .select({ id: artworks.id, title: artworks.title, year: artworks.year, imageUrl: artworks.imageUrl })
    .from(artworks)
    .where(and(eq(artworks.artistId, artistRow.id), eq(artworks.provider, 'wikiart')));
  const wikiHash = new Map<number, string>();
  const wikiClaimed = new Set<number>();
  const wikiById = new Map(wiki.map((w) => [w.id, w]));
  for (const w of wiki) {
    const h = hashes[`w:${w.id}`];
    if (h) wikiHash.set(w.id, h);
  }
  const execRes = await db.execute(sql`SELECT external_id, artwork_id FROM artwork_external_ids WHERE provider = 'official'`);
  const execRows = (Array.isArray(execRes) ? execRes : ((execRes as unknown as { rows?: unknown[] }).rows ?? [])) as { external_id: string; artwork_id: number }[];
  const already = new Set(execRows.map((r) => r.external_id));
  // Re-run safety: an official image already linked to a wikiart row still OWNS that row,
  // even though it is skipped above. Without the pre-claim a re-run frees the row, and the
  // next official image sitting at dist <= 8 links straight onto it instead of being held
  // as dup-official — found 2026-10-08: bilder/by_conception.jpg would have linked to
  // artwork 55, a painting the image-adjudication batch had already verified as a
  // DIFFERENT work owned by bilder/by_wipers.jpg (dist=0).
  for (const r of execRows) if (wikiById.has(r.artwork_id)) wikiClaimed.add(r.artwork_id);

  const decisions = new Map<string, Decision>();
  const extId = (src: string) => `simonstalenhag:${src}`;

  // Stage A: exact normalized title + year (captioned solo pieces).
  for (const item of items) {
    if (already.has(extId(item.src))) continue;
    if (!item.captionTitle) continue;
    const nt = normTitle(item.captionTitle);
    const cands = wiki.filter(
      (w) => normTitle(w.title) === nt && (w.year == null || item.captionYear == null || w.year === item.captionYear),
    );
    if (cands.length === 1) {
      const target = cands[0];
      if (wikiClaimed.has(target.id)) decisions.set(item.src, { type: 'dup-official', wikiId: target.id, dist: 0 });
      else {
        const oh = hashes[`o:${item.src}`];
        const wh = wikiHash.get(target.id);
        if (oh && wh) {
          const d = hammingBits(oh, wh);
          if (d > TITLE_CONFLICT_MAX) {
            decisions.set(item.src, { type: 'ambiguous-title', cands: [target.id], conflictDist: d });
            continue;
          }
        }
        wikiClaimed.add(target.id);
        decisions.set(item.src, { type: 'title', wikiId: target.id, confidence: 100 });
      }
    } else if (cands.length > 1) {
      decisions.set(item.src, { type: 'ambiguous-title', cands: cands.map((c) => c.id) });
    }
    // 0 candidates -> falls through to hash stage below
  }

  // Stage B: dHash.
  for (const item of items) {
    if (decisions.has(item.src) || already.has(extId(item.src))) continue;
    const oh = hashes[`o:${item.src}`];
    if (!oh) { decisions.set(item.src, { type: 'hold-nohash' }); continue; }
    const dists = [...wikiHash.entries()]
      .map(([id, h]) => ({ id, dist: hammingBits(oh, h) }))
      .sort((a, b) => a.dist - b.dist);
    const best = dists[0] ?? null;
    const second = dists[1] ?? null;
    if (best && best.dist <= MATCH_MAX) {
      if (second && second.dist <= MATCH_MAX) {
        decisions.set(item.src, { type: 'ambiguous-hash', cands: [best, second] });
      } else if (wikiClaimed.has(best.id)) {
        decisions.set(item.src, { type: 'dup-official', wikiId: best.id, dist: best.dist });
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

  // Duplicate clusters among would-be-new works (same piece under two filenames).
  const newItems = items.filter((i) => decisions.get(i.src)?.type === 'new');
  for (let i = 0; i < newItems.length; i += 1) {
    for (let j = i + 1; j < newItems.length; j += 1) {
      const ha = hashes[`o:${newItems[i].src}`];
      const hb = hashes[`o:${newItems[j].src}`];
      if (!ha || !hb) continue;
      const d = hammingBits(ha, hb);
      if (d <= MATCH_MAX) {
        decisions.set(newItems[i].src, { type: 'ambiguous-hash', cands: [{ id: -1, dist: d }] });
        decisions.set(newItems[j].src, { type: 'ambiguous-hash', cands: [{ id: -1, dist: d }] });
        console.error(`DUP-OFFICIAL ${newItems[i].src} ~ ${newItems[j].src} dist=${d} — both held`);
      }
    }
  }

  // Adjudicated holds: the 2026-10-08 vision batch looked at every held pair, so the buckets
  // above are resolved here instead of staying HELD forever. HELD decisions only.
  for (const [primary, twin] of Object.entries(VERDICT_SAME)) {
    const dp = decisions.get(primary);
    if (dp && HELD_TYPES.has(dp.type)) {
      decisions.set(primary, { type: 'new' });
      console.log(`VERDICT-SAME ${primary} - adjudicated 2026-10-08: insert as its own artwork`);
    }
    const dt = decisions.get(twin);
    if (dt && HELD_TYPES.has(dt.type)) {
      decisions.set(twin, { type: 'official-same', of: primary });
      console.log(`VERDICT-SAME ${twin} = ${primary} - adjudicated 2026-10-08: same artwork, links to ${primary}`);
    } else if (dt) {
      console.log(`VERDICT-SAME ${twin} - natural decision ${dt.type} kept (not a hold)`);
    }
  }
  for (const src of VERDICT_NEW) {
    const d = decisions.get(src);
    if (!d) continue;
    if (HELD_TYPES.has(d.type)) {
      decisions.set(src, { type: 'new' });
      console.log(`VERDICT-NEW ${src} - adjudicated 2026-10-08: distinct artwork, no wikiart twin`);
    } else {
      console.log(`VERDICT-NEW ${src} - natural decision ${d.type} kept (not a hold)`);
    }
  }

  // Report.
  const buckets: Record<string, OfficialItem[]> = { title: [], hash: [], new: [], 'official-same': [], 'ambiguous-title': [], 'ambiguous-hash': [], near: [], 'dup-official': [], 'hold-nohash': [] };
  const skipped = items.filter((i) => already.has(extId(i.src)));
  for (const item of items) {
    if (already.has(extId(item.src))) continue;
    const d = decisions.get(item.src);
    if (d) buckets[d.type].push(item);
  }
  const wikiOnly = wiki.filter((w) => !wikiClaimed.has(w.id));
  const lines: string[] = [];
  lines.push('# simonstalenhag.se import report');
  lines.push('');
  lines.push(`- scraped official images: ${items.length + excludedItems.length} (already imported: ${skipped.length}, excluded from matching: ${excludedItems.length})`);
  lines.push(`- title matches: ${buckets.title.length}, hash matches (<=${MATCH_MAX}): ${buckets.hash.length}, new works: ${buckets.new.length}, adjudicated same-artwork twins: ${buckets['official-same'].length}`);
  lines.push(`- HELD: ambiguous-title ${buckets['ambiguous-title'].length}, ambiguous-hash ${buckets['ambiguous-hash'].length}, near(<=${NEAR_MAX}) ${buckets.near.length}, dup-official ${buckets['dup-official'].length}, nohash ${buckets['hold-nohash'].length}`);
  lines.push(`- wikiart-only works (no official counterpart): ${wikiOnly.length}`);
  lines.push('');
  if (excludedItems.length) {
    lines.push(`## EXCLUDED from hash matching (${excludedItems.length})`);
    for (const i of excludedItems) lines.push(`- ${i.src} — ${HASH_EXCLUDE[i.src]}`);
    lines.push('');
  }
  const pushPair = (label: string, list: OfficialItem[], f: (i: OfficialItem, d: Decision) => string) => {
    if (!list.length) return;
    lines.push(`## ${label} (${list.length})`);
    for (const i of list) lines.push(`- ${f(i, decisions.get(i.src)!)}`);
    lines.push('');
  };
  pushPair('title matches', buckets.title, (i, d) => {
    const id = (d as { wikiId: number }).wikiId;
    const oh = hashes[`o:${i.src}`];
    const wh = wikiHash.get(id);
    const hd = oh && wh ? hammingBits(oh, wh) : null;
    return `${i.src} -> ${id} (${wikiById.get(id)?.title ?? '?'} ${wikiById.get(id)?.year ?? ''}, cap="${i.captionTitle}" ${i.captionYear}, hashDist=${hd ?? 'n/a'})`;
  });
  pushPair(`hash matches (dist<=${MATCH_MAX})`, buckets.hash, (i, d) => `${i.src} -> ${(d as { wikiId: number }).wikiId} (${wikiById.get((d as { wikiId: number }).wikiId)?.title}, dist=${(d as { dist: number }).dist})`);
  pushPair('NEW works (would insert)', buckets.new, (i) => `${i.src} title="${i.captionTitle ?? stemTitle(i.src)}" year=${i.captionYear ?? 'null'} section=${i.section}`);
  pushPair('SAME ARTWORK as another official file (adjudicated 2026-10-08)', buckets['official-same'], (i, d) => `${i.src} = ${(d as { of: string }).of} (links to that file's artwork row)`);
  pushPair('HELD ambiguous-title', buckets['ambiguous-title'], (i, d) => `${i.src} cap="${i.captionTitle}" cands=${(d as { cands: number[]; conflictDist?: number }).cands.join(',')}${(d as { conflictDist?: number }).conflictDist != null ? ` HASH-CONFLICT dist=${(d as { conflictDist?: number }).conflictDist}` : ''}`);
  pushPair('HELD ambiguous-hash', buckets['ambiguous-hash'], (i, d) => `${i.src} cands=${(d as { cands: { id: number; dist: number }[] }).cands.map((c) => `${c.id}@${c.dist}`).join(',')}`);
  pushPair(`HELD near (dist<=${NEAR_MAX})`, buckets.near, (i, d) => {
    const dd = d as { best: { id: number; dist: number }; second: { id: number; dist: number } | null };
    const t = (id: number) => wikiById.get(id)?.title ?? '?';
    return `${i.src} best=${dd.best.dist} to ${dd.best.id} "${t(dd.best.id)}"${dd.second ? ` second=${dd.second.dist} to ${dd.second.id}` : ''}`;
  });
  pushPair('HELD dup-official (wiki row already claimed)', buckets['dup-official'], (i, d) => `${i.src} -> ${(d as { wikiId: number }).wikiId} dist=${(d as { dist: number }).dist}`);
  pushPair('HELD nohash (download failed, no insert without proof)', buckets['hold-nohash'], (i) => `${i.src}`);
  if (wikiOnly.length) {
    lines.push(`## wikiart-only works (${wikiOnly.length})`);
    for (const w of wikiOnly) lines.push(`- ${w.id} "${w.title}" ${w.year ?? ''}`);
    lines.push('');
  }

  const inserted: string[] = [];
  const linked: string[] = [];
  if (apply) {
    for (const item of items) {
      if (already.has(extId(item.src))) continue;
      const d = decisions.get(item.src);
      if (!d) continue;
      const externalId = extId(item.src);
      const sectionUrl = `${SITE}/${item.section}.html`;
      if (d.type === 'title' || d.type === 'hash') {
        await upsertArtworkSource({
          artworkId: d.wikiId,
          provider: 'official',
          externalId,
          sourceUrl: sectionUrl,
          imageUrl: item.url,
          title: item.captionTitle,
          confidence: d.confidence,
          isPrimary: false,
          lastSyncedAt: new Date(),
        });
        linked.push(`${item.src} -> artwork ${d.wikiId} (${d.type}${'dist' in d ? ` dist=${d.dist}` : ''})`);
      } else if (d.type === 'new') {
        const title = item.captionTitle ?? stemTitle(item.src);
        const [row] = await db
          .insert(artworks)
          .values({
            artistId: artistRow.id,
            provider: 'official',
            externalId,
            title,
            year: item.captionYear,
            imageUrl: item.url,
            paintingUrl: sectionUrl,
            metadata: {
              officialSection: item.section,
              officialFile: item.src,
              officialHires: item.hires,
              titleSource: item.captionTitle ? 'caption' : 'file-path',
            },
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({ target: [artworks.provider, artworks.externalId], set: { updatedAt: new Date() } })
          .returning({ id: artworks.id });
        await upsertArtworkSource({
          artworkId: row.id,
          provider: 'official',
          externalId,
          sourceUrl: sectionUrl,
          imageUrl: item.url,
          title,
          confidence: 100,
          isPrimary: true,
          lastSyncedAt: new Date(),
        });
        inserted.push(`artwork ${row.id} "${title}" <- ${item.src}`);
      } else if (d.type === 'official-same') {
        const target = await db
          .select({ id: artworks.id })
          .from(artworks)
          .where(and(eq(artworks.provider, 'official'), eq(artworks.externalId, extId(d.of))));
        if (target.length !== 1) {
          throw new Error(`VERDICT-SAME target ${d.of} resolved to ${target.length} artwork rows - no fallback (is it inserted first?)`);
        }
        await upsertArtworkSource({
          artworkId: target[0].id,
          provider: 'official',
          externalId,
          sourceUrl: sectionUrl,
          imageUrl: item.url,
          title: item.captionTitle,
          confidence: 100,
          isPrimary: false,
          lastSyncedAt: new Date(),
        });
        linked.push(`${item.src} -> artwork ${target[0].id} (same artwork as ${d.of}, verdict 2026-10-08)`);
      }
    }
  }

  lines.push('## actions' + (apply ? '' : ' (DRY RUN — nothing written)'));
  lines.push(`- linked: ${linked.length}${apply ? '' : ` (would link; matched set = ${buckets.title.length + buckets.hash.length + buckets['official-same'].length})`}`);
  lines.push(`- inserted: ${inserted.length}${apply ? '' : ` (would insert; ${buckets.new.length} new)`}`);
  if (apply) {
    for (const l of linked) lines.push(`  - LINK ${l}`);
    for (const i of inserted) lines.push(`  - INSERT ${i}`);
  }
  lines.push('');
  writeFileSync(REPORT, lines.join('\n'), 'utf8');

  console.log(`REPORT -> ${REPORT}`);
  console.log(`MODE=${apply ? 'APPLY' : 'DRY-RUN'} title=${buckets.title.length} hash=${buckets.hash.length} new=${buckets.new.length} HELD=${buckets['ambiguous-title'].length + buckets['ambiguous-hash'].length + buckets.near.length + buckets['dup-official'].length + buckets['hold-nohash'].length} wikiart-only=${wikiOnly.length} linked=${linked.length} inserted=${inserted.length}`);
  for (const w of wikiOnly) console.log(`WIKIART-ONLY ${w.id} "${w.title}" ${w.year ?? ''}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'scrape') await scrape();
  else if (mode === 'urls') await urls();
  else if (mode === 'hash') hash();
  else if (mode === 'import') await runImport(process.argv.includes('--apply'));
  else throw new Error(`unknown mode "${mode}" — expected scrape|urls|hash|import [--apply]`);
}

main().catch((e) => {
  console.error(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
