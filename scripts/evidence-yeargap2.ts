// Second-pass detail fetches for batch 1b year-gap adjudication (READ-ONLY).
// evidence-yeargap.ts dumped search candidates + one detail per row; several
// rows still needed a sharper detail before a decision could be written:
//   book       -> exact OL edition publish dates for the surviving work ids,
//                 plus fresh OL searches for the two absence-provable rows
//   comic      -> ComicVine ISSUE store/cover dates (which volume's run actually
//                 covers the row's on-sale date) + the 2025 Witcher volumes
//   soundtrack -> MusicBrainz release-group searches with artist/first-release
//   game       -> IGDB release_dates table (row date vs platform dates)
//   tv         -> TMDB season air dates + a fresh show search
// No DB access, no writes. Output: C:/tmp/yeargap-evidence2-<ts>.md
// usage: node --env-file=.env.local <bundle>
import { writeFileSync } from 'node:fs';

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

const TMDB_KEY = process.env.TMDB_API_KEY ?? '';
const IGDB_ID = process.env.IGDB_CLIENT_ID ?? '';
const IGDB_SECRET = process.env.IGDB_CLIENT_SECRET ?? '';
const CV_KEY = process.env.COMICVINE_API_KEY ?? '';
if (!TMDB_KEY) die('TMDB_API_KEY missing from env files');
if (!IGDB_ID || !IGDB_SECRET) die('IGDB_CLIENT_ID/SECRET missing from env files');
if (!CV_KEY) die('COMICVINE_API_KEY missing from env files');

const CV_THROTTLE = { statuses: [403, 420], backoff: [60_000, 120_000, 300_000, 600_000, 900_000, 900_000, 900_000] };
const out: string[] = [];
const sec = (t: string) => { out.push('', `## ${t}`); console.log(`-- ${t}`); };
const line = (s: string) => { out.push(s); };

// ---- OpenLibrary: raw edition entries for one work (authors + exact dates)
async function olEditions(workId: string): Promise<void> {
  const data = (await jget(`https://openlibrary.org/works/${workId}/editions.json?limit=20`)) as {
    entries?: Array<{ title?: string; subtitle?: string; publish_date?: string; publish_year?: number[]; publishers?: string[]; contributions?: string[]; isbn_13?: string[]; isbn_10?: string[]; number_of_pages?: number }>;
  };
  await sleep(800);
  const entries = data.entries ?? [];
  if (!entries.length) { line(`- **${workId}**: NO EDITIONS SERVED`); return; }
  line(`- **${workId}** editions=${entries.length}`);
  for (const e of entries.slice(0, 8)) {
    const pub = e.publish_date ?? (e.publish_year?.length ? String(e.publish_year[0]) : 'no-date');
    const publ = (e.publishers ?? []).join('/') || '?';
    const auth = (e.contributions ?? []).join('; ') || '-';
    const isbn = (e.isbn_13 ?? e.isbn_10 ?? []).slice(0, 2).join(',') || '-';
    const sub = e.subtitle ? ` : ${e.subtitle}` : '';
    line(`  - ed "${(e.title ?? '?').slice(0, 60)}${sub.slice(0, 50)}" pub=${pub} publisher=${publ} authors=${auth} isbn=${isbn} pages=${e.number_of_pages ?? '?'}`);
  }
}

