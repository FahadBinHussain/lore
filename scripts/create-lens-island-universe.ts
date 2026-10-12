// Universe creator: Len's Island (AGENTS "Universe creation workflow").
// Research: research/lens-island-franchise.md (gitignored — never commit it).
// Premise note: "Lens Island" is officially "Len's Island" (apostrophe), Flow Studio (Brisbane),
// NOT Image & Form/Thunderful — research corrected this 2026-09-30.
// Verify-then-insert: the bound game is re-verified against IGDB in this run (title assertion),
// then inserted through ensureCanonicalMediaItem. Manual completion phase (user-approved
// 2026-09-30): 2 Steam storefront soundtrack apps (no MusicBrainz/Discogs/ListenBrainz record)
// get source='manual' rows, each with its evidence URL in media_external_ids.source_url.
// Run: npx esbuild bundle -> node --env-file=.env.local <bundle>.cjs [dry|apply|manual-dry|manual-apply]
import { db } from '../src/db/index';
import { collections, collectionItems, mediaExternalIds, mediaItems, users } from '../src/db/schema';
import { ensureCanonicalMediaItem, ensureMediaExternalMapping } from '../src/lib/media/canonical';
import { and, eq } from 'drizzle-orm';

type MediaType = 'game' | 'soundtrack';

type ResearchItem = {
  mediaType: MediaType;
  title: string;
  source: string;
  externalId: string;
  releaseDate: string | null;
  author?: string;
  publisher?: string | null;
  notes?: string;
  keepResearchDate?: boolean; // deliberate override of the provider date (research decision)
};

const GAME_IDS = [136594];

// Research inventory (bound items only).
const ITEMS: ResearchItem[] = [
  // ---- games (1, IGDB) ----
  {
    mediaType: 'game',
    title: "Len's Island",
    source: 'igdb',
    externalId: '136594',
    releaseDate: '2021-11-26',
    keepResearchDate: true,
    notes: 'bound date = original public release (Steam "Early Access Release Date" + IGDB release_dates rows); IGDB first_release_date and Steam "Release Date" say 2025-06-19 (1.0 full release: co-op + endgame); Wikidata P577 2021-11-05 is wrong, ignored; dev+pub Flow Studio, co-pub Fireshine Games; Windows + Mac only',
  },
];

// ---------------------------------------------------------------- manual phase
// User-approved 2026-09-30: the 2 researched-but-unbound Steam music apps become
// source='manual' rows, each carrying its real evidence URL in media_external_ids.source_url.
type ManualItem = {
  mediaType: MediaType;
  title: string;
  releaseDate: string | null;
  sourceUrl: string;
  evidence: string;
  whyUnbound: string;
  verifyVia: 'http';
  author?: string;
  notes?: string;
};

const MANUAL_ITEMS: ManualItem[] = [
  {
    mediaType: 'soundtrack',
    title: "Len's Island Full Soundtrack",
    releaseDate: '2021-11-26',
    sourceUrl: 'https://store.steampowered.com/app/1787330/',
    evidence: 'Steam storefront music app (type=music, fullgame=1335830)',
    whyUnbound: "MusicBrainz 8 queries -> 0, Discogs exact search -> 0, ListenBrainz has no keyless entity search (metadata derives from MB), Last.fm key not configured, steam provider is game-only (checked 2026-09-30)",
    verifyVia: 'http',
    author: 'Lars Erik Fjosne-Eide',
    notes: '28 tracks; app sells both albums; store date 2021-11-26 is the original listing date and the description was expanded after Album 2 shipped (overlap held, research §10.4)',
  },
  {
    mediaType: 'soundtrack',
    title: "Len's Island Original Soundtrack - Album 2",
    releaseDate: '2023-01-02',
    sourceUrl: 'https://store.steampowered.com/app/2254850/',
    evidence: 'Steam storefront music app (type=music)',
    whyUnbound: "MusicBrainz 8 queries -> 0, Discogs exact search -> 0, ListenBrainz has no keyless entity search (metadata derives from MB), Last.fm key not configured, steam provider is game-only (checked 2026-09-30)",
    verifyVia: 'http',
    author: 'Lars Erik Fjosne-Eide & Arslan Qureshi',
    notes: '17 tracks, Vol.2',
  },
];

