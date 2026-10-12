// Universe creator: SteamWorld (AGENTS "Universe creation workflow").
// Research: research/steamworld-franchise.md (gitignored — never commit it).
// Verify-then-insert: every bound item is re-verified against its provider API in this run
// (title assertion), then inserted through ensureCanonicalMediaItem (igdb/musicbrainz).
// Manual completion phase (user-approved 2026-09-30): 2 official YouTube series with no TMDB
// entry get source='manual' rows, each with its real evidence URL in media_external_ids.source_url.
// Run: npx esbuild bundle -> node --env-file=.env.local <bundle>.cjs [dry|apply|manual-dry|manual-apply]
import { db } from '../src/db/index';
import { collections, collectionItems, mediaExternalIds, mediaItems, users } from '../src/db/schema';
import { ensureCanonicalMediaItem, ensureMediaExternalMapping } from '../src/lib/media/canonical';
import { and, eq } from 'drizzle-orm';

type MediaType = 'game' | 'tv' | 'soundtrack';

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

const GAME_IDS = [84391, 5772, 15167, 24421, 27433, 114415, 232908, 298315];

// Research inventory (bound items only). Order = tie-break within the same date.
const ITEMS: ResearchItem[] = [
  // ---- games (8, IGDB) ----
  { mediaType: 'game', title: 'SteamWorld Tower Defense', source: 'igdb', externalId: '84391', releaseDate: '2010-07-05', notes: 'DSiWare (500 Nintendo Points); IGDB record has no platforms; status 8 = Delisted; JP release never happened' },
  { mediaType: 'game', title: 'SteamWorld Dig', source: 'igdb', externalId: '5772', releaseDate: '2013-08-07', notes: 'alt title "A Fistful of Dirt"; 3DS first, then PC 2013-12-05 and the rest' },
  { mediaType: 'game', title: 'SteamWorld Heist', source: 'igdb', externalId: '15167', releaseDate: '2015-12-10', keepResearchDate: true, notes: 'IGDB first_release_date says 2015-12-09; Wikipedia/Digital Foundry/Nintendo Life/IGN all say 2015-12-10 (3DS worldwide) — research date kept; Xbox One platform disputed (IGDB lists it undated) — not claimed' },
  { mediaType: 'game', title: 'SteamWorld Collection', source: 'igdb', externalId: '24421', releaseDate: '2016-09-30', keepResearchDate: true, notes: 'physical compilation (Dig + Heist + Outsider DLC); IGDB Wii U 2016-09-30 / PS4 2016-10-11, IGN retail coverage 2016-11-01 — earliest kept' },
  { mediaType: 'game', title: 'SteamWorld Dig 2', source: 'igdb', externalId: '27433', releaseDate: '2017-09-21', notes: 'Switch first, PC 2017-09-22' },
  { mediaType: 'game', title: 'SteamWorld Quest: Hand of Gilgamech', source: 'igdb', externalId: '114415', releaseDate: '2019-04-25', notes: 'physical Switch 2019-11-14 (Super Rare Games) = edition, not a separate item' },
  { mediaType: 'game', title: 'SteamWorld Build', source: 'igdb', externalId: '232908', releaseDate: '2023-12-01', notes: 'dev The Station, pub Thunderful Publishing (not Image & Form)' },
  { mediaType: 'game', title: 'SteamWorld Heist II', source: 'igdb', externalId: '298315', releaseDate: '2024-08-08', notes: 'dev Thunderful Development, pub Thunderful; composer Steam Powered Giraffe' },

  // ---- soundtracks (13, MusicBrainz release-groups — MB exact titles + MB dates) ----
  { mediaType: 'soundtrack', title: 'SteamWorld Dig Original Soundtrack', source: 'musicbrainz', externalId: 'df12c0e3-e1f9-472a-887a-8d5d5fbed482', releaseDate: '2014-04-14', author: 'Mattias Hammarin & Jonas Kjellberg', notes: 'MB date kept; Steam app 297900 says 2014-04-28' },
  { mediaType: 'soundtrack', title: 'Music From SteamWorld Heist', source: 'musicbrainz', externalId: '76ae4864-68c8-4d5b-b76b-c72077acf972', releaseDate: '2015-12-10', author: 'Steam Powered Giraffe', notes: 'MB date kept; Steam app 490320 says 2016-06-27 — MB date equals the game launch, possible copy, unproven' },
  { mediaType: 'soundtrack', title: 'SteamWorld Dig 2 OST', source: 'musicbrainz', externalId: 'cbefdc5e-40a7-412e-be26-06ef617232d6', releaseDate: '2017-09-22', author: 'Pelle Cahndlerby & Mikael Norrgård feat. El Huervo', notes: 'Steam app 718690 matches' },
  { mediaType: 'soundtrack', title: 'SteamWorld Dig OST - Extended Edition', source: 'musicbrainz', externalId: '0f713a53-3dac-40e6-b71f-06970c532b53', releaseDate: '2018-03-26', author: 'Image & Form Games', notes: 'MB-only, no Steam app' },
  { mediaType: 'soundtrack', title: 'Steamworld Quest (The Epic Rap of Gilgamech)', source: 'musicbrainz', externalId: 'd2f1de0a-cd90-4003-8d3c-bedd06c2af3e', releaseDate: '2019-05-15', author: 'Dan Bull', notes: 'MB single; MB spells the title "Steamworld"' },
  { mediaType: 'soundtrack', title: 'SteamWorld Quest OST', source: 'musicbrainz', externalId: 'd80be0db-3e5f-4e3b-ad6d-f6a70e0d04ad', releaseDate: '2019-06-03', author: 'Erik Gudmundson, Pelle Cahndlerby & Oscar Rydelius', notes: 'Steam app 1085590 matches' },
  { mediaType: 'soundtrack', title: 'SteamWorld Build (Original Game Soundtrack)', source: 'musicbrainz', externalId: 'c2f2a7d4-fa12-4027-8060-b1f2af4ea657', releaseDate: '2023-12-01', author: 'Ola Bäckström', notes: 'Steam app 2672410 matches' },
  { mediaType: 'soundtrack', title: 'SteamWorld Build "Jingle Bolts" (Original Game Soundtrack)', source: 'musicbrainz', externalId: '7904c213-44b4-4003-b43f-c5c73458f6e1', releaseDate: '2023-12-08', author: 'Ola Bäckström', notes: 'MB-only' },
  { mediaType: 'soundtrack', title: 'SteamWorld Build "Mechanical Meadows" (Original Game Soundtrack)', source: 'musicbrainz', externalId: '09e17726-5d77-4e6c-a0be-345c896a56f1', releaseDate: '2024-03-21', author: 'Ola Bäckström', notes: 'MB-only' },
  { mediaType: 'soundtrack', title: 'SteamWorld Build "Mechanized" (Original Game Soundtrack)', source: 'musicbrainz', externalId: '16715d69-cd3d-42b1-a80d-ea227b2524eb', releaseDate: '2024-04-04', author: 'Ola Bäckström', notes: 'MB-only; same date as the game\'s Mechanized DLC' },
  { mediaType: 'soundtrack', title: 'SteamWorld Build "Steam Wave" (Original Game Soundtrack)', source: 'musicbrainz', externalId: 'bd8e7189-014e-410d-8802-f9722b41fa6d', releaseDate: '2024-06-10', author: 'Ola Backström', notes: 'MB-only; MB\'s own spelling — no umlaut on this record' },
  { mediaType: 'soundtrack', title: 'Music From SteamWorld Heist II', source: 'musicbrainz', externalId: 'c170ec78-40b7-406d-b007-3030a9b4543c', releaseDate: '2024-08-08', author: 'Steam Powered Giraffe', notes: 'Steam app 3115280 matches' },
  { mediaType: 'soundtrack', title: 'SteamWorld Build "Steam Fright" (Original Game Soundtrack)', source: 'musicbrainz', externalId: '6092b74d-ace4-4561-b017-12db296e9496', releaseDate: '2024-10-10', author: 'Ola Bäckström', notes: 'MB-only' },
];