async function olSearch(q: string): Promise<void> {
  const data = (await jget(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=key,title,first_publish_year,author_name,edition_count`)) as {
    docs?: Array<{ key: string; title: string; first_publish_year?: number; author_name?: string[]; edition_count?: number }>;
  };
  await sleep(800);
  line(`- query: "${q}"`);
  for (const [i, d] of (data.docs ?? []).entries()) {
    const key = d.key.split('/').filter(Boolean).pop() ?? '';
    line(`  ${i + 1}. ${key} "${d.title}" year=${d.first_publish_year ?? '?'} editions=${d.edition_count ?? '?'} authors=${(d.author_name ?? []).slice(0, 3).join('; ') || '-'}`);
  }
}

// ---- ComicVine: volume detail
async function cvVolumeDetail(volId: number): Promise<void> {
  const data = (await jget(`https://comicvine.gamespot.com/api/volume/4000-${volId}/?api_key=${CV_KEY}&format=json`, {}, 9, CV_THROTTLE)) as {
    results?: { name?: string; start_year?: string; end_year?: string; count_of_issues?: number; publisher?: { name?: string }; deck?: string; first_issue?: { issue_number?: string; name?: string }; image?: { original_url?: string } };
  };
  await sleep(2500);
  const v = data.results;
  if (!v) { line(`- **volume-${volId}**: NO RESULTS`); return; }
  line(`- **volume-${volId}** "${v.name}" run=${v.start_year ?? '?'}–${v.end_year ?? '?'} issues=${v.count_of_issues ?? '?'} publisher=${v.publisher?.name ?? '?'}`);
  line(`  first_issue=#${v.first_issue?.issue_number ?? '?'} ${v.first_issue?.name ? `"${v.first_issue.name}"` : ''} | deck: ${v.deck ? v.deck.slice(0, 200) : '(none)'}`);
}

// ---- ComicVine: issue store/cover dates for one volume (target = row date)
async function cvIssues(volId: number, targets: string[]): Promise<void> {
  const base = `https://comicvine.gamespot.com/api/issues/?api_key=${CV_KEY}&format=json&filter=volume:${volId}&field_list=id,issue_number,name,store_date,cover_date&limit=50`;
  type Issue = { id: number; issue_number?: string; name?: string; store_date?: string | null; cover_date?: string | null };
  const fetchPage = async (sort: string): Promise<{ rows: Issue[]; total: number }> => {
    const data = (await jget(`${base}&sort=${sort}`, {}, 9, CV_THROTTLE)) as { results?: Issue[]; number_of_total_results?: number };
    await sleep(2500);
    return { rows: data.results ?? [], total: data.number_of_total_results ?? 0 };
  };
  const asc = await fetchPage('store_date:asc');
  let rows = asc.rows;
  if (asc.total > rows.length) {
    const desc = await fetchPage('store_date:desc');
    const seen = new Set(rows.map((r) => r.id));
    rows = [...rows, ...desc.rows.filter((r) => !seen.has(r.id))];
  }
  const dated = rows.filter((r) => r.store_date || r.cover_date);
  const key = (r: Issue) => r.store_date ?? r.cover_date ?? '';
  dated.sort((a, b) => key(a).localeCompare(key(b)));
  line(`- **volume-${volId}**: total=${asc.total} fetched=${rows.length} dated=${dated.length}`);
  if (dated.length) {
    line(`  earliest=${key(dated[0])} latest=${key(dated[dated.length - 1])}`);
  }
  for (const t of targets) {
    const inWin = dated.filter((r) => Math.abs(Date.parse(key(r)) - Date.parse(t)) <= 60 * 86400_000);
    const note = inWin.length
      ? inWin.map((r) => `#${r.issue_number} ${key(r)}${r.store_date ? '' : ' (cover only)'}`).join(', ')
      : 'NONE within 60 days';
    line(`  target ${t}: ${note}`);
  }
}

// ---- MusicBrainz: release-group search + detail
async function mbSearch(q: string): Promise<void> {
  const phrase = q.replace(/"/g, '');
  const run = async (query: string) => (await jget(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`,
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (yeargap evidence 2)' } },
    4, { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] },
  )) as { 'release-groups'?: Array<{ id: string; title: string; 'first-release-date'?: string; 'primary-type'?: string; 'secondary-types'?: string[] }> };
  let data = await run(`"${phrase}"`);
  let form = 'quoted';
  await sleep(3100);
  if ((data['release-groups'] ?? []).length === 0) { data = await run(phrase); form = 'unquoted (quoted empty)'; }
  await sleep(3100);
  line(`- query: "${q}" (${form}) hits=${(data['release-groups'] ?? []).length}`);
  for (const rg of data['release-groups'] ?? []) {
    const yr = rg['first-release-date'] ?? '?';
    line(`  - ${rg.id} "${rg.title}" first=${yr} type=${rg['primary-type'] ?? '?'}/${(rg['secondary-types'] ?? []).join(',') || '-'}`);
  }
}

async function mbRgDetail(id: string): Promise<void> {
  const data = (await jget(`https://musicbrainz.org/ws/2/release-group/${id}?fmt=json&inc=artist-credits`,
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (yeargap evidence 2)' } },
    4, { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] })) as {
      title?: string; 'first-release-date'?: string; 'primary-type'?: string; 'secondary-types'?: string[];
      'artist-credit'?: Array<{ name?: string; joinphrase?: string }>;
    };
  await sleep(3100);
  const credit = (data['artist-credit'] ?? []).map((a) => `${a.name ?? ''}${a.joinphrase ?? ''}`).join('') || '(no credit)';
  line(`  - **${id}** "${data.title}" first=${data['first-release-date'] ?? '?'} type=${data['primary-type'] ?? '?'}/${(data['secondary-types'] ?? []).join(',') || '-'} artist=${credit}`);
}

// ---- IGDB: batched detail incl. release_dates
async function igdbDetail(ids: number[]): Promise<void> {
  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: IGDB_ID, client_secret: IGDB_SECRET, grant_type: 'client_credentials' }),
  });
  if (!resp.ok) die(`IGDB token HTTP ${resp.status}`);
  const token = ((await resp.json()) as { access_token: string }).access_token;
  const rows = (await jget('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: `fields id,name,first_release_date,platforms.name,alternative_names.name,release_dates.date,release_dates.human,release_dates.platform.name; where id = (${ids.join(',')});`,
  })) as Array<{ id: number; name: string; first_release_date?: number; platforms?: Array<{ name: string }>; alternative_names?: Array<{ name: string }>; release_dates?: Array<{ date?: number; human?: string; platform?: { name?: string } }> }>;
  await sleep(400);
  for (const g of rows) {
    line(`- [${g.id}] "${g.name}" first=${g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : 'none'}`);
    for (const d of (g.release_dates ?? [])) {
      line(`    release: ${d.human ?? (d.date ? new Date(d.date * 1000).toISOString().slice(0, 10) : '?')} platform=${d.platform?.name ?? '?'}`);
    }
    const alts = (g.alternative_names ?? []).map((a) => a.name).join(', ');
    if (alts) line(`    alt-names: ${alts}`);
    if (!(g.release_dates ?? []).length) line('    releases: (none)');
  }
}

