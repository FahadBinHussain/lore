// Universe creator: Treasure Seekers (AGENTS "Universe creation workflow").
// Research: research/treasure-seekers-franchise.md (gitignored — never commit it).
// Franchise note: Artogon's 4-game HOPA series (2008–2011), Big Fish PC/Mac + G5 iOS —
// the Elephant Games premise was disproven by research (2026-10-06).
// Verify-then-insert: every game is re-verified against IGDB in this run (title assertion),
// then inserted through ensureCanonicalMediaItem. No manual items (research found none),
// so manual-dry/manual-apply print "no manual items".
// Date decisions (recorded in collection_items.notes):
//   TS1 2008-11-11 = IGDB PC row (its iOS row wrongly copies PC; real iOS window 2010-10).
//   TS2 2009-05-30 kept over fandom's 05-27 (binding provider + GameFAQs agree).
//   TS3 2010-02-25 keepResearchDate override — IGDB's base record says 2011 but is internally
//       inconsistent (its own CE record says 2010-06-26; fandom x2, JiG, GameFAQs, MobyGames = 2010).
//   TS4 2011-01-21 kept over fandom's 01-20 (binding provider + GameFAQs agree).
// Run: npx esbuild bundle -> node --env-file=.env.local <bundle>.cjs [dry|apply|manual-dry|manual-apply]
import { db } from '../src/db/index';
import { collections, collectionItems, mediaExternalIds, users } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { and, eq } from 'drizzle-orm';

type MediaType = 'game';

type ResearchItem = {
  mediaType: MediaType;
  title: string;
  source: string;
  externalId: string;
  releaseDate: string | null;
  notes?: string;
  keepResearchDate?: boolean; // deliberate override of the provider date (research decision)
};

const GAME_IDS = [64728, 124404, 47031, 226208];

// Research inventory (all 4 bound items; research/treasure-seekers-franchise.md totals audited
// against this table before scripting — every totals row resolves to verifiable ids).
const ITEMS: ResearchItem[] = [
  {
    mediaType: 'game',
    title: 'Treasure Seekers: Visions of Gold',
    source: 'igdb',
    externalId: '64728',
    releaseDate: '2008-11-11',
    notes: 'IGDB PC row is canonical; its iOS row wrongly copies the PC date — real iOS (G5) window is 2010-10 (GameFAQs 2010-10-19 / IGN 2010-10-27, HD build 2011-07-28 per RAWG); stray "2008-07-30" in minor DBs is Crystal Portal, rejected',
  },
  {
    mediaType: 'game',
    title: 'Treasure Seekers 2: The Enchanted Canvases',
    source: 'igdb',
    externalId: '124404',
    releaseDate: '2009-05-30',
    notes: 'date conflict: fandom says 2009-05-27, IGDB + GameFAQs Big Fish company page say 2009-05-30 — kept the binding provider date; JiG review 2009-06-05 fits either',
  },
  {
    mediaType: 'game',
    title: 'Treasure Seekers 3: Follow the Ghosts',
    source: 'igdb',
    externalId: '47031',
    releaseDate: '2010-02-25',
    keepResearchDate: true,
    notes: 'IGDB first_release_date 2011-06-09 (iOS row) and PC row 2011-07-23 are a data error — internally inconsistent (IGDB CE record itself says 2010-06-26) and contradicted by fandom x2, JiG review 2010-03-19, GameFAQs 2010, MobyGames 2010; day-level 02-25 rests on fandom alone',
  },
  {
    mediaType: 'game',
    title: 'Treasure Seekers: The Time Has Come',
    source: 'igdb',
    externalId: '226208',
    releaseDate: '2011-01-21',
    notes: 'date conflict: fandom says 2011-01-20, IGDB + GameFAQs say 2011-01-21 — kept the binding provider date; series finale (Nelly and Tom vs Totenkraft)',
  },
];

// ---------------------------------------------------------------- manual phase
// Research found zero manual-worthy items: all 4 games are IGDB-bound; movies/tv/books/
// soundtracks/themeparks swept to 0 franchise matches; comics (Comic Vine 403), board games
// (BGG 401/403) and podcasts (ListenNotes key gap) are source gaps, not confirmed absences —
// report-only below, never silently manual.
const MANUAL_ITEMS: never[] = [];

// ---------------------------------------------------------------- helpers

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
type NamedRef = { id?: number; name?: string };

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
    try {
      const resp = await fetch(url, init);
      if (resp.ok) return await resp.text();
      if (attempt === retries) throw new Error(`HTTP ${resp.status}: ${url}`);
    } catch (err) {
      if (attempt === retries) throw err;
    }
    await sleep(1200 * attempt);
  }
  throw new Error('unreachable');
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Title assertion: exact match, else containment after normalization (loud log upstream).
// The franchise-prefix strip lets "Treasure Seekers 3: ..." match an IGDB record that
// drops the number — two different TS titles still never pass each other's check.
function titlesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const sa = na.replace(/^treasureseekers\d*/, '');
  const sb = nb.replace(/^treasureseekers\d*/, '');
  if (!sa || !sb) return false;
  return sa.includes(sb) || sb.includes(sa);
}