// ---------------------------------------------------------------- manual phase
// User-approved 2026-09-30: the 2 researched-but-unbound official YouTube series become
// source='manual' rows, each carrying its real evidence URL in media_external_ids.source_url.
type ManualItem = {
  mediaType: MediaType;
  title: string;
  releaseDate: string | null;
  sourceUrl: string;
  evidence: string;
  whyUnbound: string;
  verifyVia: 'fandom' | 'http' | 'search-index';
  wikiTitle?: string;
  status?: string;
  notes?: string;
};

const MANUAL_ITEMS: ManualItem[] = [
  {
    mediaType: 'tv',
    title: 'The Engine Room',
    releaseDate: '2015-09-10',
    sourceUrl: 'https://steamworld.fandom.com/wiki/The_Engine_Room',
    evidence: 'SteamWorld Wiki (fandom)',
    whyUnbound: 'TMDB search for "SteamWorld"/"Steam World" returns only steam-locomotive documentaries, zero franchise matches (checked 2026-09-30)',
    verifyVia: 'fandom',
    status: 'released',
    notes: 'official Image & Form YouTube lore/news webshow; first episode "The SteamWorld Timeline" 2015-09-10; ended, ≥20 episodes through 2016-10-20',
  },
  {
    mediaType: 'tv',
    title: 'SteamWorld Telegraph',
    releaseDate: '2023-10-31',
    sourceUrl: 'https://steamworld.wiki.gg/',
    evidence: 'SteamWorld Wiki (wiki.gg)',
    whyUnbound: 'TMDB search for "SteamWorld"/"Steam World" returns only steam-locomotive documentaries, zero franchise matches (checked 2026-09-30)',
    verifyVia: 'search-index',
    notes: 'official YouTube series replacing The Engine Room; series start = earliest verified episode 2023-10-31; end not established',
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
type MbReleaseGroup = { title?: string };

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
// stripping the franchise prefix (so two *different* SteamWorld titles never pass each other).
// Containment (non-exact) matches are logged loudly by the callers.
function titlesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const sa = na.replace(/^steamworld/, '');
  const sb = nb.replace(/^steamworld/, '');
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
  networks?: string[];
  developer?: string | null;
  rating?: number | null;
  seasons?: number | null;
  totalEpisodes?: number | null;
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

// MusicBrainz: rate limit ~1 req/s, TLS-level blocking on bursts, and throttled responses can
// come back 200 with an empty body — space lookups >= 3s apart and assert title is non-empty.
async function verifyMusicBrainzReleaseGroup(rgId: string): Promise<MbReleaseGroup> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await sleep(3100);
    try {
      const text = await fetchText(`https://musicbrainz.org/ws/2/release-group/${rgId}?fmt=json`, {
        headers: { 'User-Agent': 'LoreMediaTracker/1.0 (universe creator)' },
      });
      const parsed = JSON.parse(text) as MbReleaseGroup;
      if (!parsed.title) throw new Error('200 with empty title field (throttle?)');
      return parsed;
    } catch (err) {
      lastErr = err as Error;
      console.log(`  ~  MB retry for ${rgId.slice(0, 8)}… (${lastErr.message})`);
    }
  }
  throw new Error(`musicbrainz ${rgId} failed after 2 tries: ${lastErr?.message}`);
}