// same rule as canonical.ts toCuratedExternalId — manual rows key off it
function curatedId(mediaType: string, title: string, releaseDate: string | null): string {
  const titleToken = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
  const yearToken = releaseDate && /^\d{4}/.test(releaseDate) ? releaseDate.slice(0, 4) : 'na';
  return `curated-${mediaType}-${yearToken}-${titleToken}`;
}

// ---------------------------------------------------------------- helpers

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type NamedRef = { id?: number; name?: string };
type IgdbGame = {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  cover?: { url?: string };
  rating?: number;
  genres?: NamedRef[];
  platforms?: NamedRef[];
  involved_companies?: Array<{ developer?: boolean; publisher?: boolean; company?: { name?: string } }>;
};

async function fetchJson(url: string, init?: RequestInit, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.status === 429 || resp.status >= 500) {
        if (attempt === retries) throw new Error(`HTTP ${resp.status} after ${retries} tries: ${url}`);
        await sleep(1500 * attempt);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
      return await resp.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
  throw new Error('unreachable');
}

async function fetchText(url: string, init?: RequestInit, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.ok) return await resp.text();
    if (attempt === retries) throw new Error(`HTTP ${resp.status}: ${url}`);
    await sleep(1200 * attempt);
  }
  throw new Error('unreachable');
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Title assertion: exact/containment after normalization, else compare the cores left after
// stripping the franchise prefix. Containment (non-exact) matches are logged loudly.
function titlesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const sa = na.replace(/^lensisland/, '');
  const sb = nb.replace(/^lensisland/, '');
  if (!sa || !sb) return false;
  return sa.includes(sb) || sb.includes(sa);
}

function unixToIso(unix?: number): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString().split('T')[0];
}

type VerifiedItem = ResearchItem & {
  posterPath?: string | null;
  backdropPath?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  developer?: string | null;
  rating?: number | null;
  status?: string | null;
  verifiedDate?: string | null;
  providerTitle?: string;
  alreadyInDb?: boolean;
};

const failures: string[] = [];

// ---------------------------------------------------------------- verifiers

async function verifyGames(): Promise<Map<string, IgdbGame>> {
  const clientId = process.env.IGDB_CLIENT_ID!;
  const clientSecret = process.env.IGDB_CLIENT_SECRET!;
  const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!tokenResp.ok) throw new Error(`IGDB token HTTP ${tokenResp.status}`);
  const { access_token } = (await tokenResp.json()) as { access_token: string };

  const body = `fields id, name, summary, first_release_date, cover.url, rating, genres.name, platforms.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher; where id = (${GAME_IDS.join(',')}); limit 20;`;
  const rows = (await fetchJson('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': clientId, Authorization: `Bearer ${access_token}`, 'Content-Type': 'text/plain' },
    body,
  })) as IgdbGame[];

  const byId = new Map<string, IgdbGame>();
  for (const row of rows) byId.set(String(row.id), row);
  return byId;
}

async function checkListenNotesPodcasts(): Promise<string[]> {
  const key = process.env.LISTEN_NOTES_API_KEY || process.env.LISTENNOTES_API_KEY;
  if (!key) return ['LISTEN_NOTES_API_KEY missing — podcast check skipped (source gap)'];
  try {
    const data = await fetchJson('https://listen-api.listennotes.com/api/v2/search?q=len%27s%20island&type=podcast', {
      headers: { 'X-ListenAPI-Key': key },
    });
    const results = (data.results ?? []) as Array<{ id: string; title: string; publisher: string }>;
    if (results.length === 0) return ['ListenNotes OK: 0 podcast results for "len\'s island"'];
    return results.slice(0, 5).map((r) => `candidate: "${r.title}" (${r.publisher}) id=${r.id}`);
  } catch (err) {
    return [`ListenNotes check failed: ${(err as Error).message} (research saw HTTP 401 — source gap)`];
  }
}

