// Containment evidence dump — batch 2 of the ambiguous manual re-bind debt.
// The 78 AMBIGUOUS rows whose why reads "containment candidate(s) failed the
// prefix/year proof - review" each have a matcher top-candidate in `note` that
// failed the prefix/year proof; this re-runs the provider search per row and
// fetches the detail that proves or disproves identity:
//   book       -> OpenLibrary work editions (publish dates, publishers, titles)
//   soundtrack -> MusicBrainz release-group artist credits + first-release-date
//   game       -> IGDB release dates + platforms + alt names + summary
//   movie/tv   -> TMDB detail (release/air date, seasons, overview)
//   anime/manga-> AniList Media (startDate, format, episodes/chapters, synonyms)
//   boardgame  -> BGG xmlapi2 search + thing (yearpublished) — bearer header
//   themepark  -> local full-index dump (C:/tmp/themeparks-entities.json) +
//                 api.themeparks.wiki/v1/entity/{id} for openingDate
// Plus each row's own manual evidence row (source_url / metadata) and its
// universe memberships for context.
// READ-ONLY: no DB writes, no provider writes.
// Output: C:/tmp/containment-evidence-<ts>.md (cards) + .json (same data).
//   comic       -> ComicVine volume search + 4050- detail (first_issue cover
//                 dates + issue counts decide the multi-way same-name ties)
// usage: node --env-file=.env.local <bundle> <ids.json> [outPrefix]
//   ids.json = {"ids":[2121,...]}; outPrefix defaults to containment-evidence
import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const die = (msg: string): never => { console.error(`FATAL ${msg}`); process.exit(2); };

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
          console.log(`  THROTTLE ${resp.status} on ${url.split('?')[0]} — waiting ${Math.round(wait / 1000)}s (attempt ${attempt}/${retries})`);
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
const isThrottleMsg = (m: string) => m.includes('429') || m.includes('throttle');
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
    await sleep(1000 * attempt);
  }
  throw new Error(`${url} failed after ${retries} attempts: ${lastErr}`);
}

