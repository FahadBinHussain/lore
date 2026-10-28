// Google Arts & Culture importer: Jakub Schikaneder -> artworks + artwork_external_ids.
// Fourth consumer of AGENTS "Artwork multi-source backing". Deep-research ingest for the
// GAC source (3 assets on artist entity m0c1v8s, found 2026-10-15; the Die Zauberfloete
// search hits are theatre EXHIBITS - a different object type - and are never scraped).
// Matching rule: unique exact normalized title -> link; plural-fold / identifier-suffixed
// titles -> link with a loud note; >=2 shared content tokens with no year evidence -> HELD
// (never guessed); known translation twins are a per-item ITEM_DECISIONS map with a written
// why. Nothing matches -> insert. Refs-only: images are stored as URLs, never files.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs <mode>`
// Modes: scrape | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { eq, sql } from 'drizzle-orm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARTIST_SLUG = 'jakub-schikaneder';
const PROVIDER = 'gac';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ENTITY_URL = 'https://artsandculture.google.com/entity/jakub-schikaneder/m0c1v8s';
const ORIGIN = 'https://artsandculture.google.com';
const SCRAPE = 'C:/tmp/schikaneder-gac-scrape.json';
const REPORT = 'C:/tmp/schikaneder-gac-import-report.md';

const YEAR_MIN = 1850;
const YEAR_MAX = 1935;

type GacItem = {
  assetId: string;
  title: string;
  artist: string;
  page: string; // absolute /asset/... URL
  url: string; // absolute lh3 image URL (=s1600)
  dateRaw: string; // GAC "1890 - 1900" / "1906"
  year: number | null; // range END per the Commons band rule
  gallery: string;
};

// Per-item decisions, each with its own why (AGENTS per-file rule: no pattern guessing).
// `hold` = ambiguous, needs review; never auto-linked, never auto-inserted.
// `insert` = adjudicated its OWN artwork by the 2026-10-15 image-verdict batch - a known
//   translation twin that the vision compare proved to be a different physical work.
type ItemDecision = { kind: 'hold'; reason: string } | { kind: 'insert'; why: string };
const ITEM_DECISIONS: Record<string, ItemDecision> = {
  KgE0jVK609aZbQ: {
    kind: 'insert',
    why:
      'GAC "The granny" (1885, oil on canvas 105x129cm, Regional Gallery in Liberec) is its OWN work — direct image verdict 2026-10-15: not Stařena S Dítětem (seated old woman with a bowl of eggs under a crucifix vs an old woman holding a baby in a doorway — different painting), and not Babička z chudobince (webumenia: oil on carton 33.8x30cm at PNP — dimensions rule it out)',
  },
  dgG_ZLee5UHVGA: {
    kind: 'insert',
    why:
      'GAC "Drowned" (1890-1900, drawing/Conte 880x470mm, Regional Gallery in Liberec) is its OWN work — image verdict 2026-10-15: same composition as tracked Utonulá (194342) but a different physical object (that one is the NGP pastel-on-carton 45.5x88cm, inv. K 55116, "Featured drawings in the National Gallery in Prague") — two institutions cannot hold one object; media-variant twin, same pattern as the ARC Kontemplace pair (82016 pastel / 82019 charcoal -> two rows)',
  },
};

// Extract the JS array literal assigned to window.INIT_data['<key>'] by bracket matching
// (string-aware; a naive regex dies on ';' inside description strings), then JSON.parse it.
function extractInitArray(html: string, keyPrefix: string): unknown[] {
  const anchor = html.indexOf(`window.INIT_data['${keyPrefix}`);
  if (anchor < 0) throw new Error(`GAC scrape: INIT_data block "${keyPrefix}…" not in page`);
  const eq = html.indexOf('= ', anchor);
  const i = eq + 2;
  if (html[i] !== '[') throw new Error(`GAC scrape: INIT_data['${keyPrefix}…'] is not an array literal`);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < html.length; j += 1) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        const raw = html.slice(i, j + 1);
        try {
          return JSON.parse(raw) as unknown[];
        } catch (e) {
          throw new Error(`GAC scrape: INIT_data['${keyPrefix}…'] JSON.parse failed — ${(e as Error).message}`);
        }
      }
    }
  }
  throw new Error(`GAC scrape: INIT_data['${keyPrefix}…'] array never closed`);
}

function parseYear(dateRaw: string): number | null {
  const range = dateRaw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (range) {
    const end = Number(range[2]);
    return end >= YEAR_MIN && end <= YEAR_MAX ? end : null;
  }
  const single = dateRaw.match(/(\d{4})/);
  if (single) {
    const y = Number(single[1]);
    return y >= YEAR_MIN && y <= YEAR_MAX ? y : null;
  }
  return null;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`GAC fetch failed: HTTP ${res.status} ${url}`);
  return res.text();
}

