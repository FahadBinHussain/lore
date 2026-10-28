// Year-gap evidence dump — batch 1b of the ambiguous manual re-bind debt.
// The 42 AMBIGUOUS rows whose why reads "exact title but year gap N" each
// need per-row provider DETAIL evidence before adjudication: search hits
// alone carry only the top titles + years, which is what the matcher already
// rejected. This re-runs the sweep's provider search for the listed ids,
// then fetches the detail that proves or disproves identity:
//   book       -> OpenLibrary work editions (publish dates, publishers, edition titles)
//   comic      -> ComicVine volume records (publisher, start/end year, issue count, deck)
//   soundtrack -> MusicBrainz release-group artist credits + first-release-date
//   game       -> IGDB release dates + platforms + alternative names + summary
//   tv         -> TMDB first_air_date + season count + overview
// Plus each row's own manual evidence row (source_url / metadata) and its
// universe memberships for context.
// READ-ONLY: no DB writes, no provider writes.
// Output: C:/tmp/yeargap-evidence-<ts>.md (cards) + .json (same data).
// usage: node --env-file=.env.local <bundle> <ids.json>   ({"ids":[2121,...]})
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
    entries?: Array<{ title?: string; publish_date?: string; publish_year?: number[]; publishers?: string[] }>;
  };
  await sleep(800);
  const lines = (data.entries ?? []).slice(0, 20).map((e) => {
    const pd = e.publish_date ?? (e.publish_year?.length ? String(e.publish_year[0]) : 'no-date');
    const pub = e.publishers?.[0] ?? '?';
    const t = (e.title ?? '?').slice(0, 70);
    return `- ed "${t}" pub=${pd} publisher=${pub}`;
  });
  if (!lines.length) lines.push('- NO EDITIONS SERVED');
  return { label: 'editions', lines };
}

// ComicVine: search (fuzzy-OR) keeps api_detail_url; detail = volume record.
async function cvSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const data = (await jget(
    `https://comicvine.gamespot.com/api/search/?api_key=${CV_KEY}&format=json&resources=volume&query=${encodeURIComponent(q)}&limit=50`,
    {}, 9,
    { statuses: [403, 420], backoff: [60_000, 120_000, 300_000, 600_000, 900_000, 900_000, 900_000, 900_000, 900_000] },
  )) as { results?: Array<{ id: number; name: string; start_year?: string; site_detail_url?: string; api_detail_url?: string; deck?: string }> };
  await sleep(2500);
  return (data.results ?? []).map((r) => mkCand(rowTitle, {
    provider: 'comicvine',
    externalId: `volume-${r.id}`,
    title: r.name,
    year: r.start_year ? Number(r.start_year) || null : null,
    url: r.site_detail_url ?? `https://comicvine.gamespot.com/volume/4000-${r.id}`,
    detailUrl: r.api_detail_url ?? '',
    extra: r.deck ? r.deck.slice(0, 120) : undefined,
  }));
}
async function cvVolumeDetail(detailUrl: string): Promise<Detail> {
  const sep = detailUrl.includes('?') ? '&' : '?';
  const data = (await jget(`${detailUrl}${sep}api_key=${CV_KEY}&format=json`, {}, 9,
    { statuses: [403, 420], backoff: [60_000, 120_000, 300_000, 600_000, 900_000, 900_000, 900_000] })) as {
      results?: { name?: string; start_year?: string; end_year?: string; count_of_issues?: number; publisher?: { name?: string }; deck?: string; site_detail_url?: string; first_issue?: { issue_number?: string; name?: string } };
    };
  await sleep(2500);
  const v = data.results;
  if (!v) return { label: 'volume-detail', lines: ['- NO RESULTS'] };
  return {
    label: 'volume-detail',
    lines: [
      `- "${v.name}" run=${v.start_year ?? '?'}–${v.end_year ?? '?'} issues=${v.count_of_issues ?? '?'} publisher=${v.publisher?.name ?? '?'}`,
      `- first_issue=#${v.first_issue?.issue_number ?? '?'} ${v.first_issue?.name ? `"${v.first_issue.name}"` : ''}`,
      v.deck ? `- deck: ${v.deck.slice(0, 220)}` : '- deck: (none)',
    ],
  };
}