async function checkListenNotesPodcasts(): Promise<string[]> {
  const key = process.env.LISTEN_NOTES_API_KEY || process.env.LISTENNOTES_API_KEY;
  if (!key) return ['LISTEN_NOTES_API_KEY missing — podcast check skipped (source gap)'];
  try {
    const data = await fetchJson('https://listen-api.listennotes.com/api/v2/search?q=steamworld&type=podcast', {
      headers: { 'X-ListenAPI-Key': key },
    });
    const results = (data.results ?? []) as Array<{ id: string; title: string; publisher: string }>;
    if (results.length === 0) return ['ListenNotes OK: 0 podcast results for "steamworld"'];
    return results.slice(0, 5).map((r) => `candidate: "${r.title}" (${r.publisher}) id=${r.id}`);
  } catch (err) {
    return [`ListenNotes check failed: ${(err as Error).message} (research saw HTTP 401 — source gap)`];
  }
}

async function checkBggBoardGames(): Promise<string[]> {
  try {
    const headers: Record<string, string> = {};
    if (process.env.BGG_API_KEY) headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;
    const xml = await fetchText(`https://boardgamegeek.com/xmlapi2/search?query=steamworld&type=boardgame`, { headers });
    if (/<item /.test(xml)) return ['HIT — BGG search returned items (board-game absence no longer proven):', xml.slice(0, 500)];
    return ['BGG search OK: 0 boardgame results for "steamworld"'];
  } catch (err) {
    return [`BGG check failed: ${(err as Error).message} (research saw 401/403 — source gap, absence unproven)`];
  }
}

// ---------------------------------------------------------------- manual phase

