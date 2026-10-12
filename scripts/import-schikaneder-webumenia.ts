// Web umenia importer (SNG lab catalog): Jakub Schikaneder -> artworks + artwork_external_ids.
// Fourth consumer of AGENTS "Artwork multi-source backing". Deep-research phase 6 for the
// Web umenia source (5 author-filtered works, API found 2026-10-09).
// Same matching rule as the ARC adapter: unique exact normalized title -> link; token
// overlap with no year evidence to separate -> HELD; known twins are a per-item HELD map;
// nothing matches -> insert. Refs-only: images stored as URLs.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs <mode>`
// Modes: scrape | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { eq } from 'drizzle-orm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARTIST_SLUG = 'jakub-schikaneder';
const PROVIDER = 'webumenia';
const UA = 'LoreMediaTracker/1.0 (Web umenia artwork import; local agent)';
const AUTHOR = 'Schikaneder, Jakub';
const API = `https://www.webumenia.sk/api/v1/items?filter%5Bauthor%5D=${encodeURIComponent(AUTHOR)}&size=200`;
const SCRAPE = 'C:/tmp/schikaneder-webumenia-scrape.json';
const REPORT = 'C:/tmp/schikaneder-webumenia-import-report.md';

type WuItem = {
  id: string;
  title: string;
  year: number | null;
  yearRange: string;
  gallery: string;
  page: string;
  url: string;
};

type WuRaw = {
  id: string;
  content: {
    id: string;
    title: string | string[];
    date_earliest?: number | null;
    date_latest?: number | null;
    gallery?: string | null;
    image?: string | null;
  };
};

const YEAR_MIN = 1850;
const YEAR_MAX = 1935;

// Per-item decisions with their own reason (no pattern guessing).
const ITEM_DECISIONS: Record<string, { kind: 'hold'; reason: string }> = {
  'CZE:PNP.IO_128': {
    kind: 'hold',
    reason:
      'shares studie/vrazda/dome with the tracked row 194341 "Studie k obrazu Vražda v domě" (both 1890) — same probable work under two phrasings, but the strings differ, so review before linking',
  },
  'CZE:MG.A_813': {
    kind: 'hold',
    reason:
      'gender-variant title "Staropražské zákoutí" vs the tracked "Staropražská zákoutí" (194346, 1907) — same gallery (Moravská galerie) and same 1907-1909 range, but only one title token is shared, so it is held for review instead of linked or inserted',
  },
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(fold(s).split(' ').filter((w) => w.length > 3));
}

function toItem(raw: WuRaw): WuItem {
  const c = raw.content;
  const title = (Array.isArray(c.title) ? c.title.join(' / ') : c.title).trim();
  const start = typeof c.date_earliest === 'number' ? c.date_earliest : null;
  const end = typeof c.date_latest === 'number' ? c.date_latest : null;
  const range = start && end && start !== end ? `${start}-${end}` : start ? String(start) : '';
  const year = end ?? start ?? null;
  return {
    id: c.id,
    title,
    year: year && year >= YEAR_MIN && year <= YEAR_MAX ? year : null,
    yearRange: range,
    gallery: c.gallery ?? '',
    page: `https://www.webumenia.sk/en/dielo/${encodeURIComponent(c.id)}`,
    url: `https://www.webumenia.sk/dielo/nahlad/${encodeURIComponent(c.id)}/800`,
  };
}

async function scrape(): Promise<WuItem[]> {
  const res = await fetch(API, { headers: { 'user-agent': UA, 'accept-language': 'en' } });
  if (!res.ok) throw new Error(`Web umenia scrape failed: HTTP ${res.status} ${API}`);
  const json = (await res.json()) as { total: number; data: WuRaw[] };
  const items = json.data.map(toItem);
  if (items.length !== json.total) throw new Error(`Web umenia size mismatch: ${items.length} items vs total ${json.total}`);
  if (!items.length) throw new Error('Web umenia author filter returned 0 works — refusing to write an empty scrape');
  writeFileSync(SCRAPE, JSON.stringify({ fetchedAt: new Date().toISOString(), total: json.total, items }, null, 2));
  console.log(`SCRAPED ${items.length} Web umenia works (total=${json.total}) -> ${SCRAPE}`);
  return items;
}

type Decision =
  | { type: 'link'; artworkId: number; how: string; confidence: number }
  | { type: 'hold'; reason: string }
  | { type: 'insert'; reason: string };