function unixToIso(unix?: number): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString().split('T')[0];
}

type VerifiedItem = ResearchItem & {
  posterPath?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  developer?: string | null;
  publisher?: string | null;
  rating?: number | null;
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
    const data = await fetchJson('https://listen-api.listennotes.com/api/v2/search?q=treasure%20seekers&type=podcast', {
      headers: { 'X-ListenAPI-Key': key },
    });
    const results = (data.results ?? []) as Array<{ id: string; title: string; publisher: string }>;
    if (results.length === 0) return ['ListenNotes OK: 0 podcast results for "treasure seekers"'];
    return results.slice(0, 5).map((r) => `candidate: "${r.title}" (${r.publisher}) id=${r.id}`);
  } catch (err) {
    return [`ListenNotes check failed: ${(err as Error).message} (standing key gap — research saw 401, source gap)`];
  }
}

async function checkBggBoardGames(): Promise<string[]> {
  try {
    const headers: Record<string, string> = {};
    if (process.env.BGG_API_KEY) headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;
    const xml = await fetchText(`https://boardgamegeek.com/xmlapi2/search?query=treasure%20seekers&type=boardgame`, { headers });
    if (/<item /.test(xml)) return ['HIT — BGG search returned items (board-game absence no longer proven):', xml.slice(0, 500)];
    return ['BGG search OK: 0 boardgame results for "treasure seekers"'];
  } catch (err) {
    return [`BGG check failed: ${(err as Error).message} (research saw 401/403 — source gap, absence unproven)`];
  }
}

async function checkComicVineComics(): Promise<string[]> {
  try {
    await fetchText('https://comicvine.gamespot.com/search/?category=8&query=treasure+seekers', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lore-research/1.0)' },
    });
    return ['Comic Vine search answered 200 — re-run the research sweep; absence is still unproven until volumes are checked'];
  } catch (err) {
    return [`Comic Vine check failed: ${(err as Error).message} (research saw 403 bot wall — source gap, absence unproven)`];
  }
}

// ---------------------------------------------------------------- manual phase

async function runManual(mode: 'manual-dry' | 'manual-apply'): Promise<void> {
  if (MANUAL_ITEMS.length === 0) {
    console.log('Treasure Seekers manual completion — no manual items (all 4 games IGDB-bound; gaps are report-only)');
    return;
  }
  console.log(`Treasure Seekers manual completion — mode=${mode} (items=${MANUAL_ITEMS.length}) — unreachable with an empty MANUAL_ITEMS list`);
  process.exit(2);
}

// ---------------------------------------------------------------- main

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

  console.log(`Treasure Seekers universe — mode=${mode} (items=${ITEMS.length})\n`);

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
      if (igdbDate && item.releaseDate && igdbDate !== item.releaseDate) {
        item.notes = [item.notes, `research date ${item.releaseDate} differs from provider ${igdbDate} — provider kept`].filter(Boolean).join('; ');
      }
    }
    item.description = g.summary || null;
    item.genres = (g.genres ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.platforms = (g.platforms ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.developer = g.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
    item.publisher = g.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
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
  for (const line of await checkComicVineComics()) console.log(`  comic: ${line}`);

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
  const existingColl = await db.query.collections.findFirst({ where: eq(collections.slug, 'treasure-seekers') });
  if (existingColl) {
    console.error(`\n!! collection slug "treasure-seekers" already exists (id ${existingColl.id}) — refusing to create a duplicate. Expand the existing universe instead.`);
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

  const creator = await db.query.users.findFirst({ where: eq(users.email, 'fahadbinhussain001@gmail.com') });
  if (!creator) {
    console.error('!! creator user fahadbinhussain001@gmail.com not found — aborting');
    process.exit(1);
  }

  const cover = verified.find((i) => i.externalId === '64728')?.posterPath ?? null;
  const [newUniverse] = await db.insert(collections).values({
    name: 'Treasure Seekers',
    slug: 'treasure-seekers',
    description: "Every official Treasure Seekers media item — Artogon's four hidden-object adventures (2008–2011) — in release order.",
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
      backdropPath: null,
      releaseDate: item.verifiedDate ?? item.releaseDate,
      rating: item.rating ?? null,
      genres: item.genres ?? null,
      developer: item.developer ?? null,
      publisher: item.publisher ?? null,
      author: null,
      platforms: item.platforms ?? null,
      status: null,
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
  const dupColl = await db.query.collections.findMany({ where: eq(collections.slug, 'treasure-seekers') });
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
  console.log(`\nDONE: collection ${newUniverse.id} "Treasure Seekers" — ${finalRows.length} memberships, ${distinctIds.size} distinct media_items (${made} created, ${reused} reused), release_order 1..${finalRows.length}`);
  console.log(`by type: ${typeLine}`);
  console.log('verify: /universes/treasure-seekers  (univrs.vercel.app)');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