// ---- TMDB: seasons + search
async function tmdbSeasons(id: number): Promise<void> {
  const data = (await jget(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&append_to_response=seasons`)) as {
    name?: string; first_air_date?: string; status?: string; type?: string; networks?: Array<{ name?: string }>;
    seasons?: Array<{ season_number?: number; name?: string; air_date?: string | null; episode_count?: number }>;
    external_ids?: { imdb_id?: string };
  };
  await sleep(300);
  line(`- tv/${id} "${data.name}" first_air=${data.first_air_date ?? '?'} status=${data.status ?? '?'} type=${data.type ?? '?'} network=${data.networks?.[0]?.name ?? '?'} imdb=${data.external_ids?.imdb_id ?? '?'}`);
  for (const s of data.seasons ?? []) {
    line(`    S${s.season_number} "${s.name}" air=${s.air_date ?? 'null'} eps=${s.episode_count ?? '?'}`);
  }
}

async function tmdbSearch(q: string): Promise<void> {
  const data = (await jget(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false`)) as {
    results?: Array<{ id: number; name?: string; first_air_date?: string }>;
  };
  await sleep(300);
  line(`- query: "${q}" hits=${(data.results ?? []).length}`);
  for (const r of (data.results ?? []).slice(0, 10)) {
    line(`  - tv/${r.id} "${r.name}" first_air=${r.first_air_date ?? '?'}`);
  }
}

async function main(): Promise<void> {
  sec('OL editions — Assassin\'s Creed novelizations');
  for (const w of ['OL16115456W', 'OL15517110W', 'OL16080783W', 'OL28358343W', 'OL16240605W', 'OL42991534W', 'OL19398037W', 'OL19398042W', 'OL28345334W', 'OL20942788W']) {
    await olEditions(w);
  }

  sec('OL editions — Resident Evil + Lara Croft');
  for (const w of ['OL45894637W', 'OL999512W', 'OL522737W', 'OL524269W', 'OL15129437W']) {
    await olEditions(w);
  }

  sec('OL searches — absence rows + revelations tiebreak');
  await olSearch('resident evil');
  await olSearch('assassin\'s creed revelations');

  sec('CV volume detail — LOTDK 1634, Witcher 2025 volumes 3463, Young Love 1533');
  for (const v of [4200, 168138, 163808, 164350, 164349, 2114, 34275]) {
    await cvVolumeDetail(v);
  }

  sec('CV issue store dates — 1510 Hopalong (1953-12-18)');
  await cvIssues(73148, ['1953-12-18']);
  await cvIssues(38368, ['1953-12-18']);

  sec('CV issue store dates — 1533 Young Love (1963-07-18)');
  await cvIssues(2114, ['1963-07-18']);
  await cvIssues(34275, ['1963-07-18']);

  sec('CV issue store dates — 3463 The Witcher (Hardcover) (2025-12-16)');
  for (const v of [168138, 163808, 164350, 164349]) {
    await cvIssues(v, ['2025-12-16']);
  }

  sec('MB search — 2188 Silent Hill Original Soundtracks (1999-03-05)');
  await mbSearch('silent hill');
  await mbRgDetail('f118a56d-33a9-4299-a2f0-1815f859e690');
  await mbRgDetail('39150bd5-466d-4788-bcb7-8c509c53792b');

  sec('MB search — 2333 Hitman World of Assassination OST (2023-01-26)');
  await mbSearch('hitman world of assassination');
  await mbSearch('hitman original score');

  sec('IGDB release dates — 3708 Toy Story Smash It (98638) + 1601 Sgt Rock confirm (62056)');
  await igdbDetail([98638, 62056]);

  sec('TMDB — 3220 Angry Birds on the Run (row 2018-11-17)');
  await tmdbSeasons(219440);
  await tmdbSearch('angry birds on the run');
  await tmdbSearch('angry birds');

  const path = `C:/tmp/yeargap-evidence2-${Date.now()}.md`;
  writeFileSync(path, out.join('\n') + '\n', 'utf8');
  console.log(`WROTE ${path} (${out.length} lines)`);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