// MusicBrainz: search release-groups; detail = artist credit + dates.
async function mbSearch(q: string, rowTitle: string): Promise<Cand[]> {
  const phrase = canonTitle(q).replace(/"/g, '');
  const run = async (query: string) => (await jget(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`,
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (yeargap evidence)' } },
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
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (yeargap evidence)' } },
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

// pick detail targets: exact-title first, then closest-year among |gap| <= 6, cap 4
function pickDetail(cands: Cand[], rowYear: number | null): Cand[] {
  const exact = cands.filter((c) => c.match === 'exact');
  const near = rowYear === null ? [] : cands.filter((c) => c.match !== 'none' && c.year !== null && Math.abs(c.year - rowYear) <= 6);
  const out: Cand[] = [];
  for (const c of [...exact.slice(0, 3), ...near.slice(0, 4)]) if (!out.some((o) => o.externalId === c.externalId)) out.push(c);
  if (!out.length) out.push(...cands.slice(0, 2));
  return out.slice(0, 4);
}

type Row = { id: number; title: string; media_type: string; release_date: string | null; source: string; external_id: string };
type Card = { row: Row; rowYear: number | null; evidence: string | null; memberships: string[]; candidates: Cand[]; details: Array<{ forId: string; detail: Detail }>; error?: string };

async function main(): Promise<void> {
  const FILE_ARG = process.argv.slice(2).find((a) => a.endsWith('.json'));
if (!FILE_ARG || !existsSync(FILE_ARG)) { console.error(`FATAL usage: evidence-yeargap <ids.json>  (got: ${FILE_ARG ?? 'none'})`); process.exit(2); }
const FILE: string = FILE_ARG;
  const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as { ids?: number[] };
  const ids = parsed.ids ?? [];
  if (!ids.length || !ids.every(Number.isInteger)) die(`${FILE} must carry a non-empty integer "ids" array`);

  // ids are validated integers above — inline them (the neon http driver does
  // not reliably serialize a JS array param into an ::int[] literal).
  const idList = ids.join(',');
  const rowsRes = await db.execute(sql`SELECT id, title, media_type::text AS media_type, release_date, source, external_id FROM media_items WHERE id IN (${sql.raw(idList)}) ORDER BY media_type, id`);
  const rows = (rowsRes as unknown as { rows: Row[] }).rows ?? [];
  if (rows.length !== ids.length) die(`asked ${ids.length} ids, DB returned ${rows.length} — missing rows are loud`);
  for (const r of rows) {
    if (!(r.source === 'manual' || r.external_id.startsWith('curated-'))) die(`row ${r.id} not in manual scope (source=${r.source})`);
  }
  console.log(`EVIDENCE rows=${rows.length}`);

  // per-row context: manual evidence row + universe memberships
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
        case 'comic': {
          card.candidates = await cvSearch(q, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) {
            if (!c.detailUrl) { card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: { label: 'volume-detail', lines: ['- NO api_detail_url IN SEARCH HIT'] } }); continue; }
            card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await cvVolumeDetail(c.detailUrl) });
          }
          break;
        }
        case 'soundtrack': {
          card.candidates = await mbSearch(row.title, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await mbRgDetail(c.externalId) });
          break;
        }
        case 'game': {
          card.candidates = await igdbSearch(row.title, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await igdbDetail([Number(c.externalId)]) });
          break;
        }
        case 'tv': {
          card.candidates = await tmdbTvSearch(q, row.title);
          for (const c of pickDetail(card.candidates, rowYear)) card.details.push({ forId: `${c.externalId} "${c.title}" (${c.year ?? '?'})`, detail: await tmdbTvDetail(Number(c.externalId)) });
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

  // markdown cards
  let md = `# Year-gap evidence (batch 1b) — ${new Date().toISOString()}\n\nRows: ${rows.length}; errors: ${errors.length}\n`;
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
  const mdPath = `C:/tmp/yeargap-evidence-${stamp}.md`;
  const jsonPath = `C:/tmp/yeargap-evidence-${stamp}.json`;
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify({ at: new Date().toISOString(), ids, cards }, null, 2));
  console.log(`EVIDENCE ${mdPath}`);
  console.log(`EVIDENCE ${jsonPath}`);
  if (errors.length) { console.error(`EVIDENCE FAILED — ${errors.length} row error(s):\n${errors.join('\n')}`); process.exit(2); }
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