type TrackedRow = { id: number; title: string; year: number | null };

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
  const items: WuItem[] = JSON.parse(readFileSync(SCRAPE, 'utf8')).items;

  const artistRow = await db.select().from(artists).where(eq(artists.slug, ARTIST_SLUG));
  if (artistRow.length !== 1) throw new Error(`expected exactly 1 artist row for ${ARTIST_SLUG}, got ${artistRow.length}`);

  const tracked: TrackedRow[] = (
    await db.select({ id: artworks.id, title: artworks.title, year: artworks.year }).from(artworks).where(eq(artworks.artistId, artistRow[0].id))
  ).map((r) => ({ id: r.id, title: r.title, year: r.year }));

  const existing = new Set(
    (
      await db.select({ externalId: artworks.externalId }).from(artworks).where(eq(artworks.artistId, artistRow[0].id))
    ).map((r) => r.externalId)
  );

  const decisions = new Map<string, Decision>();
  for (const item of items) {
    const extId = `webumenia:${item.id}`;
    if (existing.has(extId)) {
      decisions.set(item.id, { type: 'link', artworkId: -1, how: 'already-imported', confidence: 100 });
      continue;
    }
    const dec = ITEM_DECISIONS[item.id];
    if (dec) {
      decisions.set(item.id, { type: 'hold', reason: dec.reason });
      continue;
    }
    const cand = fold(item.title);
    const exact = tracked.filter((t) => fold(t.title) === cand);
    if (exact.length === 1) {
      const yearNote = item.year && exact[0].year && item.year !== exact[0].year ? ` (year ${item.year} vs tracked ${exact[0].year})` : '';
      decisions.set(item.id, { type: 'link', artworkId: exact[0].id, how: `exact-title${yearNote}`, confidence: 100 });
      continue;
    }
    if (exact.length > 1) {
      decisions.set(item.id, { type: 'hold', reason: `exact title matches ${exact.length} tracked rows (${exact.map((e) => e.id).join(', ')})` });
      continue;
    }
    const suffixed = tracked.filter((t) => {
      const m = t.title.match(/^(.*) \(([^ )]+)\)$/);
      return m && m[2].indexOf(' ') < 0 && fold(m[1]) === cand;
    });
    if (suffixed.length === 1) {
      decisions.set(item.id, { type: 'link', artworkId: suffixed[0].id, how: 'exact-title-with-identifier-suffix', confidence: 95 });
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
      decisions.set(item.id, {
        type: 'hold',
        reason: `shares >=2 title tokens with tracked row(s) ${weak.map((w) => `${w.id} "${w.title}"`).join('; ')} and no year evidence separates them`,
      });
      continue;
    }
    decisions.set(item.id, { type: 'insert', reason: 'no title/token match on any tracked row' });
  }

  const lines: string[] = [];
  lines.push(`# Web umenia import report — ${new Date().toISOString()}`);
  lines.push(`- source: ${API} (${items.length} works)`);
  lines.push('');
  const buckets: Record<'link' | 'insert' | 'hold' | 'skip', WuItem[]> = { link: [], insert: [], hold: [], skip: [] };
  for (const item of items) {
    const d = decisions.get(item.id)!;
    buckets[d.type === 'link' && d.how === 'already-imported' ? 'skip' : d.type].push(item);
  }
  for (const key of ['link', 'insert', 'hold', 'skip'] as const) {
    lines.push(`## ${key.toUpperCase()} (${buckets[key].length})`);
    for (const item of buckets[key]) {
      const d = decisions.get(item.id)!;
      const detail = d.type === 'link' ? `${item.page} -> artwork ${d.artworkId} [${d.how}]` : `${item.page} — ${d.reason}`;
      lines.push(`- ${item.title} (${item.yearRange || '?'}) ${detail}`);
    }
    lines.push('');
  }
  writeFileSync(REPORT, lines.join('\n'));

  for (const item of items) {
    const d = decisions.get(item.id)!;
    if (d.type === 'insert') console.log(`NEW  ${item.id} "${item.title}" ${item.year ?? '?'} ${item.page}`);
    else if (d.type === 'hold') console.log(`HELD ${item.id} "${item.title}" — ${d.reason}`);
    else if (d.how !== 'already-imported') console.log(`LINK ${item.id} "${item.title}" -> ${d.artworkId} (${d.how})`);
  }

  const linked: string[] = [];
  const inserted: string[] = [];
  if (apply) {
    for (const item of items) {
      const d = decisions.get(item.id)!;
      const extId = `webumenia:${item.id}`;
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
            metadata: { webumeniaId: item.id, dateRange: item.yearRange, gallery: item.gallery, titleSource: 'webumenia' },
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
        inserted.push(`artwork ${row.id} "${item.title}" <- ${extId}`);
        console.log(`INSERT artwork ${row.id} "${item.title}" <- ${extId}`);
      } else if (d.type === 'link' && d.how !== 'already-imported') {
        await upsertArtworkSource({
          artworkId: d.artworkId,
          provider: PROVIDER,
          externalId: extId,
          sourceUrl: item.page,
          imageUrl: item.url,
          title: item.title,
          confidence: d.confidence,
          isPrimary: false,
          lastSyncedAt: new Date(),
        });
        linked.push(`${extId} -> artwork ${d.artworkId} (${d.how})`);
        console.log(`LINK ${extId} -> artwork ${d.artworkId} (${d.how})`);
      }
    }
  }

  console.log(`MODE=${apply ? 'APPLY' : 'DRY-RUN'} source=webumenia total=${items.length} link=${buckets.link.length} insert=${buckets.insert.length} HELD=${buckets.hold.length} linked=${linked.length} inserted=${inserted.length} report=${REPORT}`);
  if (apply && inserted.length !== buckets.insert.length) throw new Error(`inserted ${inserted.length} != planned ${buckets.insert.length}`);
}

main().catch((e) => {
  console.error('WEBUMENIA-IMPORT FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
