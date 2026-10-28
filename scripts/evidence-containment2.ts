// Containment follow-up evidence - batch 2 round 2 of the manual re-bind debt.
// Resolves what evidence-containment.ts left unproven for the 78 containment rows:
//   book       -> OL ISBN lookups (isbn -> title/authors/date/works key), work
//                 editions WITH edition keys (edition-key binds for merged works),
//                 and re-searches the round-1 matcher could not prove
//   soundtrack -> MusicBrainz rg detail (artist credit) + targeted phrase searches
//                 + release listing for the Hotel Transylvania score rg
//   game       -> IGDB plain-title re-search ("Batman Returns"/"Swamp Thing" - the
//                 containment query kept the type suffix and only found LCD rows)
//   anime/manga-> AniList re-search with the type suffix stripped (TYPE_WORDS has
//                 no manga/web-series word, round-1 queries returned 0 candidates)
//   boardgame  -> BGG thing re-parse for 6953 (round-1 regex died on the name)
//   themepark  -> local full-index dump greps (/toy story/i, /shrek/i) + type histogram
//   DB         -> row cards for the dup/holder pairs + title-pattern dup discovery
// READ-ONLY: no DB writes, no provider writes.
// Output: C:/tmp/containment2-evidence-<ts>.md
// usage: bundle with esbuild, then node --env-file=.env.local <bundle>
import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const die = (msg: string): never => { console.error(`FATAL ${msg}`); process.exit(2); };
const isThrottleMsg = (m: string) => m.includes('429') || m.includes('throttle');

async function jget(url: string, init: RequestInit = {}, retries = 3, throttle: { statuses: number[]; backoff: number[] } | null = null): Promise<unknown> {
  let lastErr = '';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      const isThrottle = throttle !== null && throttle.statuses.includes(resp.status);
      if (resp.status === 429 || resp.status >= 500 || isThrottle) {
        lastErr = `HTTP ${resp.status}${isThrottle ? ' (throttle, retrying)' : ''}`;
        if (isThrottle) {
          const wait = throttle.backoff[Math.min(attempt - 1, throttle.backoff.length - 1)];
          console.log(`  THROTTLE ${resp.status} on ${url.split('?')[0]} - waiting ${Math.round(wait / 1000)}s (attempt ${attempt}/${retries})`);
          await sleep(wait);
          continue;
        }
      } else if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${url}`);
      } else {
        const text = await resp.text();
        if (!text.trim()) lastErr = 'empty body (throttle?)';
        else return JSON.parse(text) as unknown;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (lastErr.startsWith('HTTP 4') && !isThrottleMsg(lastErr)) throw err;
    }
    await sleep(900 * attempt);
  }
  throw new Error(`${url} failed after ${retries} attempts: ${lastErr}`);
}

async function tget(url: string, headers: Record<string, string> = {}, retries = 4): Promise<string> {
  let lastErr = '';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { headers });
      if (resp.status === 429 || resp.status === 403 || resp.status >= 500) {
        lastErr = `HTTP ${resp.status}`;
        await sleep(3000 * attempt);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${url}`);
      const text = await resp.text();
      if (!text.trim()) { lastErr = 'empty body'; await sleep(2000); continue; }
      return text;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (lastErr.startsWith('HTTP 4') && !isThrottleMsg(lastErr)) throw err;
    }
    await sleep(1000);
  }
  throw new Error(`${url} failed after ${retries} attempts: ${lastErr}`);
}

const lines: string[] = [];
const sec = (t: string) => { console.log(`SEC  ${t}`); lines.push('', `## ${t}`); };
const li = (s: string) => { lines.push(s); };

// ---- env / providers
const IGDB_ID = process.env.IGDB_CLIENT_ID ?? '';
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET ?? '';
const BGG_KEY = process.env.BGG_API_KEY ?? '';
const MB_UA = { 'User-Agent': 'LoreMediaTracker/1.0 (containment evidence 2)' };
const ANILIST_UA = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LoreMediaTracker/1.0 (containment evidence 2)' };
if (!IGDB_ID || !IGDB_SECRET) die('IGDB_CLIENT_ID/SECRET missing from env files');
if (!BGG_KEY) die('BGG_API_KEY missing from env files (xmlapi2 answers 401 without the bearer)');

