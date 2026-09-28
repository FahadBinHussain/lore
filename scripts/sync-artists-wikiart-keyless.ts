// Live WikiArt keyless crawler (unofficial ?json=3/?json=2 XHR — no signup, may break on site change; fails loudly).
// 1) Discovers artists via /en/Alphabet/{a-z}?json=3 (paged)  2) syncs each artist meta + all paintings.
// Idempotent: skips artists synced within 24h. Resume by re-running.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs` (no .env in repo).
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { asc, isNull, or, sql } from 'drizzle-orm';

const BASE = 'https://www.wikiart.org';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'X-Requested-With': 'XMLHttpRequest' };
const DELAY_MS = 500;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const failures: string[] = [];
const zeroWork: string[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function jget(url: string, referer?: string): Promise<Record<string, unknown>> {
  let lastErr = '';
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const res = await fetch(url, { headers: referer ? { ...HEADERS, Referer: referer } : HEADERS });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') throw new Error(`non-JSON body FAILED url=${url} — no fallback, aborting artist`);
        return data;
      }
      lastErr = `status=${res.status}`;
      if (res.status !== 429 && res.status < 500) throw new Error(`request FAILED url=${url} ${lastErr} — no fallback, aborting artist`);
    } catch (e) {
      if (e instanceof Error && /aborting artist/.test(e.message)) throw e;
      lastErr = e instanceof Error ? `network:${e.message}` : `network:${String(e)}`;
    }
    const wait = Math.min(2000 * 2 ** (attempt - 1), 60000);
    console.log(`retry attempt=${attempt} ${lastErr} wait=${wait}ms url=${url}`);
    await sleep(wait);
  }
  throw new Error(`request FAILED url=${url} ${lastErr} after 6 attempts — no fallback, aborting artist`);
}

function parseYear(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseYearFromMs(raw: unknown): number | null {
  const m = /\/Date\((-?\d+)\)\//.exec(String(raw ?? ''));
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10));
  return Number.isFinite(d.getTime()) ? d.getUTCFullYear() : null;
}

async function discoverArtists(): Promise<number> {
  let discovered = 0;
  for (const letter of LETTERS) {
    for (let page = 1; page <= 100; page += 1) {
      const d = await jget(`${BASE}/en/Alphabet/${letter}?json=3&page=${page}`);
      const html = String(d.ArtistsHtml || '');
      const hits = [...html.matchAll(/href="\/en\/([a-z0-9\-]+)" title="([^"]+)"/g)];
      const clean = hits.map((m) => ({ slug: m[1], name: m[2] })).filter((a) => !a.slug.startsWith('artists-by-') && !a.slug.startsWith('paintings-by-'));
      for (const a of clean) {
        await db
          .insert(artists)
          .values({ provider: 'wikiart', externalId: a.slug, slug: a.slug, name: a.name, sourceUrl: `${BASE}/en/${a.slug}` })
          .onConflictDoNothing({ target: [artists.provider, artists.externalId] });
        discovered += 1;
      }
      console.log(`discover letter=${letter} page=${page} hits=${clean.length} more=${d.CanLoadMoreArtists}`);
      await sleep(DELAY_MS);
      if (!d.CanLoadMoreArtists || clean.length === 0) break;
    }
  }
  console.log(`discovery done rows=${discovered}`);
  return discovered;
}