// ---- title helpers (mirrors rebind-manual-items.ts so match labels agree)
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const TYPE_SUFFIX = /\s*\(([^)]*)\)\s*$/;
const TYPE_WORDS = /^(the\s+)?(original\s+)?(motion\s+picture\s+)?(game\s+)?(official\s+)?(feature\s+)?(complete\s+)?(soundtrack(s)?|score|ost|board\s*game|graphic\s+novel(s)?|comic(s)?|comic\s+series|book(s)?|novel(ization)?|movie|film|tv\s+series|television\s+series|series|album|season\s+\d+|limited\s+series|one[-\s]?shot|annual|omnibus|tpb|hardcover|paperback|deluxe\s+edition|collector'?s\s+edition)(\s+(soundtrack(s)?|score|ost|album|book|comic(s)?|series|edition))?$/i;
const stripTypeSuffix = (t: string): string => {
  const m = t.match(TYPE_SUFFIX);
  if (m && TYPE_WORDS.test(m[1].trim())) return t.slice(0, m.index ?? t.length).trim();
  return t;
};
const GENERIC_TAIL = /^(original|official|motion|picture|game|complete|soundtrack(s)?|score|scores|ost|music|album|songs|song|from|the)$/i;
const stripGenericTail = (t: string): string => {
  let s = t.trim();
  for (;;) {
    const words = s.split(/\s+/);
    if (words.length > 1 && GENERIC_TAIL.test(words[words.length - 1])) { s = words.slice(0, -1).join(' '); continue; }
    break;
  }
  return s;
};
const canonTitle = (t: string): string => {
  let s = t;
  for (;;) {
    const next = stripGenericTail(stripTypeSuffix(s));
    if (!next || next === s) return s;
    s = next;
  }
};
const matchLabel = (rowTitle: string, candTitle: string): 'exact' | 'contain' | 'none' => {
  const a = norm(canonTitle(rowTitle)), b = norm(canonTitle(candTitle));
  if (!a || !b) return 'none';
  if (a === b) return 'exact';
  const shorter = a.length <= b.length ? a : b, longer = a.length <= b.length ? b : a;
  return shorter.length >= 5 && longer.includes(shorter) ? 'contain' : 'none';
};
const rowYearOf = (d: string | null): number | null => {
  const m = (d ?? '').match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
};

// ---- env / providers
const TMDB_KEY = process.env.TMDB_API_KEY ?? '';
const IGDB_ID = process.env.IGDB_CLIENT_ID ?? '';
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET ?? '';
const CV_KEY = process.env.COMICVINE_API_KEY ?? '';
const BGG_KEY = process.env.BGG_API_KEY ?? '';
if (!TMDB_KEY) die('TMDB_API_KEY missing from env files');
if (!IGDB_ID || !IGDB_SECRET) die('IGDB_CLIENT_ID/SECRET missing from env files');
if (!CV_KEY) die('COMICVINE_API_KEY missing from env files');

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

type Cand = {
  provider: string;
  externalId: string;
  title: string;
  year: number | null;
  url: string;
  match: 'exact' | 'contain' | 'none';
  authors?: string[];
  detailUrl?: string;
  extra?: string;
};
type Detail = { label: string; lines: string[] };

const mkCand = (rowTitle: string, c: Omit<Cand, 'match'>): Cand => ({ ...c, match: matchLabel(rowTitle, c.title) });

// OpenLibrary: search keeps author names; detail = the work's editions.
async function olSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const data = (await jget(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,first_publish_year,author_name,edition_count`)) as {
    docs?: Array<{ key: string; title: string; first_publish_year?: number; author_name?: string[]; edition_count?: number }>;
  };
  await sleep(800);
  return (data.docs ?? []).map((d) => mkCand(rowTitle, {
    provider: 'openlibrary',
    externalId: d.key.split('/').filter(Boolean).pop() ?? '',
    title: d.title,
    year: d.first_publish_year ?? null,
    url: `https://openlibrary.org${d.key}`,
    authors: d.author_name ?? [],
    extra: `editions=${d.edition_count ?? '?'}`,
  }));
}
async function olEditions(key: string): Promise<Detail> {
  const bare = key.replace(/^https?:\/\/openlibrary\.org/, '');
  const data = (await jget(`https://openlibrary.org${bare}/editions.json?limit=20`)) as {
    entries?: Array<{ title?: string; publish_date?: string; publish_year?: number[]; publishers?: string[]; isbn_13?: string[] }>;
  };
  await sleep(800);
  const lines = (data.entries ?? []).slice(0, 20).map((e) => {
    const pd = e.publish_date ?? (e.publish_year?.length ? String(e.publish_year[0]) : 'no-date');
    const pub = e.publishers?.[0] ?? '?';
    const t = (e.title ?? '?').slice(0, 70);
    const isbn = e.isbn_13?.[0] ?? '';
    return `- ed "${t}" pub=${pd} publisher=${pub}${isbn ? ` isbn=${isbn}` : ''}`;
  });
  if (!lines.length) lines.push('- NO EDITIONS SERVED');
  return { label: 'editions', lines };
}

// MusicBrainz: search release-groups; detail = artist credit + dates.
async function mbSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const phrase = canonTitle(q).replace(/"/g, '');
  const run = async (query: string) => (await jget(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`,
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (containment evidence)' } },
    4,
    { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] },
  )) as { 'release-groups'?: Array<{ id: string; title: string; 'first-release-date'?: string; 'primary-type'?: string; 'secondary-types'?: string[] }> };
  let data = await run(`"${phrase}"`);
  let form = 'quoted';
  await sleep(3100);
  if ((data['release-groups'] ?? []).length === 0) { data = await run(phrase); form = 'unquoted (quoted empty)'; }
  await sleep(3100);
  console.log(`  MB query form: ${form}`);
  return (data['release-groups'] ?? []).map((rg) => mkCand(rowTitle, {
    provider: 'musicbrainz',
    externalId: rg.id,
    title: rg.title,
    year: rg['first-release-date'] ? Number(rg['first-release-date'].slice(0, 4)) || null : null,
    url: `https://musicbrainz.org/release-group/${rg.id}`,
    extra: [rg['primary-type'], ...(rg['secondary-types'] ?? [])].filter(Boolean).join('/') || undefined,
  }));
}
async function mbRgDetail(id: string): Promise<Detail> {
  const data = (await jget(`https://musicbrainz.org/ws/2/release-group/${id}?fmt=json&inc=artist-credits`,
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (containment evidence)' } },
    4, { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] })) as {
      title?: string; 'first-release-date'?: string; 'primary-type'?: string; 'secondary-types'?: string[];
      'artist-credit'?: Array<{ name?: string; joinphrase?: string }>; aliases?: Array<{ name?: string; type?: string }>;
    };
  await sleep(3100);
  const credit = (data['artist-credit'] ?? []).map((a) => `${a.name ?? ''}${a.joinphrase ?? ''}`).join('') || '(no credit)';
  const aliases = (data.aliases ?? []).slice(0, 6).map((a) => `${a.name}${a.type ? ` [${a.type}]` : ''}`);
  return {
    label: 'rg-detail',
    lines: [
      `- "${data.title}" first-release=${data['first-release-date'] ?? '?'} type=${data['primary-type'] ?? '?'}/${(data['secondary-types'] ?? []).join(',') || '-'}`,
      `- artist-credit: ${credit}`,
      aliases.length ? `- aliases: ${aliases.join(' | ')}` : '- aliases: (none)',
    ],
  };
}