let igdbToken = '';
async function igdbTokenGet(): Promise<string> {
  if (igdbToken) return igdbToken;
  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: IGDB_ID, client_secret: IGDB_SECRET, grant_type: 'client_credentials' }),
  });
  if (!resp.ok) die(`IGDB token HTTP ${resp.status}`);
  const data = (await resp.json()) as { access_token: string };
  igdbToken = data.access_token;
  return igdbToken;
}

// ---- OpenLibrary
type OlBook = { title?: string; authors?: Array<{ name?: string }>; publish_date?: string; number_of_pages?: number; works?: Array<{ key?: string }> };
async function olIsbnBatch(isbns: Array<{ isbn: string; forRow: number }>): Promise<void> {
  sec(`OL ISBN lookups (${isbns.length} isbns)`);
  const keys = isbns.map((i) => `ISBN:${i.isbn}`).join(',');
  const data = (await jget(`https://openlibrary.org/api/books?bibkeys=${keys}&format=json&jscmd=data`, {}, 3)) as Record<string, OlBook>;
  await sleep(800);
  for (const i of isbns) {
    const b = data[`ISBN:${i.isbn}`];
    if (!b) { li(`- row ${i.forRow} isbn=${i.isbn} -> NOT FOUND ON OL`); continue; }
    const auth = (b.authors ?? []).map((a) => a.name ?? '?').join(', ');
    const works = (b.works ?? []).map((w) => w.key ?? '?').join(',');
    li(`- row ${i.forRow} isbn=${i.isbn} -> "${b.title}" by ${auth || '(no authors)'} pub=${b.publish_date ?? '?'} pages=${b.number_of_pages ?? '?'} works=${works || '(none)'}`);
  }
}
async function olWorkEditions(work: string, forRows: string): Promise<void> {
  sec(`OL work editions (keys) - ${work} (rows ${forRows})`);
  const data = (await jget(`https://openlibrary.org${work}/editions.json?limit=30`)) as {
    entries?: Array<{ key?: string; title?: string; publish_date?: string; publishers?: string[]; isbn_13?: string[]; isbn_10?: string[] }>;
  };
  await sleep(800);
  const entries = data.entries ?? [];
  if (!entries.length) li('- NO EDITIONS SERVED');
  for (const e of entries.slice(0, 30)) {
    const isbn = e.isbn_13?.[0] ?? e.isbn_10?.[0] ?? '';
    li(`- ed key=${(e.key ?? '?').replace('/books/', '')} "${(e.title ?? '?').slice(0, 70)}" pub=${e.publish_date ?? 'no-date'} publisher=${e.publishers?.[0] ?? '?'}${isbn ? ` isbn=${isbn}` : ''}`);
  }
}
async function olSearch(q: string, label: string): Promise<void> {
  sec(`OL search - ${label} (q="${q}")`);
  const data = (await jget(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,first_publish_year,author_name,edition_count`)) as {
    docs?: Array<{ key: string; title: string; first_publish_year?: number; author_name?: string[]; edition_count?: number }>;
  };
  await sleep(800);
  const docs = data.docs ?? [];
  if (!docs.length) li('- 0 results');
  for (const d of docs) li(`- ${d.key} "${d.title}" year=${d.first_publish_year ?? '?'} editions=${d.edition_count ?? '?'} authors=${(d.author_name ?? []).join(', ') || '(none)'}`);
}

// ---- AniList
async function anilistSearch(q: string, type: 'ANIME' | 'MANGA', forRow: number): Promise<void> {
  sec(`AniList search - row ${forRow} (q="${q}", ${type})`);
  const query = `query ($search: String, $type: MediaType) { Page(page: 1, perPage: 10) { media(search: $search, type: $type) { id title { romaji english } startDate { year month day } format synonyms } } }`;
  const data = (await jget('https://graphql.anilist.co', {
    method: 'POST', headers: ANILIST_UA,
    body: JSON.stringify({ query, variables: { search: q, type } }),
  }, 4, { statuses: [429, 503], backoff: [6_000, 15_000, 30_000, 60_000] })) as {
    data?: { Page?: { media?: Array<{ id: number; title: { romaji?: string; english?: string }; startDate?: { year?: number; month?: number; day?: number }; format?: string; synonyms?: string[] }> } } };
  await sleep(1100);
  const media = data.data?.Page?.media ?? [];
  if (!media.length) li('- 0 results');
  for (const m of media) {
    const sd = m.startDate?.year ? `${m.startDate.year}-${String(m.startDate.month ?? 1).padStart(2, '0')}-${String(m.startDate.day ?? 1).padStart(2, '0')}` : '?';
    li(`- id=${m.id} "${m.title.english ?? m.title.romaji}" (romaji "${m.title.romaji}") start=${sd} format=${m.format ?? '?'}`);
    if (m.synonyms?.length) li(`  synonyms: ${m.synonyms.slice(0, 6).join(' | ')}`);
  }
}
async function anilistDetail(id: number, type: 'ANIME' | 'MANGA', label: string): Promise<void> {
  sec(`AniList detail - ${label} (${type} ${id})`);
  const query = `query ($id: Int) { Media(id: $id) { id title { romaji english } synonyms startDate { year month day } format episodes chapters status description } }`;
  const data = (await jget('https://graphql.anilist.co', {
    method: 'POST', headers: ANILIST_UA,
    body: JSON.stringify({ query, variables: { id } }),
  }, 4, { statuses: [429, 503], backoff: [6_000, 15_000, 30_000, 60_000] })) as {
    data?: { Media?: { title: { romaji?: string; english?: string }; synonyms?: string[]; startDate?: { year?: number; month?: number; day?: number }; format?: string; episodes?: number; chapters?: number; status?: string; description?: string } } };
  await sleep(1100);
  const m = data.data?.Media;
  if (!m) { li('- NO MEDIA RETURNED'); return; }
  const sd = m.startDate?.year ? `${m.startDate.year}-${String(m.startDate.month ?? 1).padStart(2, '0')}-${String(m.startDate.day ?? 1).padStart(2, '0')}` : '?';
  li(`- "${m.title.english ?? m.title.romaji}" (romaji "${m.title.romaji}") start=${sd} format=${m.format ?? '?'} status=${m.status ?? '?'} eps=${m.episodes ?? '-'} ch=${m.chapters ?? '-'}`);
  li(`- synonyms: ${m.synonyms?.length ? m.synonyms.slice(0, 8).join(' | ') : '(none)'}`);
  if (m.description) li(`- desc: ${m.description.replace(/<[^>]*>/g, '').slice(0, 300).replace(/\s+/g, ' ')}`);
}

// ---- MusicBrainz (every call >= 3.1s apart, fmt before inc, assert non-empty)
const mbGet = async (path: string): Promise<Record<string, unknown>> => {
  const sep = path.includes('?') ? '&' : '?';
  const data = (await jget(`https://musicbrainz.org/ws/2/${path}${sep}fmt=json`, { headers: MB_UA }, 4, { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] })) as Record<string, unknown>;
  await sleep(3100);
  return data;
};
type MbRg = { id: string; title: string; 'first-release-date'?: string; 'primary-type'?: string; 'secondary-types'?: string[] };
async function mbSearch(q: string, label: string, minYear?: number): Promise<void> {
  sec(`MB rg search - ${label} (q="${q}"${minYear !== undefined ? `, keep year >= ${minYear}` : ''})`);
  const run = async (query: string) => (await jget(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`,
    { headers: MB_UA }, 4, { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] },
  )) as { 'release-groups'?: MbRg[] };
  let data = await run(`"${q.replace(/"/g, '')}"`);
  let form = 'quoted';
  await sleep(3100);
  if ((data['release-groups'] ?? []).length === 0) { data = await run(q); form = 'unquoted (quoted empty)'; }
  await sleep(3100);
  let rgs = data['release-groups'] ?? [];
  if (minYear !== undefined) rgs = rgs.filter((r) => Number((r['first-release-date'] ?? '').slice(0, 4)) >= minYear);
  li(`- query form: ${form}; shown ${rgs.length}`);
  if (!rgs.length) li('- 0 results after filter');
  for (const rg of rgs.slice(0, 20)) {
    li(`- id=${rg.id} "${rg.title}" first=${rg['first-release-date'] ?? '?'} type=${rg['primary-type'] ?? '?'}/${(rg['secondary-types'] ?? []).join(',') || '-'} | https://musicbrainz.org/release-group/${rg.id}`);
  }
}
async function mbRgDetail(id: string, label: string): Promise<void> {
  sec(`MB rg detail - ${label} (${id})`);
  const data = await mbGet(`release-group/${id}?inc=artist-credits`);
  const credit = ((data['artist-credit'] as Array<{ name?: string; joinphrase?: string }> | undefined) ?? []).map((a) => `${a.name ?? ''}${a.joinphrase ?? ''}`).join('') || '(no credit)';
  li(`- "${data.title ?? '?'}" first-release=${data['first-release-date'] ?? '?'} type=${data['primary-type'] ?? '?'}/${(data['secondary-types'] as string[] | undefined)?.join(',') || '-'}`);
  li(`- artist-credit: ${credit}`);
}
async function mbRgReleases(id: string, label: string): Promise<void> {
  sec(`MB releases of rg - ${label} (${id})`);
  const data = await mbGet(`release?release-group=${id}&limit=30`);
  const rels = (data.releases as Array<{ id: string; title?: string; date?: string; status?: string; country?: string }> | undefined) ?? [];
  if (!rels.length) { li('- 0 releases (or empty body - MB throttled?)'); return; }
  for (const r of rels) li(`- "${r.title}" date=${r.date ?? '?'} status=${r.status ?? '?'} country=${r.country ?? '?'} https://musicbrainz.org/release/${r.id}`);
}

// ---- IGDB
async function igdbSearchDetail(q: string, label: string): Promise<void> {
  sec(`IGDB search+detail - ${label} (q="${q}")`);
  const token = await igdbTokenGet();
  const rows = (await jget('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: `search "${q}"; fields id,name,first_release_date; limit 8;`,
  })) as Array<{ id: number; name: string }>;
  await sleep(500);
  if (!rows.length) { li('- 0 results'); return; }
  const token2 = await igdbTokenGet();
  const det = (await jget('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${token2}`, 'Content-Type': 'text/plain' },
    body: `fields id,name,first_release_date,summary,platforms.name,alternative_names.name,release_dates.date,release_dates.human; where id = (${rows.map((r) => r.id).join(',')});`,
  })) as Array<{ id: number; name: string; first_release_date?: number; summary?: string; platforms?: Array<{ name: string }>; alternative_names?: Array<{ name: string }>; release_dates?: Array<{ date?: number; human?: string }> }>;
  await sleep(500);
  for (const g of det) {
    const rel = (g.release_dates ?? []).slice(0, 8).map((d) => d.human ?? (d.date ? new Date(d.date * 1000).toISOString().slice(0, 10) : '?')).join(', ');
    li(`- [${g.id}] "${g.name}" first=${g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : 'none'}`);
    li(`  releases: ${rel || '(none)'} | platforms: ${(g.platforms ?? []).map((p) => p.name).join(', ') || '(none)'}${g.alternative_names?.length ? ` | alt-names: ${g.alternative_names.map((a) => a.name).join(', ')}` : ''}`);
  }
}