async function syncArtist(row: { id: number; slug: string }) {
  const meta = await jget(`${BASE}/en/${row.slug}?json=2`);
  const bio = meta.biography ? String(meta.biography) : null;
  const birth = parseYearFromMs(meta.birthDay);
  const death = parseYearFromMs(meta.deathDay);
  const portrait = meta.image ? String(meta.image) : null;
  const name = meta.artistName ? String(meta.artistName) : row.slug;

  let total = 0;
  for (let page = 1; page <= 500; page += 1) {
    const url = `${BASE}/en/${row.slug}/mode/all-paintings?json=2&layout=new&page=${page}&resultType=masonry`;
    const d = await jget(url, `${BASE}/en/${row.slug}/mode/all-paintings`);
    const list = (Array.isArray(d.Paintings) ? d.Paintings : []) as Record<string, unknown>[];
    if (list.length === 0) break;
    for (const p of list) {
      const ext = String(p.id || p.paintingUrl || `${row.slug}-${page}-${total}`);
      await db
        .insert(artworks)
        .values({
          artistId: row.id,
          provider: 'wikiart',
          externalId: ext,
          title: String(p.title || 'Untitled').slice(0, 1000),
          year: parseYear(p.year),
          width: typeof p.width === 'number' ? p.width : null,
          height: typeof p.height === 'number' ? p.height : null,
          imageUrl: p.image ? String(p.image) : null,
          paintingUrl: p.paintingUrl ? `${BASE}${p.paintingUrl}` : null,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [artworks.provider, artworks.externalId],
          set: { title: String(p.title || 'Untitled').slice(0, 1000), year: parseYear(p.year), imageUrl: p.image ? String(p.image) : null, updatedAt: new Date() },
        });
      total += 1;
    }
    await sleep(DELAY_MS);
  }

  if (total === 0) {
    // WikiArt can advertise N artworks in the <title> while serving zero rows
    // (copyright/geo-restricted artists: no painting URLs in sitemap, all XHR pages empty).
    let claimed: string | null = null;
    try {
      const html = await (await fetch(`${BASE}/en/${row.slug}`, { headers: { 'User-Agent': HEADERS['User-Agent'] } })).text();
      claimed = / - (\d+) artworks? - /.exec(html)?.[1] ?? null;
    } catch {
      claimed = null;
    }
    if (claimed) {
      zeroWork.push(`${row.slug}(title claims ${claimed}, api 0)`);
      console.error(`ZERO-WORK ${row.slug}: page title claims ${claimed} artworks but all-paintings API returns 0 — artist is copyright/geo-restricted, nothing to sync`);
    } else {
      zeroWork.push(`${row.slug}(no count in title, api 0)`);
      console.error(`ZERO-WORK ${row.slug}: all-paintings API returns 0 and the page advertises no artwork count — artist row has no works (verify on wikiart.org before treating as a crawl miss)`);
    }
  }

  await db
    .update(artists)
    .set({ name, biography: bio ?? undefined, birthYear: birth ?? undefined, deathYear: death ?? undefined, imageUrl: portrait ?? undefined, artworkCount: total, lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(sql`${artists.id} = ${row.id}`);
  console.log(`synced ${row.slug} works=${total}`);
}

async function main() {
  const mode = process.argv[2] || 'sync';
  if (mode === 'discover') {
    await discoverArtists();
    return;
  }
  if (mode === 'single') {
    const slug = process.argv[3];
    if (!slug) throw new Error('single mode requires slug arg');
    const found = await db
      .select({ id: artists.id, slug: artists.slug })
      .from(artists)
      .where(sql`${artists.provider} = 'wikiart' AND ${artists.slug} = ${slug}`);
    const row = found[0] || (await db.insert(artists).values({ provider: 'wikiart', externalId: slug, slug, name: slug, sourceUrl: `${BASE}/en/${slug}` }).returning({ id: artists.id, slug: artists.slug }))[0];
    await syncArtist(row);
    return;
  }

  await discoverArtists();
  const todo = await db
    .select({ id: artists.id, slug: artists.slug })
    .from(artists)
    .where(or(isNull(artists.lastSyncedAt), sql`${artists.lastSyncedAt} < now() - interval '24 hours'`))
    .orderBy(sql`${artists.seedRev} is not null`, asc(artists.id));
  console.log(`todo artists=${todo.length}`);

  let done = 0;
  for (const row of todo) {
    try {
      await syncArtist(row);
    } catch (e) {
      failures.push(`${row.slug}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`FAILED ${row.slug}: ${e instanceof Error ? e.message : e}`);
    }
    done += 1;
    if (done % 25 === 0) console.log(`progress ${done}/${todo.length}`);
    await sleep(DELAY_MS);
  }
  console.log(`DONE synced=${todo.length - failures.length} FAILED=${failures.length} ZERO-WORK=${zeroWork.length}`);
  for (const f of failures) console.error(`FAIL ${f}`);
  for (const z of zeroWork) console.error(`ZERO-WORK ${z}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('CRAWL FAILED:', e);
  process.exit(1);
});
