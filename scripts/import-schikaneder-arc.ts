// Art Renewal Center importer: Jakub Schikaneder -> artworks + artwork_external_ids.
// Third consumer of AGENTS "Artwork multi-source backing". Deep-research phase 6 for the
// ARC source (36 artworks, machine-readable endpoint found 2026-10-09).
// Matching rule: unique exact normalized title -> link; plural-fold / identifier-suffixed
// titles -> link with a loud note; an item that shares >=2 content tokens with a tracked
// row of unknown or agreeing year is HELD (never guessed); known translation twins are a
// per-item HELD map. Nothing matches -> insert. Refs-only: images are stored as URLs.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs <mode>`
// Modes: scrape | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { eq } from 'drizzle-orm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARTIST_SLUG = 'jakub-schikaneder';
const PROVIDER = 'arc';
const UA = 'LoreMediaTracker/1.0 (ARC artwork import; local agent)';
const ARTIST_ID = 7975; // asserted in scrape against the returned artist name
const API = `https://www.artrenewal.org/Artist/FetchAllArtworksJson?id=${ARTIST_ID}`;
const SCRAPE = 'C:/tmp/schikaneder-arc-scrape.json';
const REPORT = 'C:/tmp/schikaneder-arc-import-report.md';

type ArcItem = {
  id: number;
  slug: string;
  title: string;
  alternateTitle: string | null;
  year: number | null;
  yearRange: string | null;
  medium: string | null;
  page: string;
  url: string;
};

type ArcRaw = {
  Slug: string;
  Id: number;
  Title: string;
  AlternateTitle: string | null;
  StartYear: number | null;
  EndYear: number | null;
  DateRange: string | null;
  Medium: string | null;
  ImageUrl: string | null;
  Artist: { Slug: string; FirstName: string; LastName: string };
};

const YEAR_MIN = 1850;
const YEAR_MAX = 1935;