// Evidence-URL verification (loud failure before any write):
//  - fandom: MediaWiki API title resolution on steamworld.fandom.com (page HTML is bot-blocked here)
//  - http: plain GET must answer 200
//  - search-index: wiki.gg 403s this host; existence confirmed via search index 2026-09-30
async function verifyManualSources(): Promise<void> {
  const fails: string[] = [];

  const fandomItems = MANUAL_ITEMS.filter((i) => i.verifyVia === 'fandom');
  if (fandomItems.length > 0) {
    const titles = fandomItems.map((i) => i.wikiTitle ?? i.title);
    try {
      const api =
        'https://steamworld.fandom.com/api.php?action=query&format=json&redirects=1&titles=' +
        titles.map((t) => encodeURIComponent(t)).join('%7C');
      const resp = (await fetchJson(api, { headers: { 'User-Agent': 'lore-research/1.0' } })) as {
        query?: { pages?: Record<string, { title?: string; missing?: unknown; invalid?: unknown }> };
      };
      const pages = resp.query?.pages ?? {};
      const missing = Object.values(pages)
        .filter((p) => p && typeof p === 'object' && ('missing' in p || 'invalid' in p))
        .map((p) => p.title ?? '?');
      if (missing.length > 0) fails.push(`fandom wiki pages missing: ${missing.join(' | ')}`);
      if (Object.keys(pages).length !== titles.length) fails.push(`fandom API returned ${Object.keys(pages).length} pages for ${titles.length} titles`);
      console.log(`  ok  fandom wiki: ${fandomItems.length} evidence page(s) resolve`);
    } catch (err) {
      fails.push(`fandom wiki API check failed: ${err}`);
    }
  }

  for (const item of MANUAL_ITEMS.filter((i) => i.verifyVia === 'http')) {
    try {
      const body = await fetchText(item.sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lore-research/1.0)' } });
      if (!body) fails.push(`empty body: ${item.sourceUrl}`);
      else console.log(`  ok  http 200  ${item.sourceUrl}`);
    } catch (err) {
      fails.push(`http check failed for ${item.sourceUrl}: ${err}`);
    }
  }

  for (const item of MANUAL_ITEMS.filter((i) => i.verifyVia === 'search-index')) {
    console.log(`  ~  search-index verified 2026-09-30 (wiki.gg blocks this host): ${item.sourceUrl}`);
  }

  if (fails.length > 0) {
    console.error('\n!! manual source verification FAILED — nothing will be written:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }
}

async function runManual(mode: 'manual-dry' | 'manual-apply'): Promise<void> {
  console.log(`SteamWorld manual completion — mode=${mode} (items=${MANUAL_ITEMS.length})\n`);

  const collection = await db.query.collections.findFirst({ where: eq(collections.slug, 'steamworld') });
  if (!collection) {
    console.error('!! collection steamworld not found — run dry/apply (bound phase) first');
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
    console.log(`  ${String(i + 1).padStart(2)}. ${date}  ${p.item.mediaType.padEnd(10)} ${p.item.title}${p.mediaItemId ? ' [exists]' : ''}`);
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
      status: p.item.status ?? null,
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
  console.log('verify: /universes/steamworld  (univrs.vercel.app)');
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

  console.log(`SteamWorld universe — mode=${mode} (items=${ITEMS.length})\n`);

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

  // -- soundtracks (13 MusicBrainz release-group lookups, >=3.1s apart)
  console.log('\n[2/4] verifying MusicBrainz release-groups...');
  for (const item of verified.filter((i) => i.mediaType === 'soundtrack')) {
    const rg = await verifyMusicBrainzReleaseGroup(item.externalId);
    if (!titlesMatch(item.title, rg.title ?? '')) {
      failures.push(`musicbrainz ${item.externalId} title mismatch: research "${item.title}" vs MB "${rg.title}"`);
      continue;
    }
    if (norm(item.title) !== norm(rg.title ?? '')) {
      console.log(`  ~  title matched by containment: research "${item.title}" vs MB "${rg.title}"`);
    }
    item.providerTitle = rg.title;
    item.verifiedDate = item.releaseDate; // MB date is the bound value (research decision)
    console.log(`  ok  ${item.externalId.slice(0, 8)}… "${rg.title}"`);
  }

  // -- source-gap checks (report only)
  console.log('\n[3/4] source-gap checks (report only):');
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
  const existingColl = await db.query.collections.findFirst({ where: eq(collections.slug, 'steamworld') });
  if (existingColl) {
    console.error(`\n!! collection slug "steamworld" already exists (id ${existingColl.id}) — refusing to create a duplicate. Expand the existing universe instead.`);
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

  // stable tie-break: keep input order for equal dates (Array.sort is stable in V8)

  const counts: Record<string, number> = {};
  for (const i of ordered) counts[i.mediaType] = (counts[i.mediaType] ?? 0) + 1;

  console.log(`\n[4/4] --- release order (${ordered.length} items) ---`);
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

  const cover = verified.find((i) => i.externalId === '5772')?.posterPath ?? null;
  const [newUniverse] = await db.insert(collections).values({
    name: 'SteamWorld',
    slug: 'steamworld',
    description: 'Every official Image & Form / Thunderful SteamWorld media item — games, soundtracks, and web series — in release order.',
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
      networks: item.networks ?? null,
      seasons: item.seasons ?? null,
      totalEpisodes: item.totalEpisodes ?? null,
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
  const dupColl = await db.query.collections.findMany({ where: eq(collections.slug, 'steamworld') });
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
  console.log(`\nDONE: collection ${newUniverse.id} "SteamWorld" — ${finalRows.length} memberships, ${distinctIds.size} distinct media_items (${made} created, ${reused} reused), release_order 1..${finalRows.length}`);
  console.log(`by type: ${typeLine}`);
  console.log('verify: /universes/steamworld  (univrs.vercel.app)');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