async function scrape(): Promise<GacItem[]> {
  const entityHtml = await fetchPage(ENTITY_URL);
  const entity = extractInitArray(entityHtml, 'EntityAssets:');
  // ["stella.pr","EntityAssets:<uuid>",[[cobject,...]],null,3,...]
  const entries = entity[2];
  if (!Array.isArray(entries)) throw new Error('GAC scrape: EntityAssets[2] is not the cobject list');
  const items: GacItem[] = [];
  for (const raw of entries) {
    if (!Array.isArray(raw) || raw[0] !== 'stella.common.cobject') {
      throw new Error(`GAC scrape: unexpected EntityAssets entry shape: ${JSON.stringify(raw).slice(0, 120)}`);
    }
    const title = raw[1] as string;
    const artist = raw[2] as string;
    const pagePath = raw[4] as string;
    if (artist !== 'Jakub Schikaneder') {
      // assert the artist per entry (ARC rule: assert identity, never trust the slug)
      throw new Error(`GAC scrape artist assertion failed on "${title}" — Artist block says: ${artist}`);
    }
    if (!pagePath.startsWith('/asset/')) throw new Error(`GAC scrape: "${title}" is not an asset page: ${pagePath}`);
    const pageHtml = await fetchPage(ORIGIN + pagePath);
    const block = extractInitArray(pageHtml, 'Asset:');
    // two envelopes seen 2026-10-15: ["stella.av", …] direct, or ["stella.ap", key, ["stella.av", …], …]
    const asset = block[0] === 'stella.ap' && Array.isArray(block[2]) ? (block[2] as unknown[]) : block;
    // ["stella.av", assetId, title, date, image, null, ["Jakub Schikaneder",[...entity...]], ["<gallery>",desc,...], …]
    if (asset[0] !== 'stella.av') throw new Error(`GAC scrape: Asset block of "${title}" is not stella.av: ${String(asset[0])}`);
    const assetId = asset[1] as string;
    const assetTitle = (asset[2] as string) ?? title;
    const dateRaw = (asset[3] as string) ?? '';
    const image = asset[4] as string | null;
    const creator = Array.isArray(asset[6]) ? (asset[6][0] as string) : null;
    const galleryCell = Array.isArray(asset[7]) ? (asset[7] as unknown[]) : null;
    if (creator !== 'Jakub Schikaneder') {
      throw new Error(`GAC scrape artist assertion failed on asset ${assetId} — creator block says: ${creator}`);
    }
    if (!image) throw new Error(`GAC scrape: asset ${assetId} ("${assetTitle}") has no image URL`);
    if (!galleryCell || galleryCell[0] !== 'stella.common.cobject' || typeof galleryCell[1] !== 'string') {
      throw new Error(`GAC scrape: asset ${assetId} ("${assetTitle}") gallery cell missing — shape: ${JSON.stringify(asset.slice(5, 9)).slice(0, 200)}`);
    }
    const url = `https:${image}=s1600`;
    const probe = await fetch(url, { headers: { 'user-agent': UA } });
    if (!probe.ok || !(probe.headers.get('content-type') ?? '').includes('image')) {
      throw new Error(`GAC scrape: image probe failed for ${assetId} — HTTP ${probe.status} ${probe.headers.get('content-type')}`);
    }
    items.push({
      assetId,
      title: assetTitle.trim(),
      artist: creator,
      page: ORIGIN + pagePath,
      url,
      dateRaw,
      year: parseYear(dateRaw),
      gallery: galleryCell[1],
    });
  }
  if (items.length === 0) throw new Error('GAC scrape: 0 assets on the artist entity page — refusing to write an empty scrape');
  const ids = new Set(items.map((i) => i.assetId));
  if (ids.size !== items.length) throw new Error(`GAC scrape: duplicate asset ids in ${items.length} entries`);
  writeFileSync(SCRAPE, JSON.stringify({ fetchedAt: new Date().toISOString(), entity: ENTITY_URL, total: items.length, items }, null, 2));
  console.log(`SCRAPED ${items.length} GAC assets -> ${SCRAPE}`);
  return items;
}

type Decision =
  | { type: 'link'; wikiId: number; how: string; confidence: number }
  | { type: 'hold'; reason: string }
  | { type: 'insert'; reason: string };