// ---- BGG thing (line parse; round-1's regex died on the en-dash name)
async function bggThingClean(id: string, forRow: number): Promise<void> {
  sec(`BGG thing - row ${forRow} (id=${id})`);
  const xml = await tget(`https://boardgamegeek.com/xmlapi2/thing?id=${id}`, { Authorization: `Bearer ${BGG_KEY}` });
  await sleep(700);
  const it = xml.split('<item ').slice(1)[0] ?? '';
  const gid = (it.match(/^id="(\d+)"/) ?? [])[1] ?? '?';
  const name = (it.match(/<name type="primary" value="([^"]*)"/) ?? [])[1] ?? '?';
  const year = (it.match(/<yearpublished value="(\d+)"/) ?? [])[1] ?? '?';
  const type = (it.match(/^type="([^"]*)"/) ?? [])[1] ?? '?';
  li(`- [${gid}] type=${type} "${name}" year=${year}`);
}

// ---- themeparks local dump
type ParkEntity = { park: string; dest: string; id: string; name: string; type: string };
function parkDumpGrep(pattern: RegExp, label: string): void {
  sec(`themeparks dump grep - ${label} (/${pattern.source}/i)`);
  const path = 'C:/tmp/themeparks-entities.json';
  if (!existsSync(path)) { li(`- DUMP MISSING (${path}) - regenerate via /v1/destinations + /v1/entity/{park}/children`); return; }
  const dump = JSON.parse(readFileSync(path, 'utf8')) as ParkEntity[];
  const hits = dump.filter((e) => pattern.test(e.name));
  li(`- ${hits.length} hits of ${dump.length} entities`);
  for (const h of hits.slice(0, 40)) li(`- [${h.type}] "${h.name}" @ ${h.park} id=${h.id}`);
  if (hits.length > 40) li(`- ... ${hits.length - 40} more`);
}
function parkDumpTypes(): void {
  sec('themeparks dump type histogram');
  const path = 'C:/tmp/themeparks-entities.json';
  if (!existsSync(path)) { li('- DUMP MISSING'); return; }
  const dump = JSON.parse(readFileSync(path, 'utf8')) as ParkEntity[];
  const by = new Map<string, number>();
  for (const e of dump) by.set(e.type, (by.get(e.type) ?? 0) + 1);
  for (const [t, n] of [...by.entries()].sort((a, b) => b[1] - a[1])) li(`- ${t}: ${n}`);
}