// IGDB: search then one batched detail (release dates, platforms, alt names).
async function igdbSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const token = await igdbTokenGet();
  const esc = q.replace(/"/g, '\\"');
  const rows = (await jget('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: `search "${esc}"; fields id,name,first_release_date,url; limit 10;`,
  })) as Array<{ id: number; name: string; first_release_date?: number; url?: string }>;
  await sleep(400);
  return rows.map((r) => mkCand(rowTitle, {
    provider: 'igdb',
    externalId: String(r.id),
    title: r.name,
    year: r.first_release_date ? new Date(r.first_release_date * 1000).getUTCFullYear() : null,
    url: r.url ?? `https://www.igdb.com/games/${r.id}`,
  }));
}
async function igdbDetail(ids: number[]): Promise<Detail> {
  if (!ids.length) return { label: 'game-detail', lines: ['- (no candidate ids)'] };
  const token = await igdbTokenGet();
  const rows = (await jget('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: `fields id,name,first_release_date,summary,platforms.name,alternative_names.name,release_dates.date,release_dates.human; where id = (${ids.join(',')});`,
  })) as Array<{ id: number; name: string; first_release_date?: number; summary?: string; platforms?: Array<{ name: string }>; alternative_names?: Array<{ name: string }>; release_dates?: Array<{ date?: number; human?: string }> }>;
  await sleep(400);
  const lines: string[] = [];
  for (const g of rows) {
    const rel = (g.release_dates ?? []).slice(0, 8).map((d) => d.human ?? (d.date ? new Date(d.date * 1000).toISOString().slice(0, 10) : '?')).join(', ');
    const plats = (g.platforms ?? []).map((p) => p.name).join(', ');
    const alts = (g.alternative_names ?? []).map((a) => a.name).join(', ');
    lines.push(`- [${g.id}] "${g.name}" first=${g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : 'none'}`);
    lines.push(`  releases: ${rel || '(none)'}`);
    lines.push(`  platforms: ${plats || '(none)'}${alts ? ` | alt-names: ${alts}` : ''}`);
    if (g.summary) lines.push(`  summary: ${g.summary.slice(0, 240).replace(/\s+/g, ' ')}`);
  }
  return { label: 'game-detail', lines };
}

// IGDB exact-name assist: rank noise (DLC/skins/bundles) can bury the main game
// in the search top-10, so also ask for equality directly.
async function igdbExactName(q: string, rowTitle: string): Promise<Cand[]> {
  const token = await igdbTokenGet();
  const esc = q.replace(/"/g, '\\"');
  const rows = (await jget('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: `fields id,name,first_release_date,url; where name = "${esc}"; limit 10;`,
  })) as Array<{ id: number; name: string; first_release_date?: number; url?: string }>;
  await sleep(400);
  return rows.map((r) => mkCand(rowTitle, {
    provider: 'igdb',
    externalId: String(r.id),
    title: r.name,
    year: r.first_release_date ? new Date(r.first_release_date * 1000).getUTCFullYear() : null,
    url: r.url ?? `https://www.igdb.com/games/${r.id}`,
    extra: 'exact-name-query',
  }));
}