type TrackedRow = { id: number; title: string; year: number | null };

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pluralFold(s: string): string {
  return fold(s)
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

function tokens(s: string): Set<string> {
  return new Set(fold(s).split(' ').filter((w) => w.length > 3));
}

async function main() {
  const mode = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (mode !== 'scrape' && mode !== 'import') {
    throw new Error(`unknown mode "${mode}" — expected scrape | import [--apply]`);
  }
  if (mode === 'scrape') {
    await scrape();
    return;
  }

  if (!existsSync(SCRAPE)) throw new Error(`no scrape at ${SCRAPE} — run "scrape" first (no fallback)`);
  const items: GacItem[] = JSON.parse(readFileSync(SCRAPE, 'utf8')).items;

  const artistRow = await db.select().from(artists).where(eq(artists.slug, ARTIST_SLUG));
  if (artistRow.length !== 1) throw new Error(`expected exactly 1 artist row for ${ARTIST_SLUG}, got ${artistRow.length}`);

  const tracked: TrackedRow[] = (
    await db.select({ id: artworks.id, title: artworks.title, year: artworks.year }).from(artworks).where(eq(artworks.artistId, artistRow[0].id))
  ).map((r) => ({ id: r.id, title: r.title, year: r.year }));

  // already-imported = own artworks row OR an existing gac source row (link rows never
  // create artworks rows, so the source table is what makes a re-run report `skip`)
  const existing = new Set(
    (
      await db
        .select({ externalId: artworks.externalId })
        .from(artworks)
        .where(eq(artworks.artistId, artistRow[0].id))
    ).map((r) => r.externalId)
  );
  const srcRes = await db.execute(sql`SELECT external_id FROM artwork_external_ids WHERE provider = ${PROVIDER}`);
  const srcRows = (Array.isArray(srcRes) ? srcRes : ((srcRes as unknown as { rows?: unknown[] }).rows ?? [])) as { external_id: string }[];
  for (const r of srcRows) existing.add(r.external_id);

  const decisions = new Map<string, Decision>();
  for (const item of items) {
    const extId = `${PROVIDER}:${item.assetId}`;
    if (existing.has(extId)) {
      decisions.set(item.assetId, { type: 'link', wikiId: -1, how: 'already-imported', confidence: 100 });
      continue;
    }
    const dec = ITEM_DECISIONS[item.assetId];
    if (dec) {
      decisions.set(item.assetId, dec.kind === 'insert' ? { type: 'insert', reason: dec.why } : { type: 'hold', reason: dec.reason });
      continue;
    }
    const cand = fold(item.title);
    const candPlural = pluralFold(item.title);
    const exact = tracked.filter((t) => fold(t.title) === cand);
    if (exact.length === 1) {
      const yearNote = item.year && exact[0].year && item.year !== exact[0].year ? ` (year ${item.year} vs tracked ${exact[0].year})` : '';
      decisions.set(item.assetId, { type: 'link', wikiId: exact[0].id, how: `exact-title${yearNote}`, confidence: 100 });
      continue;
    }
    if (exact.length > 1) {
      decisions.set(item.assetId, { type: 'hold', reason: `exact title matches ${exact.length} tracked rows (${exact.map((e) => e.id).join(', ')})` });
      continue;
    }
    const suffixed = tracked.filter((t) => {
      const m = t.title.match(/^(.*) \(([^ )]+)\)$/);
      return m && m[2].indexOf(' ') < 0 && fold(m[1]) === cand;
    });
    if (suffixed.length === 1) {
      decisions.set(item.assetId, { type: 'link', wikiId: suffixed[0].id, how: 'exact-title-with-identifier-suffix', confidence: 95 });
      continue;
    }
    if (suffixed.length > 1) {
      decisions.set(item.assetId, { type: 'hold', reason: `title base matches ${suffixed.length} identifier-suffixed rows (${suffixed.map((e) => e.id).join(', ')})` });
      continue;
    }
    const plural = tracked.filter((t) => pluralFold(t.title) === candPlural);
    if (plural.length === 1) {
      decisions.set(item.assetId, { type: 'link', wikiId: plural[0].id, how: 'plural-folded-title', confidence: 90 });
      continue;
    }
    if (plural.length > 1) {
      decisions.set(item.assetId, { type: 'hold', reason: `plural-folded title matches ${plural.length} tracked rows` });
      continue;
    }
    const it = tokens(item.title);
    const weak = tracked.filter((t) => {
      const tt = tokens(t.title);
      let shared = 0;
      for (const w of tt) if (it.has(w)) shared++;
      if (shared < 2) return false;
      if (item.year && t.year && Math.abs(item.year - t.year) > 1) return false;
      return true;
    });
    if (weak.length > 0) {
      decisions.set(item.assetId, {
        type: 'hold',
        reason: `shares >=2 title tokens with tracked row(s) ${weak.map((w) => `${w.id} "${w.title}"`).join('; ')} and no year evidence separates them`,
      });
      continue;
    }
    decisions.set(item.assetId, { type: 'insert', reason: 'no title/token match on any tracked row' });
  }

  // report
  const lines: string[] = [];
  lines.push(`# GAC import report — ${new Date().toISOString()}`);
  lines.push(`- source: ${ENTITY_URL} (${items.length} assets)`);
  lines.push('');
  const buckets: Record<string, GacItem[]> = { link: [], hold: [], insert: [], skip: [] };
  for (const item of items) {
    const d = decisions.get(item.assetId)!;
    buckets[d.type === 'link' && d.how === 'already-imported' ? 'skip' : d.type].push(item);
  }
  for (const key of ['link', 'insert', 'hold', 'skip'] as const) {
    lines.push(`## ${key.toUpperCase()} (${buckets[key].length})`);
    for (const item of buckets[key]) {
      const d = decisions.get(item.assetId)!;
      const detail = d.type === 'link' ? `${item.page} -> artwork ${d.wikiId} [${d.how}]` : `${item.page} — ${d.reason}`;
      lines.push(`- ${item.title} (${item.dateRaw || '?'}) ${detail} — ${item.gallery}`);
    }
    lines.push('');
  }
  writeFileSync(REPORT, lines.join('\n'));

  // preview
  for (const item of items) {
    const d = decisions.get(item.assetId)!;
    if (d.type === 'insert') console.log(`NEW  gac:${item.assetId} "${item.title}" ${item.year ?? '?'} ${item.page}`);
    else if (d.type === 'hold') console.log(`HELD gac:${item.assetId} "${item.title}" — ${d.reason}`);
    else if (d.how !== 'already-imported') console.log(`LINK gac:${item.assetId} "${item.title}" -> ${d.wikiId} (${d.how})`);
  }

  const linked: string[] = [];
  const inserted: string[] = [];
  if (apply) {
    for (const item of items) {
      const d = decisions.get(item.assetId)!;
      const extId = `${PROVIDER}:${item.assetId}`;
      if (d.type === 'insert') {
        const [row] = await db
          .insert(artworks)
          .values({
            artistId: artistRow[0].id,
            provider: PROVIDER,
            externalId: extId,
            title: item.title,
            year: item.year,
            imageUrl: item.url,
            paintingUrl: item.page,
            metadata: { gacAssetId: item.assetId, gacDate: item.dateRaw, gallery: item.gallery, titleSource: 'gac' },
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({ target: [artworks.provider, artworks.externalId], set: { updatedAt: new Date() } })
          .returning({ id: artworks.id });
        await upsertArtworkSource({
          artworkId: row.id,
          provider: PROVIDER,
          externalId: extId,
          sourceUrl: item.page,
          imageUrl: item.url,
          title: item.title,
          confidence: 100,
          isPrimary: true,
          lastSyncedAt: new Date(),
        });
        inserted.push(`artwork ${row.id} "${item.title}" <- gac:${item.assetId}`);
        console.log(`INSERT artwork ${row.id} "${item.title}" <- gac:${item.assetId}`);
      } else if (d.type === 'link' && d.how !== 'already-imported') {
        await upsertArtworkSource({
          artworkId: d.wikiId,
          provider: PROVIDER,
          externalId: extId,
          sourceUrl: item.page,
          imageUrl: item.url,
          title: item.title,
          confidence: d.confidence,
          isPrimary: false,
          lastSyncedAt: new Date(),
        });
        linked.push(`gac:${item.assetId} -> artwork ${d.wikiId} (${d.how})`);
        console.log(`LINK gac:${item.assetId} -> artwork ${d.wikiId} (${d.how})`);
      }
    }
  }

  const held = buckets.hold.length;
  console.log(`MODE=${apply ? 'APPLY' : 'DRY-RUN'} source=gac total=${items.length} link=${buckets.link.length} insert=${buckets.insert.length} HELD=${held} linked=${linked.length} inserted=${inserted.length} report=${REPORT}`);
  if (apply && inserted.length !== buckets.insert.length) throw new Error(`inserted ${inserted.length} != planned ${buckets.insert.length}`);
  const plannedLinks = buckets.link.filter((i) => decisions.get(i.assetId)!.type === 'link' && (decisions.get(i.assetId) as { how: string }).how !== 'already-imported').length;
  if (apply && linked.length !== plannedLinks) throw new Error(`linked ${linked.length} != planned ${plannedLinks}`);
}

main().catch((e) => {
  console.error('GAC-IMPORT FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