// ---- DB cards
async function dbCards(ids: number[], label: string): Promise<void> {
  sec(`DB cards - ${label}`);
  const rows = await db.execute(sql`SELECT m.id, m.title, m.media_type::text AS media_type, m.release_date, m.source, m.external_id, m.created_at,
    (SELECT string_agg(c.slug, ',' ORDER BY c.slug) FROM collection_items ci JOIN collections c ON c.id = ci.collection_id WHERE ci.media_item_id = m.id) AS universes
    FROM media_items m WHERE m.id IN (${sql.raw(ids.join(','))}) ORDER BY m.id`);
  const list = (rows as unknown as { rows: Array<{ id: number; title: string; media_type: string; release_date: string | null; source: string; external_id: string; created_at: string; universes: string | null }> }).rows ?? [];
  if (list.length !== ids.length) li(`- WARN asked ${ids.length}, got ${list.length} (missing: ${ids.filter((i) => !list.some((r) => r.id === i)).join(',')})`);
  for (const r of list) li(`- [${r.id}] ${r.media_type} "${r.title}" date=${r.release_date ?? 'null'} source=${r.source} extid=${r.external_id} created=${r.created_at} universes=${r.universes ?? '(none)'}`);
}
async function dbLike(like: string, label: string): Promise<void> {
  sec(`DB title LIKE - ${label} (${like})`);
  const rows = await db.execute(sql`SELECT id, title, media_type::text AS media_type, release_date, source, external_id FROM media_items WHERE title ILIKE ${like} ORDER BY media_type, id`);
  const list = (rows as unknown as { rows: Array<{ id: number; title: string; media_type: string; release_date: string | null; source: string; external_id: string }> }).rows ?? [];
  if (!list.length) li('- 0 rows');
  for (const r of list) li(`- [${r.id}] ${r.media_type} "${r.title}" date=${r.release_date ?? 'null'} source=${r.source} extid=${r.external_id}`);
}