// ComicVine: volume search + 4050- volume detail. Detail's first_issue cover
// date is the multi-way discriminator (row date = first issue on-sale day,
// cover ~1-2 months later per batch 1b).
const CV_THROTTLE = { statuses: [403, 420], backoff: [60_000, 120_000, 300_000, 600_000, 900_000, 900_000, 900_000, 900_000, 900_000] };
async function cvSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const data = (await jget(
    `https://comicvine.gamespot.com/api/search/?api_key=${CV_KEY}&format=json&resources=volume&query=${encodeURIComponent(q)}&limit=50`,
    {}, 9, CV_THROTTLE,
  )) as { results?: Array<{ id: number; name: string; start_year?: string; count_of_issues?: number; site_detail_url?: string }> };
  await sleep(2500);
  return (data.results ?? []).map((r) => mkCand(rowTitle, {
    provider: 'comicvine',
    externalId: `volume-${r.id}`,
    title: r.name,
    year: r.start_year ? Number(r.start_year) || null : null,
    url: r.site_detail_url ?? `https://comicvine.gamespot.com/volume/4000-${r.id}`,
    extra: `issues=${r.count_of_issues ?? '?'}`,
  }));
}
async function cvVolumeDetail(ids: number[]): Promise<Detail> {
  if (!ids.length) return { label: 'volume-detail', lines: ['- (no candidate ids)'] };
  const lines: string[] = [];
  for (const id of ids) {
    const data = (await jget(
      `https://comicvine.gamespot.com/api/volume/4050-${id}/?api_key=${CV_KEY}&format=json&field_list=name,start_year,count_of_issues,first_issue,publisher,deck`,
      {}, 9, CV_THROTTLE,
    )) as { results?: { name?: string; start_year?: string; count_of_issues?: number; first_issue?: { id?: number; issue_number?: string; cover_date?: string }; publisher?: { name?: string }; deck?: string } };
    await sleep(2500);
    const v = data.results;
    if (!v) { lines.push(`- [${id}] NO RESULTS SERVED`); continue; }
    const fi = v.first_issue;
    lines.push(`- [${id}] "${v.name}" start=${v.start_year ?? '?'} issues=${v.count_of_issues ?? '?'} publisher=${v.publisher?.name ?? '?'}`);
    lines.push(`  first_issue: #${fi?.issue_number ?? '?'} cover=${fi?.cover_date ?? '(none)'}`);
    if (v.deck) lines.push(`  deck: ${v.deck.slice(0, 220).replace(/\s+/g, ' ')}`);
  }
  if (!lines.length) lines.push('- NO VOLUMES SERVED');
  return { label: 'volume-detail', lines };
}