async function checkBggBoardGames(): Promise<string[]> {
  try {
    const headers: Record<string, string> = {};
    if (process.env.BGG_API_KEY) headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;
    const xml = await fetchText(`https://boardgamegeek.com/xmlapi2/search?query=len's%20island&type=boardgame`, { headers });
    if (/<item /.test(xml)) return ['HIT — BGG search returned items (board-game absence no longer proven):', xml.slice(0, 500)];
    return ["BGG search OK: 0 boardgame results for \"len's island\""];
  } catch (err) {
    return [`BGG check failed: ${(err as Error).message} (research saw 401/403 — source gap, absence unproven)`];
  }
}

// ---------------------------------------------------------------- manual phase

// Evidence-URL verification (loud failure before any write): plain GET must answer 200.
async function verifyManualSources(): Promise<void> {
  const fails: string[] = [];
  for (const item of MANUAL_ITEMS.filter((i) => i.verifyVia === 'http')) {
    try {
      const body = await fetchText(item.sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lore-research/1.0)' } });
      if (!body) fails.push(`empty body: ${item.sourceUrl}`);
      else console.log(`  ok  http 200  ${item.sourceUrl}`);
    } catch (err) {
      fails.push(`http check failed for ${item.sourceUrl}: ${err}`);
    }
  }
  if (fails.length > 0) {
    console.error('\n!! manual source verification FAILED — nothing will be written:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }
}

async function runManual(mode: 'manual-dry' | 'manual-apply'): Promise<void> {
  console.log(`Len's Island manual completion — mode=${mode} (items=${MANUAL_ITEMS.length})\n`);

  const collection = await db.query.collections.findFirst({ where: eq(collections.slug, 'lens-island') });
  if (!collection) {
    console.error('!! collection lens-island not found — run dry/apply (bound phase) first');
    process.exit(1);
  }

  console.log('[1/3] verifying evidence sources...');
  await verifyManualSources();

  const existing = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collection.id),
    with: { mediaItem: true },
  });
  const byTitle = new Map(existing.map((r) => [`${r.mediaItem.mediaType}\u0000${r.mediaItem.title}`, r.mediaItemId]));
  const memberIds = new Set(existing.map((r) => r.mediaItemId));

  type Plan = { item: ManualItem; extId: string; mediaItemId: number | null };
  const plans: Plan[] = [];
  const problems: string[] = [];
  for (const item of MANUAL_ITEMS) {
    const extId = curatedId(item.mediaType, item.title, item.releaseDate);
    const found = await db.query.mediaItems.findFirst({
      where: and(eq(mediaItems.source, 'manual'), eq(mediaItems.mediaType, item.mediaType), eq(mediaItems.externalId, extId)),
    });
    const clash = byTitle.get(`${item.mediaType}\u0000${item.title}`);
    if (!found && clash !== undefined) {
      problems.push(`duplicate title within ${item.mediaType} with a different identity: "${item.title}" (media_item ${clash})`);
    }
    plans.push({ item, extId, mediaItemId: found?.id ?? null });
  }
  if (problems.length > 0) {
    console.error('\n!! manual insert aborted before any write:');
    for (const p of problems) console.error(`   - ${p}`);
    process.exit(1);
  }

  const newCount = plans.filter((p) => !p.mediaItemId).length;
  console.log(`\n[2/3] plan — ${plans.length} items (${plans.length - newCount} already in DB, ${newCount} new):`);
  plans.forEach((p, i) => {
    const date = p.item.releaseDate ?? '        --';
    console.log(`  ${String(i + 1).padStart(2)}. ${date}  ${p.item.mediaType.padEnd(11)} ${p.item.title}${p.mediaItemId ? ' [exists]' : ''}`);
    console.log(`      src ${p.item.sourceUrl}`);
  });

  if (mode === 'manual-dry') {
    console.log('\ndry run — nothing written. Re-run with: manual-apply');
    return;
  }

  // ------------------------------------------------------------ manual-apply
  console.log('\napplying...');
  let made = 0;
  let reused = 0;
  for (const p of plans) {
    const mappingMeta = { evidence: p.item.evidence, why_unbound: p.item.whyUnbound, checked: '2026-09-30' };
    const result = await ensureCanonicalMediaItem({
      source: 'manual',
      externalId: p.extId,
      mediaType: p.item.mediaType,
      title: p.item.title,
      releaseDate: p.item.releaseDate,
      author: p.item.author ?? null,
      mappingMetadata: mappingMeta,
    });
    if (!result) {
      console.error(`!! ensureCanonicalMediaItem returned null for ${p.extId} — aborting`);
      process.exit(1);
    }
    if (result.created) made++; else reused++;
    const mapping = await ensureMediaExternalMapping({
      mediaItemId: result.mediaItem.id,
      provider: 'manual',
      mediaType: p.item.mediaType,
      externalId: p.extId,
      sourceUrl: p.item.sourceUrl,
      confidence: 100,
      isPrimary: true,
      metadata: { ...mappingMeta, verified_via: p.item.verifyVia },
    });
    if (!mapping || mapping.sourceUrl !== p.item.sourceUrl) {
      console.error(`!! source_url not stored on media_external_ids for ${p.extId} — aborting`);
      process.exit(1);
    }
    p.mediaItemId = result.mediaItem.id;
    const alreadyMember = memberIds.has(result.mediaItem.id);
    if (!alreadyMember) {
      await db.insert(collectionItems).values({
        collectionId: collection.id,
        mediaItemId: result.mediaItem.id,
        releaseOrder: 0, // renumbered below
        chronologicalOrder: null, // story placement unknown — unplaced per chrono rule
        groupName: null,
        isRequired: true,
        notes: p.item.notes ?? null,
      });
    }
    console.log(`  ${result.created ? 'created' : 'reused '} media_item ${result.mediaItem.id}${alreadyMember ? '' : ' + membership'} — ${p.item.title}`);
  }

  console.log('\n[3/3] renumbering release_order (date asc, nulls last, existing before new on ties)...');
  const rows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collection.id),
    with: { mediaItem: true },
  });
  const ordKey = (r: { releaseOrder: number }) => (r.releaseOrder > 0 ? r.releaseOrder : Number.MAX_SAFE_INTEGER);
  const sorted = [...rows].sort((a, b) => {
    const da = a.mediaItem.releaseDate;
    const dbv = b.mediaItem.releaseDate;
    if (!da && dbv) return 1;
    if (da && !dbv) return -1;
    if (da && dbv && da !== dbv) return da < dbv ? -1 : 1;
    return ordKey(a) - ordKey(b);
  });
  let changed = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].releaseOrder !== i + 1) {
      await db.update(collectionItems).set({ releaseOrder: i + 1 }).where(eq(collectionItems.id, sorted[i].id));
      changed++;
    }
  }
  console.log(`  renumbered ${changed} rows`);

  const finalRows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collection.id),
    with: { mediaItem: true },
  });
  const fails: string[] = [];
  const expected = ITEMS.length + MANUAL_ITEMS.length;
  if (finalRows.length !== expected) fails.push(`expected ${expected} memberships, got ${finalRows.length}`);
  const ids = new Set(finalRows.map((r) => r.mediaItemId));
  if (ids.size !== finalRows.length) fails.push(`duplicate memberships: ${finalRows.length - ids.size} duplicates`);
  const orders = finalRows.map((r) => r.releaseOrder).sort((a, b) => a - b);
  if (orders.some((o, i) => o !== i + 1)) fails.push('release_order not contiguous 1..n');
  if (finalRows.some((r) => r.chronologicalOrder !== null)) fails.push('chronological_order must stay NULL (unplaced)');
  const typeTitleKeys = finalRows.map((r) => `${r.mediaItem.mediaType}\u0000${r.mediaItem.title}`);
  const dupKeys = [...new Set(typeTitleKeys.filter((k, i) => typeTitleKeys.indexOf(k) !== i))];
  if (dupKeys.length > 0) fails.push(`duplicate titles within a media type: ${dupKeys.map((k) => k.replace('\u0000', ' / ')).join(' | ')}`);
  const byType: Record<string, number> = {};
  for (const r of finalRows) byType[r.mediaItem.mediaType] = (byType[r.mediaItem.mediaType] ?? 0) + 1;
  for (const p of plans) {
    const ext = await db.query.mediaExternalIds.findFirst({
      where: and(
        eq(mediaExternalIds.provider, 'manual'),
        eq(mediaExternalIds.mediaType, p.item.mediaType),
        eq(mediaExternalIds.externalId, p.extId)
      ),
    });
    if (!ext) fails.push(`no media_external_ids row for ${p.extId}`);
    else if (ext.sourceUrl !== p.item.sourceUrl) fails.push(`source_url mismatch for ${p.extId}: "${ext.sourceUrl}" != "${p.item.sourceUrl}"`);
  }
  await db.update(collections).set({ itemCount: finalRows.length, updatedAt: new Date() }).where(eq(collections.id, collection.id));

  if (fails.length > 0) {
    console.error('\n!! post-insert verification FAILED:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }

  const typeLine = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`\nDONE: collection ${collection.id} — ${finalRows.length} memberships (${made} created, ${reused} reused), release_order 1..${finalRows.length}`);
  console.log(`by type: ${typeLine}`);
  console.log('verify: /universes/lens-island  (univrs.vercel.app)');
}