async function main(): Promise<void> {
  lines.push(`# Containment follow-up evidence (batch 2 round 2) - ${new Date().toISOString()}`);

  // A. OL ISBN lookups: title/authors/date for the editions the work-level cards left generic.
  await olIsbnBatch([
    { isbn: '9780345461728', forRow: 2347 },
    { isbn: '9780345461735', forRow: 2348 },
    { isbn: '9781844161768', forRow: 3277 },
    { isbn: '9781844163168', forRow: 3279 },
    { isbn: '9780765325044', forRow: 3911 },
    { isbn: '9781546131113', forRow: 3799 },
    { isbn: '9780702338755', forRow: 3799 },
    { isbn: '9781546131151', forRow: 3796 },
    { isbn: '9781339047591', forRow: 2392 },
    { isbn: '9780702333088', forRow: 2392 },
    { isbn: '9780702337451', forRow: 2392 },
    { isbn: '9781945210051', forRow: 2283 },
    { isbn: '9781945210235', forRow: 2283 },
    { isbn: '9781945210020', forRow: 2283 },
    { isbn: '9781945210099', forRow: 2283 },
    { isbn: '9780062228406', forRow: 4272 },
    { isbn: '9781338851410', forRow: 3770 },
    { isbn: '9781339005348', forRow: 3779 },
    { isbn: '9781546109631', forRow: 3779 },
    { isbn: '9780689863875', forRow: 3541 },
    { isbn: '9780743478076', forRow: 3541 },
    { isbn: '9780743483025', forRow: 3541 },
  ]);

  // B. OL work editions with keys: edition-key bind targets (work key held by another row).
  await olWorkEditions('/works/OL20252385W', '2283 (2281 holds the work key)');
  await olWorkEditions('/works/OL522737W', '3541 (3535 holds this work)');
  await olWorkEditions('/works/OL17793648W', '2375');
  await olWorkEditions('/works/OL19731661W', '3752');
  await olWorkEditions('/works/OL24326383W', '4272 (sibling rows hold other edition keys)');

  // C. OL searches: the rows with no candidate at all.
  await olSearch('Little Nightmares The Lonely Ones', '418');
  await olSearch('Resident Evil The Book', '2097');
  await olSearch("Five Nights at Freddy's The Ultimate Guide", '3777');
  await olSearch('Security Breach Files', '3779');
  await olSearch("Assassin's Creed Fragments", '2300');

  // D. AniList re-search with the type suffix stripped + the contested 3178 candidate.
  await anilistSearch('Super Dragon Ball Heroes', 'ANIME', 3696);
  await anilistSearch('Dragon Ball Super', 'MANGA', 3690);
  await anilistSearch('Dragon Ball Episode of Bardock', 'MANGA', 3688);
  await anilistSearch('Blame Master Edition', 'MANGA', 3339);
  await anilistSearch('Blame!', 'MANGA', 3339);
  await anilistSearch('NetSphere Engineer', 'MANGA', 3178);
  await anilistDetail(47368, 'MANGA', 'row 3178 prior candidate (BLAME! Academy and So On)');

  // E. MusicBrainz: artist credits for the near-certain binds + targeted phrase searches.
  await mbRgDetail('fd88aa16-2f30-48e3-a33e-283405391240', 'row 3094 Witcher Netflix OST');
  await mbRgDetail('70be0ad9-a319-4eb6-84f3-43a04bf3991a', 'row 3439 Silent Hill f');
  await mbRgDetail('65a9a7ef-82e8-4830-b130-e0df03c9b204', 'row 3558 Tomb Raider 2018 film OST');
  await mbRgDetail('84705524-7529-4301-89f7-e02a6cd746ce', 'row 3422 candidate Art of Silent Hill');
  await mbRgReleases('b6c502d4-641f-4473-88d3-6a8a2db7e905', 'row 308 Hotel Transylvania score rg');
  await mbSearch('Score from the Motion Pictures', 'row 308');
  await mbSearch('The Outlast Trials', 'row 294');
  await mbSearch('Little Nightmares III', 'row 421');
  await mbSearch('Lost Memories', 'row 3422');
  await mbSearch('Silent Hill 2', 'row 3438 (keep 2024+)', 2024);
  await mbSearch("Assassin's Creed Symphony", 'row 3648');

  // F. IGDB plain-title re-search: the containment query kept the type suffix.
  await igdbSearchDetail('Batman Returns', 'row 1655');
  await igdbSearchDetail('Swamp Thing', 'row 1662');

  // G. BGG thing 6953 (round-1 regex died on the en-dash primary name).
  await bggThingClean('6953', 3542);

  // H. themeparks local dump greps.
  parkDumpGrep(/toy story/i, 'row 186 Toy Story Land');
  parkDumpGrep(/shrek/i, 'row 3814 Shrek 4-D');
  parkDumpTypes();

  // I. DB: dup/holder row cards + title-pattern dup discovery.
  await dbCards([2281, 2283, 2298, 3617, 2380, 3753, 2392, 3800, 3653, 3654], 'dup/holder pairs (books + anime specials)');
  await dbCards([1655, 1662, 3699, 3822, 3568], 'game rows pending re-search or claim-check');
  await dbLike('%Batman Returns%', 'game dup discovery for 1655');
  await dbLike('%Swamp Thing%', 'game dup discovery for 1662');
  await dbLike('%Toy Story%Video%', 'game dup discovery for 3699');
  await dbLike('%Shrek 2%', 'game dup discovery for 3822');
  await dbLike('%Tomb Raider Pinball%', 'game dup discovery for 3568');

  lines.push('', `# done - ${new Date().toISOString()}`);
  const out = `C:/tmp/containment2-evidence-${Date.now()}.md`;
  writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`REPORT ${out}`);
}

main().catch((err) => { console.error(`FATAL ${(err as Error).stack ?? err}`); process.exit(2); });