// TMDB movie: search then detail.
async function tmdbMovieSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const data = (await jget(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false`)) as {
    results?: Array<{ id: number; title?: string; release_date?: string; original_title?: string }>;
  };
  await sleep(300);
  return (data.results ?? []).slice(0, 10).map((r) => mkCand(rowTitle, {
    provider: 'tmdb',
    externalId: String(r.id),
    title: r.title ?? '',
    year: r.release_date ? Number(r.release_date.slice(0, 4)) || null : null,
    url: `https://www.themoviedb.org/movie/${r.id}`,
  }));
}
async function tmdbMovieDetail(id: number): Promise<Detail> {
  const data = (await jget(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}`)) as {
    title?: string; original_title?: string; release_date?: string; runtime?: number; overview?: string; original_language?: string;
  };
  await sleep(300);
  return {
    label: 'movie-detail',
    lines: [
      `- "${data.title}" (orig "${data.original_title}") release=${data.release_date ?? '?'} runtime=${data.runtime ?? '?'} lang=${data.original_language ?? '?'}`,
      data.overview ? `- overview: ${data.overview.slice(0, 240).replace(/\s+/g, ' ')}` : '- overview: (none)',
    ],
  };
}

// TMDB tv: search then detail.
async function tmdbTvSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const data = (await jget(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false`)) as {
    results?: Array<{ id: number; name?: string; first_air_date?: string; overview?: string }>;
  };
  await sleep(300);
  return (data.results ?? []).slice(0, 10).map((r) => mkCand(rowTitle, {
    provider: 'tmdb',
    externalId: String(r.id),
    title: r.name ?? '',
    year: r.first_air_date ? Number(r.first_air_date.slice(0, 4)) || null : null,
    url: `https://www.themoviedb.org/tv/${r.id}`,
  }));
}
async function tmdbTvDetail(id: number): Promise<Detail> {
  const data = (await jget(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}`)) as {
    name?: string; first_air_date?: string; number_of_seasons?: number; overview?: string; networks?: Array<{ name?: string }>; type?: string;
  };
  await sleep(300);
  return {
    label: 'tv-detail',
    lines: [
      `- "${data.name}" first_air=${data.first_air_date ?? '?'} seasons=${data.number_of_seasons ?? '?'} type=${data.type ?? '?'} network=${data.networks?.[0]?.name ?? '?'}`,
      data.overview ? `- overview: ${data.overview.slice(0, 240).replace(/\s+/g, ' ')}` : '- overview: (none)',
    ],
  };
}

// AniList: one graphql search (candidates) + one fetch by id (detail).
const ANILIST_UA = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LoreMediaTracker/1.0 (containment evidence)' };
async function anilistSearch(q: string, type: 'ANIME' | 'MANGA', rowTitle: string): Promise<Cand[]> {
  const query = `query ($search: String, $type: MediaType) { Page(page: 1, perPage: 10) { media(search: $search, type: $type) { id title { romaji english } startDate { year } format } } }`;
  const data = (await jget('https://graphql.anilist.co', {
    method: 'POST', headers: ANILIST_UA,
    body: JSON.stringify({ query, variables: { search: q, type } }),
  }, 4, { statuses: [429, 503], backoff: [6_000, 15_000, 30_000, 60_000] })) as {
    data?: { Page?: { media?: Array<{ id: number; title: { romaji?: string; english?: string }; startDate?: { year?: number }; format?: string }> } };
  };
  await sleep(1100);
  return (data.data?.Page?.media ?? []).map((m) => mkCand(rowTitle, {
    provider: 'anilist',
    externalId: String(m.id),
    title: m.title.english ?? m.title.romaji ?? '',
    year: m.startDate?.year ?? null,
    url: `https://anilist.co/${type === 'ANIME' ? 'anime' : 'manga'}/${m.id}`,
    extra: m.format ?? undefined,
  }));
}
async function anilistDetail(id: number, type: 'ANIME' | 'MANGA'): Promise<Detail> {
  const query = `query ($id: Int) { Media(id: $id) { id title { romaji english } synonyms startDate { year month day } format episodes chapters status description } }`;
  const data = (await jget('https://graphql.anilist.co', {
    method: 'POST', headers: ANILIST_UA,
    body: JSON.stringify({ query, variables: { id } }),
  }, 4, { statuses: [429, 503], backoff: [6_000, 15_000, 30_000, 60_000] })) as {
    data?: { Media?: { title: { romaji?: string; english?: string }; synonyms?: string[]; startDate?: { year?: number; month?: number; day?: number }; format?: string; episodes?: number; chapters?: number; status?: string; description?: string } };
  };
  await sleep(1100);
  const m = data.data?.Media;
  if (!m) return { label: 'anilist-detail', lines: ['- NO MEDIA RETURNED'] };
  const sd = m.startDate?.year ? `${m.startDate.year}-${String(m.startDate.month ?? 1).padStart(2, '0')}-${String(m.startDate.day ?? 1).padStart(2, '0')}` : '?';
  return {
    label: 'anilist-detail',
    lines: [
      `- "${m.title.english ?? m.title.romaji}" (romaji "${m.title.romaji}") start=${sd} format=${m.format ?? '?'} status=${m.status ?? '?'} eps=${m.episodes ?? '-'} ch=${m.chapters ?? '-'}`,
      m.synonyms?.length ? `- synonyms: ${m.synonyms.slice(0, 6).join(' | ')}` : '- synonyms: (none)',
      m.description ? `- desc: ${m.description.replace(/<[^>]*>/g, '').slice(0, 220).replace(/\s+/g, ' ')}` : '- desc: (none)',
    ],
  };
}