// Per-item decisions, each with its own reason (AGENTS per-file rule: no pattern guessing).
// `hold` = ambiguous, needs review; never auto-linked, never auto-inserted.
const ITEM_DECISIONS: Record<number, { kind: 'hold'; reason: string }> = {
  109321: {
    kind: 'hold',
    reason:
      'ARC titles it "Twilight" (1909); the tracker already holds Stmívání (194351, 1909) — the Czech/English pair matches by year but not by string, so it is a translation twin pending review, not an insert',
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

function pluralFold(s: string): string {
  return fold(s)
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

function tokens(s: string): Set<string> {
  return new Set(fold(s).split(' ').filter((w) => w.length > 3));
}

function imageUrlOf(raw: ArcRaw): string | null {
  if (!raw.ImageUrl) return null;
  const file = raw.ImageUrl.replace(/\\/g, '/').split('/').pop();
  if (!file) return null;
  return `https://www.artrenewal.org/secureimages/797/7975/${file}`;
}

function toItem(raw: ArcRaw): ArcItem {
  const year = raw.EndYear ?? raw.StartYear ?? null;
  return {
    id: raw.Id,
    slug: raw.Slug,
    title: raw.Title.trim(),
    alternateTitle: raw.AlternateTitle,
    year: year && year >= YEAR_MIN && year <= YEAR_MAX ? year : null,
    yearRange: raw.DateRange,
    medium: raw.Medium,
    page: `https://www.artrenewal.org/artworks/${raw.Artist.Slug}/${raw.Slug}/${raw.Id}`,
    url: imageUrlOf(raw) ?? '',
  };
}

async function scrape(): Promise<ArcItem[]> {
  const res = await fetch(API, { headers: { 'user-agent': UA, 'x-requested-with': 'XMLHttpRequest' } });
  if (!res.ok) throw new Error(`ARC scrape failed: HTTP ${res.status} ${API}`);
  const json = (await res.json()) as {
    Success: boolean;
    Data: { TotalArtworks: number; Artist?: { Name: string }; Items: ArcRaw[] };
  };
  if (!json.Success) throw new Error('ARC scrape returned Success=false');
  const items = json.Data.Items.map(toItem);
  if (items.length !== json.Data.TotalArtworks) {
    throw new Error(`ARC scrape size mismatch: ${items.length} items vs TotalArtworks ${json.Data.TotalArtworks}`);
  }
  const names = new Set(json.Data.Items.map((r) => `${r.Artist.FirstName} ${r.Artist.LastName}`));
  if (names.size !== 1 || !names.has('Jakub Schikaneder')) {
    // artwork slugs are work slugs ("street-in-the-evening-prague"), so the artist is
    // asserted on the per-item Artist block instead
    throw new Error(`ARC scrape artist assertion failed — Artist blocks returned: ${[...names].join(' | ')}`);
  }
  writeFileSync(SCRAPE, JSON.stringify({ fetchedAt: new Date().toISOString(), total: json.Data.TotalArtworks, items }, null, 2));
  console.log(`SCRAPED ${items.length} ARC artworks -> ${SCRAPE}`);
  return items;
}

type Decision =
  | { type: 'link'; wikiId: number; how: string; confidence: number }
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
  const items: ArcItem[] = JSON.parse(readFileSync(SCRAPE, 'utf8')).items;

  const artistRow = await db.select().from(artists).where(eq(artists.slug, ARTIST_SLUG));
  if (artistRow.length !== 1) throw new Error(`expected exactly 1 artist row for ${ARTIST_SLUG}, got ${artistRow.length}`);

  const tracked: TrackedRow[] = (
    await db.select({ id: artworks.id, title: artworks.title, year: artworks.year }).from(artworks).where(eq(artworks.artistId, artistRow[0].id))
  ).map((r) => ({ id: r.id, title: r.title, year: r.year }));

  const existing = new Set(
    (
      await db
        .select({ externalId: artworks.externalId })
        .from(artworks)
        .where(eq(artworks.artistId, artistRow[0].id))
    ).map((r) => r.externalId)
  );

  const decisions = new Map<number, Decision>();
  for (const item of items) {
    const extId = `arc:${item.id}`;
    if (existing.has(extId)) {
      decisions.set(item.id, { type: 'link', wikiId: -1, how: 'already-imported', confidence: 100 });
      continue;
    }
    const dec = ITEM_DECISIONS[item.id];
    if (dec) {
      decisions.set(item.id, { type: 'hold', reason: dec.reason });
      continue;
    }
    const cand = fold(item.title);
    const candPlural = pluralFold(item.title);
    const exact = tracked.filter((t) => fold(t.title) === cand);
    if (exact.length === 1) {
      const yearNote = item.year && exact[0].year && item.year !== exact[0].year ? ` (year ${item.year} vs tracked ${exact[0].year})` : '';
      decisions.set(item.id, { type: 'link', wikiId: exact[0].id, how: `exact-title${yearNote}`, confidence: 100 });
      continue;
    }
    if (exact.length > 1) {
      decisions.set(item.id, { type: 'hold', reason: `exact title matches ${exact.length} tracked rows (${exact.map((e) => e.id).join(', ')})` });
      continue;
    }
    // identifier-suffixed tracker titles: "<title> (<identifier>)" with an unspaced suffix
    const suffixed = tracked.filter((t) => {
      const m = t.title.match(/^(.*) \(([^ )]+)\)$/);
      return m && m[2].indexOf(' ') < 0 && fold(m[1]) === cand;
    });
    if (suffixed.length === 1) {
      decisions.set(item.id, { type: 'link', wikiId: suffixed[0].id, how: 'exact-title-with-identifier-suffix', confidence: 95 });
      continue;
    }
    if (suffixed.length > 1) {
      decisions.set(item.id, { type: 'hold', reason: `title base matches ${suffixed.length} identifier-suffixed rows (${suffixed.map((e) => e.id).join(', ')})` });
      continue;
    }
    const plural = tracked.filter((t) => pluralFold(t.title) === candPlural);
    if (plural.length === 1) {
      decisions.set(item.id, { type: 'link', wikiId: plural[0].id, how: 'plural-folded-title', confidence: 90 });
      continue;
    }
    if (plural.length > 1) {
      decisions.set(item.id, { type: 'hold', reason: `plural-folded title matches ${plural.length} tracked rows` });
      continue;
    }
    // token overlap: >=2 shared content tokens with no year evidence to separate them -> hold
    const it = tokens(item.title);
    const weak = tracked.filter((t) => {
      const tt = tokens(t.title);
      let shared = 0;
      for (const w of tt) if (it.has(w)) shared++;
      if (shared < 2) return false;
      if (item.year && t.year && Math.abs(item.year - t.year) > 1) return false; // years separate them
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

  // report
  const lines: string[] = [];
  lines.push(`# ARC import report — ${new Date().toISOString()}`);
  lines.push(`- source: ${API} (${items.length} artworks)`);
  lines.push('');
  const buckets: Record<string, ArcItem[]> = { link: [], hold: [], insert: [], skip: [] };
  for (const item of items) {
    const d = decisions.get(item.id)!;
    buckets[d.type === 'link' && d.how === 'already-imported' ? 'skip' : d.type].push(item);
  }
  for (const key of ['link', 'insert', 'hold', 'skip'] as const) {
    lines.push(`## ${key.toUpperCase()} (${buckets[key].length})`);
    for (const item of buckets[key]) {
      const d = decisions.get(item.id)!;
      const detail =
        d.type === 'link'
          ? `${item.page} -> artwork ${d.wikiId} [${d.how}]`
          : d.type === 'hold'
            ? `${item.page} — ${d.reason}`
            : `${item.page} — ${d.reason}`;
      lines.push(`- ${item.title} (${item.year ?? item.yearRange ?? '?'}) ${detail}`);
    }
    lines.push('');
  }
  writeFileSync(REPORT, lines.join('\n'));

  // preview
  for (const item of items) {
    const d = decisions.get(item.id)!;
    if (d.type === 'insert') console.log(`NEW  arc:${item.id} "${item.title}" ${item.year ?? '?'} ${item.page}`);
    else if (d.type === 'hold') console.log(`HELD arc:${item.id} "${item.title}" — ${d.reason}`);
    else if (d.how !== 'already-imported') console.log(`LINK arc:${item.id} "${item.title}" -> ${d.wikiId} (${d.how})`);
  }

  const linked: string[] = [];
  const inserted: string[] = [];
  if (apply) {
    for (const item of items) {
      const d = decisions.get(item.id)!;
      const extId = `arc:${item.id}`;
      if (d.type === 'insert') {
        const [row] = await db
          .insert(artworks)
          .values({
            artistId: artistRow[0].id,
            provider: PROVIDER,
            externalId: extId,
            title: item.title,
            year: item.year,
            imageUrl: item.url || null,
            paintingUrl: item.page,
            metadata: { arcId: item.id, arcDateRange: item.yearRange, medium: item.medium, titleSource: 'artrenewal' },
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({ target: [artworks.provider, artworks.externalId], set: { updatedAt: new Date() } })
          .returning({ id: artworks.id });
        await upsertArtworkSource({
          artworkId: row.id,
          provider: PROVIDER,
          externalId: extId,
          sourceUrl: item.page,
          imageUrl: item.url || null,
          title: item.title,
          confidence: 100,
          isPrimary: true,
          lastSyncedAt: new Date(),
        });
        inserted.push(`artwork ${row.id} "${item.title}" <- arc:${item.id}`);
        console.log(`INSERT artwork ${row.id} "${item.title}" <- arc:${item.id}`);
      } else if (d.type === 'link' && d.how !== 'already-imported') {
        await upsertArtworkSource({
          artworkId: d.wikiId,
          provider: PROVIDER,
          externalId: extId,
          sourceUrl: item.page,
          imageUrl: item.url || null,
          title: item.title,
          confidence: d.confidence,
          isPrimary: false,
          lastSyncedAt: new Date(),
        });
        linked.push(`arc:${item.id} -> artwork ${d.wikiId} (${d.how})`);
        console.log(`LINK arc:${item.id} -> artwork ${d.wikiId} (${d.how})`);
      }
    }
  }

  const held = buckets.hold.length;
  console.log(`MODE=${apply ? 'APPLY' : 'DRY-RUN'} source=arc total=${items.length} link=${buckets.link.length} insert=${buckets.insert.length} HELD=${held} linked=${linked.length} inserted=${inserted.length} report=${REPORT}`);
  if (apply && inserted.length !== buckets.insert.length) throw new Error(`inserted ${inserted.length} != planned ${buckets.insert.length}`);
  const plannedLinks = buckets.link.filter((i) => decisions.get(i.id)!.type === 'link' && (decisions.get(i.id) as { how: string }).how !== 'already-imported').length;
  if (apply && linked.length !== plannedLinks) throw new Error(`linked ${linked.length} != planned ${plannedLinks}`);
}

main().catch((e) => {
  console.error('ARC-IMPORT FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