async function main() {
  const mode = (process.argv[2] || 'dry').trim();
  if (mode === 'manual-dry' || mode === 'manual-apply') {
    await runManual(mode);
    return;
  }
  if (mode !== 'dry' && mode !== 'apply') {
    console.error(`unknown mode "${mode}" — use: dry | apply | manual-dry | manual-apply`);
    process.exit(2);
  }

  console.log(`Len's Island universe — mode=${mode} (items=${ITEMS.length})\n`);

  const verified: VerifiedItem[] = ITEMS.map((i) => ({ ...i }));

  // -- games (single IGDB batch)
  console.log('[1/4] verifying IGDB games...');
  const games = await verifyGames();
  for (const item of verified.filter((i) => i.mediaType === 'game')) {
    const g = games.get(item.externalId);
    if (!g) {
      failures.push(`igdb ${item.externalId} "${item.title}" — id not returned by IGDB`);
      continue;
    }
    if (!titlesMatch(item.title, g.name)) {
      failures.push(`igdb ${item.externalId} title mismatch: research "${item.title}" vs IGDB "${g.name}"`);
      continue;
    }
    if (norm(item.title) !== norm(g.name)) {
      console.log(`  ~  title matched by containment: research "${item.title}" vs IGDB "${g.name}"`);
    }
    item.providerTitle = g.name;
    const igdbDate = unixToIso(g.first_release_date);
    if (item.keepResearchDate && item.releaseDate) {
      item.verifiedDate = item.releaseDate;
      if (igdbDate && igdbDate !== item.releaseDate) {
        item.notes = [item.notes, `provider date ${igdbDate} deliberately overridden by research decision`].filter(Boolean).join('; ');
      }
    } else {
      item.verifiedDate = igdbDate ?? item.releaseDate;
    }
    item.description = g.summary || null;
    item.genres = (g.genres ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.platforms = (g.platforms ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.developer = g.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
    item.publisher = item.publisher ?? g.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
    item.rating = typeof g.rating === 'number' ? Number((g.rating / 10).toFixed(1)) : null;
    const coverUrl: string | null = g.cover?.url
      ? (g.cover.url.startsWith('//') ? `https:${g.cover.url}` : g.cover.url).replace('thumb', 'cover_big')
      : null;
    item.posterPath = coverUrl;
    if (!g.first_release_date && item.releaseDate) {
      item.notes = [item.notes, 'IGDB has no release date — research date used'].filter(Boolean).join('; ');
    }
    console.log(`  ok  igdb-${item.externalId} "${g.name}" → ${item.verifiedDate ?? 'undated'}`);
  }

  // -- source-gap checks (report only)
  console.log('\n[2/4] source-gap checks (report only):');
  for (const line of await checkListenNotesPodcasts()) console.log(`  podcast: ${line}`);
  for (const line of await checkBggBoardGames()) console.log(`  boardgame: ${line}`);

  // -- failures: loud, and apply refuses to write
  if (failures.length > 0) {
    console.error(`\n!! ${failures.length} VERIFICATION FAILURE(S):`);
    for (const f of failures) console.error(`   - ${f}`);
    if (mode === 'apply') {
      console.error('\napply aborted — fix the mismatches above, nothing was written.');
      process.exit(1);
    }
  }

  // -- duplicate checks
  const existingColl = await db.query.collections.findFirst({ where: eq(collections.slug, 'lens-island') });
  if (existingColl) {
    console.error(`\n!! collection slug "lens-island" already exists (id ${existingColl.id}) — refusing to create a duplicate. Expand the existing universe instead.`);
    process.exit(1);
  }

  const already: number[] = [];
  for (const item of verified) {
    const row = await db.query.mediaItems.findFirst({
      where: (t, { and, eq }) => and(eq(t.source, item.source), eq(t.externalId, item.externalId)),
    });
    if (row) {
      item.alreadyInDb = true;
      already.push(row.id);
    }
  }

  // -- release order: date asc (nulls last), stable within same date
  const ordered = [...verified].sort((a, b) => {
    const da = a.verifiedDate ?? a.releaseDate;
    const dbb = b.verifiedDate ?? b.releaseDate;
    if (!da && !dbb) return 0;
    if (!da) return 1;
    if (!dbb) return -1;
    if (da === dbb) return 0;
    return da < dbb ? -1 : 1;
  });

  const counts: Record<string, number> = {};
  for (const i of ordered) counts[i.mediaType] = (counts[i.mediaType] ?? 0) + 1;

  console.log(`\n[3/4] --- release order (${ordered.length} items) ---`);
  ordered.forEach((i, idx) => {
    const date = i.verifiedDate ?? i.releaseDate ?? '        --';
    const flag = i.alreadyInDb ? ' [exists]' : '';
    console.log(`${String(idx + 1).padStart(2)}. ${date}  ${i.mediaType.padEnd(11)} ${i.title}${flag}`);
  });
  console.log(`\nby type: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  if (already.length > 0) console.log(`already in DB (will be linked, not recreated): ${already.join(', ')}`);

  if (mode === 'dry') {
    console.log('\ndry run — nothing written. Re-run with: apply');
    return;
  }

  // ---------------------------------------------------------------- apply
  console.log('\napplying...');

  const creator = (process.env.CREATOR_EMAIL ? await db.query.users.findFirst({ where: eq(users.email, process.env.CREATOR_EMAIL) }) : null) || await db.query.users.findFirst();
  if (!creator) {
    console.error('!! no user found in database — aborting');
    process.exit(1);
  }

  const cover = verified.find((i) => i.externalId === '136594')?.posterPath ?? null;
  const [newUniverse] = await db.insert(collections).values({
    name: "Len's Island",
    slug: 'lens-island',
    description: "Every official Len's Island media item — the game and its soundtracks — in release order.",
    coverImage: cover,
    bannerImage: null,
    createdBy: creator.id,
    visibility: 'public',
    isFeatured: false,
    viewCount: 0,
    itemCount: ordered.length,
    followerCount: 0,
  }).returning();
  console.log(`collection created: id=${newUniverse.id} slug=${newUniverse.slug}`);

  let made = 0;
  let reused = 0;
  const memberships: Array<{ mediaItemId: number; releaseOrder: number }> = [];

  for (let idx = 0; idx < ordered.length; idx++) {
    const item = ordered[idx];
    const result = await ensureCanonicalMediaItem({
      source: item.source,
      externalId: item.externalId,
      mediaType: item.mediaType,
      title: item.title,
      description: item.description ?? null,
      posterPath: item.posterPath ?? null,
      backdropPath: item.backdropPath ?? null,
      releaseDate: item.verifiedDate ?? item.releaseDate,
      rating: item.rating ?? null,
      genres: item.genres ?? null,
      developer: item.developer ?? null,
      publisher: item.publisher ?? null,
      author: item.author ?? null,
      platforms: item.platforms ?? null,
      status: item.status ?? null,
    });
    if (!result) {
      console.error(`!! ensureCanonicalMediaItem returned null for ${item.mediaType} ${item.externalId} "${item.title}" — aborting`);
      process.exit(1);
    }
    if (result.created) made++; else reused++;
    memberships.push({ mediaItemId: result.mediaItem.id, releaseOrder: idx + 1 });
    console.log(`  [${idx + 1}/${ordered.length}] ${result.created ? 'created' : 'reused '} media_item ${result.mediaItem.id} — ${item.title}`);
  }

  await db.insert(collectionItems).values(
    memberships.map((m, idx) => ({
      collectionId: newUniverse.id,
      mediaItemId: m.mediaItemId,
      releaseOrder: m.releaseOrder,
      chronologicalOrder: null, // story placement unknown — unplaced per chrono rule
      groupName: null,
      isRequired: true,
      notes: ordered[idx].notes ?? null,
    }))
  );

  // -- post-insert verification (loud)
  const finalRows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, newUniverse.id),
    with: { mediaItem: true },
  });
  const fails: string[] = [];
  if (finalRows.length !== ITEMS.length) fails.push(`expected ${ITEMS.length} memberships, got ${finalRows.length}`);
  const distinctIds = new Set(finalRows.map((r) => r.mediaItemId));
  if (distinctIds.size !== finalRows.length) fails.push(`duplicate memberships: ${finalRows.length - distinctIds.size} duplicates`);
  const orders = finalRows.map((r) => r.releaseOrder).sort((a, b) => a - b);
  if (orders.some((o, i) => o !== i + 1)) fails.push('release_order not contiguous 1..n');
  if (finalRows.some((r) => r.chronologicalOrder !== null)) fails.push('chronological_order must stay NULL (unplaced)');
  const typeTitleKeys = finalRows.map((r) => `${r.mediaItem.mediaType}\u0000${r.mediaItem.title}`);
  const dupKeys = [...new Set(typeTitleKeys.filter((k, i) => typeTitleKeys.indexOf(k) !== i))];
  if (dupKeys.length > 0) fails.push(`duplicate titles within a media type: ${dupKeys.map((k) => k.replace('\u0000', ' / ')).join(' | ')}`);
  for (const item of verified) {
    const ext = await db.query.mediaExternalIds.findFirst({
      where: and(
        eq(mediaExternalIds.provider, item.source),
        eq(mediaExternalIds.mediaType, item.mediaType),
        eq(mediaExternalIds.externalId, item.externalId)
      ),
    });
    if (!ext || !ext.isPrimary) fails.push(`no primary media_external_ids row for ${item.source}/${item.externalId}`);
  }
  const dupColl = await db.query.collections.findMany({ where: eq(collections.slug, 'lens-island') });
  if (dupColl.length !== 1) fails.push(`expected exactly 1 collection row, got ${dupColl.length}`);
  if (fails.length > 0) {
    console.error('\n!! post-insert verification FAILED:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }

  const byType: Record<string, number> = {};
  for (const r of finalRows) byType[r.mediaItem.mediaType] = (byType[r.mediaItem.mediaType] ?? 0) + 1;
  const typeLine = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`\nDONE: collection ${newUniverse.id} "Len's Island" — ${finalRows.length} memberships, ${distinctIds.size} distinct media_items (${made} created, ${reused} reused), release_order 1..${finalRows.length}`);
  console.log(`by type: ${typeLine}`);
  console.log('verify: /universes/lens-island  (univrs.vercel.app)');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