// BGG: xmlapi2 search (bearer) + thing detail.
async function bggSearch(q: string, rowTitle: string): Promise<Cand[]> {
  if (!BGG_KEY) die('BGG_API_KEY missing — boardgame rows need it (xmlapi2 answers 401 without the bearer)');
  const xml = await tget(`https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`, { Authorization: `Bearer ${BGG_KEY}` });
  await sleep(700);
  const out: Cand[] = [];
  const re = /<item type="boardgame" id="(\d+)">[\s\S]*?<name type="primary" value="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(mkCand(rowTitle, {
      provider: 'bgg',
      externalId: m[1],
      title: m[2],
      year: null,
      url: `https://boardgamegeek.com/boardgame/${m[1]}`,
    }));
  }
  return out;
}
async function bggThing(ids: string[]): Promise<Detail> {
  if (!ids.length) return { label: 'bgg-thing', lines: ['- (no candidate ids)'] };
  const xml = await tget(`https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}`, { Authorization: `Bearer ${BGG_KEY}` });
  await sleep(700);
  const lines: string[] = [];
  const re = /<item id="(\d+)"[\s\S]*?<name type="primary" value="([^"]*)"[\s\S]*?(?:<yearpublished value="(\d+)"\/>)?[\s\S]*?<\/item>/g;
  let m: RegExpExecArray | null;
  let hit = false;
  while ((m = re.exec(xml)) !== null) { hit = true; lines.push(`- [${m[1]}] "${m[2]}" year=${m[3] ?? '?'}`); }
  if (!hit) {
    // fallback: line-oriented parse (thing XML nests <link> before </item>)
    const items = xml.split('<item ').slice(1);
    for (const it of items) {
      const id = (it.match(/^id="(\d+)"/) ?? [])[1] ?? '?';
      const name = (it.match(/<name type="primary" value="([^"]*)"/) ?? [])[1] ?? '?';
      const year = (it.match(/<yearpublished value="(\d+)"/) ?? [])[1] ?? '?';
      lines.push(`- [${id}] "${name}" year=${year}`);
    }
  }
  if (!lines.length) lines.push('- NO ITEMS SERVED');
  return { label: 'bgg-thing', lines };
}

// themeparks.wiki: local full-index dump (no search endpoint) + entity detail.
type ParkEntity = { park: string; dest: string; id: string; name: string; type: string };
let parkDump: ParkEntity[] | null = null;
function loadParkDump(): ParkEntity[] {
  if (parkDump) return parkDump;
  const path = 'C:/tmp/themeparks-entities.json';
  if (!existsSync(path)) die(`${path} missing — regenerate: /v1/destinations + /v1/entity/{park}/children (AGENTS.md themeparks gotcha)`);
  parkDump = JSON.parse(readFileSync(path, 'utf8')) as ParkEntity[];
  return parkDump;
}
async function themeparkSearch(rowTitle: string): Promise<Cand[]> {
  const dump = loadParkDump();
  const target = norm(canonTitle(rowTitle));
  const hits = dump
    .filter((e) => { const n = norm(e.name); return target.length >= 5 && n.includes(target); })
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, 8);
  return hits.map((e) => mkCand(rowTitle, {
    provider: 'themeparks',
    externalId: e.id,
    title: `${e.name} @ ${e.park}`,
    year: null,
    url: `https://www.themeparks.wiki/entity/${e.id}`,
    extra: e.type,
  }));
}
async function themeparkDetail(id: string): Promise<Detail> {
  const data = (await jget(`https://api.themeparks.wiki/v1/entity/${id}`)) as Record<string, unknown>;
  await sleep(300);
  const pick = (k: string): string => (data[k] === undefined || data[k] === null ? '' : `${k}=${String(data[k])}`);
  const keys = ['name', 'type', 'openingDate', 'closedDate', 'parkUrl', 'destinationUrl'].map(pick).filter(Boolean);
  return { label: 'entity-detail', lines: [keys.length ? `- ${keys.join(' ')}` : `- (no known keys: ${Object.keys(data).slice(0, 12).join(',')})`] };
}

// pick detail targets: exact-title first, then closest-year among |gap| <= 6, cap 4
function pickDetail(cands: Cand[], rowYear: number | null, fallbackN = 4): Cand[] {
  const exact = cands.filter((c) => c.match === 'exact');
  const near = rowYear === null ? [] : cands.filter((c) => c.match !== 'none' && c.year !== null && Math.abs(c.year - rowYear) <= 6);
  const out: Cand[] = [];
  for (const c of [...exact.slice(0, 3), ...near.slice(0, 4)]) if (!out.some((o) => o.externalId === c.externalId)) out.push(c);
  if (!out.length) out.push(...cands.slice(0, fallbackN));
  return out.slice(0, 4);
}

// comic multi-way pick: sort name-matching candidates by |year - rowYear| so
// the details open with the right-year volume (a top-ranked wrong decade —
// Superman 1939 vs the row's 1986 — must never consume the detail slots).
function pickComicDetail(cands: Cand[], rowYear: number | null): Cand[] {
  const rel = cands.filter((c) => c.match !== 'none');
  const gap = (c: Cand): number => (rowYear !== null && c.year !== null ? Math.abs(c.year - rowYear) : 99);
  rel.sort((a, b) => gap(a) - gap(b) || a.externalId.localeCompare(b.externalId));
  return rel.slice(0, 4);
}

type Row = { id: number; title: string; media_type: string; release_date: string | null; source: string; external_id: string };
type Card = { row: Row; rowYear: number | null; evidence: string | null; memberships: string[]; candidates: Cand[]; details: Array<{ forId: string; detail: Detail }>; error?: string };

async function main(): Promise<void> {
  const FILE_ARG = process.argv.slice(2).find((a) => a.endsWith('.json'));
  if (!FILE_ARG || !existsSync(FILE_ARG)) { console.error(`FATAL usage: evidence-containment <ids.json>  (got: ${FILE_ARG ?? 'none'})`); process.exit(2); }
  const FILE: string = FILE_ARG;
  const PREFIX = process.argv.slice(2).find((a) => !a.endsWith('.json')) ?? 'containment-evidence';
  const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as { ids?: number[] };
  const ids = parsed.ids ?? [];
  if (!ids.length || !ids.every(Number.isInteger)) die(`${FILE} must carry a non-empty integer "ids" array`);

  const idList = ids.join(',');
  const rowsRes = await db.execute(sql`SELECT id, title, media_type::text AS media_type, release_date, source, external_id FROM media_items WHERE id IN (${sql.raw(idList)}) ORDER BY media_type, id`);
  const rows = (rowsRes as unknown as { rows: Row[] }).rows ?? [];
  if (rows.length !== ids.length) die(`asked ${ids.length} ids, DB returned ${rows.length} — missing rows are loud`);
  for (const r of rows) {
    if (!(r.source === 'manual' || r.external_id.startsWith('curated-'))) die(`row ${r.id} not in manual scope (source=${r.source})`);
  }
  console.log(`EVIDENCE rows=${rows.length}`);

  const evRes = await db.execute(sql`SELECT media_item_id, source_url, metadata FROM media_external_ids WHERE provider = 'manual' AND media_item_id IN (${sql.raw(idList)})`);
  const evBy = new Map<number, string>();
  for (const e of (evRes as unknown as { rows: Array<{ media_item_id: number; source_url: string | null; metadata: unknown }> }).rows) {
    const md = e.metadata && typeof e.metadata === 'object' ? e.metadata as Record<string, unknown> : {};
    const bits = [e.source_url ? `url=${e.source_url}` : '', md.why_unbound ? `why_unbound=${String(md.why_unbound).slice(0, 300)}` : ''].filter(Boolean);
    evBy.set(e.media_item_id, bits.join(' ') || '(no url / why_unbound)');
  }
  const membRes = await db.execute(sql`SELECT ci.media_item_id, c.slug FROM collection_items ci JOIN collections c ON c.id = ci.collection_id WHERE ci.media_item_id IN (${sql.raw(idList)}) ORDER BY c.slug`);
  const membBy = new Map<number, string[]>();
  for (const m of (membRes as unknown as { rows: Array<{ media_item_id: number; slug: string }> }).rows) {
    membBy.set(m.media_item_id, [...(membBy.get(m.media_item_id) ?? []), m.slug]);
  }

  const cards: Card[] = [];
  const errors: string[] = [];
  let done = 0;
  for (const row of rows) {
    const rowYear = rowYearOf(row.release_date);
    const card: Card = { row, rowYear, evidence: evBy.get(row.id) ?? null, memberships: membBy.get(row.id) ?? [], candidates: [], details: [] };
    const q = canonTitle(row.title) || row.title;
    try {
      switch (row.media_type) {
        case 'book': {
          card.candidates = await olSearch(q, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await olEditions(c.url) });
          break;
        }
        case 'soundtrack': {
          card.candidates = await mbSearch(row.title, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await mbRgDetail(c.externalId) });
          break;
        }
        case 'game': {
          card.candidates = await igdbSearch(row.title, row.title);
          const ex = await igdbExactName(row.title, row.title);
          for (const c of ex) if (!card.candidates.some((o) => o.externalId === c.externalId)) card.candidates.unshift(c);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await igdbDetail([Number(c.externalId)]) });
          break;
        }
        case 'comic': {
          card.candidates = await cvSearch(row.title, row.title);
          const picks = pickComicDetail(card.candidates, rowYear);
          for (const c of picks) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await cvVolumeDetail([Number(c.externalId.replace(/^volume-/, ''))]) });
          break;
        }
        case 'movie': {
          card.candidates = await tmdbMovieSearch(q, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await tmdbMovieDetail(Number(c.externalId)) });
          break;
        }
        case 'tv': {
          card.candidates = await tmdbTvSearch(q, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await tmdbTvDetail(Number(c.externalId)) });
          break;
        }
        case 'anime':
        case 'manga': {
          const type = row.media_type === 'anime' ? 'ANIME' : 'MANGA';
          card.candidates = await anilistSearch(q, type, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await anilistDetail(Number(c.externalId), type) });
          break;
        }
        case 'boardgame': {
          card.candidates = await bggSearch(q, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await bggThing([c.externalId]) });
          break;
        }
        case 'themepark': {
          card.candidates = await themeparkSearch(row.title);
          for (const c of pickDetail(card.candidates, rowYear, 5)) card.details.push({ forId: `${c.externalId} "${c.title}"`, detail: await themeparkDetail(c.externalId) });
          break;
        }
        default:
          die(`row ${row.id}: media_type=${row.media_type} has no evidence path — add one, no silent skip`);
      }
    } catch (err) {
      card.error = err instanceof Error ? err.message : String(err);
      errors.push(`row ${row.id} "${row.title}": ${card.error}`);
      console.error(`ROW-ERROR ${row.id} "${row.title}" — ${card.error}`);
    }
    cards.push(card);
    done++;
    console.log(`[${done}/${rows.length}] ${row.media_type} ${row.id} "${row.title}" (${rowYear ?? '????'}) search=${card.candidates.length} detail=${card.details.length}${card.error ? ' ERROR' : ''}`);
  }

  let md = `# Manual re-bind evidence — ${new Date().toISOString()}\n\nRows: ${rows.length}; errors: ${errors.length}\n`;
  for (const c of cards) {
    md += `\n## [${c.row.id}] ${c.row.media_type} "${c.row.title}" — row date ${c.row.release_date ?? 'null'} (year ${c.rowYear ?? '?'})\n`;
    md += `- extid: \`${c.row.external_id}\` | universes: ${c.memberships.join(', ') || '(none)'}\n`;
    md += `- manual evidence: ${c.evidence ?? '(no manual extid row)'}\n`;
    if (c.error) md += `- **ERROR**: ${c.error}\n`;
    md += `\n### search candidates (${c.candidates.length})\n`;
    for (const [i, cand] of c.candidates.entries()) {
      const gap = c.rowYear !== null && cand.year !== null ? Math.abs(c.rowYear - cand.year) : null;
      md += `${i + 1}. [${cand.match}] "${cand.title}" year=${cand.year ?? '?'}${gap !== null ? ` gap=${gap}` : ''} id=\`${cand.externalId}\`${cand.extra ? ` | ${cand.extra}` : ''}${cand.authors?.length ? ` | authors: ${cand.authors.slice(0, 4).join(', ')}` : ''}\n`;
    }
    md += `\n### detail\n`;
    for (const d of c.details) md += `**${d.forId}** (${d.detail.label}):\n${d.detail.lines.join('\n')}\n`;
  }
  if (errors.length) md += `\n## ERRORS\n${errors.map((e) => `- ${e}`).join('\n')}\n`;

  const stamp = Date.now();
  const mdPath = `C:/tmp/${PREFIX}-${stamp}.md`;
  const jsonPath = `C:/tmp/${PREFIX}-${stamp}.json`;
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify({ at: new Date().toISOString(), ids, cards }, null, 2));
  console.log(`EVIDENCE ${mdPath}`);
  console.log(`EVIDENCE ${jsonPath}`);
  if (errors.length) { console.error(`EVIDENCE FAILED — ${errors.length} row error(s):\n${errors.join('\n')}`); process.exit(2); }
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
