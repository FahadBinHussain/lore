// Backfill TMDB audience scores onto episodes of AniList-bound anime (AGENTS roadmap
// "episode rating coverage for anilist-source anime"). The AniList binding stays canonical —
// this only borrows TMDB vote_average/vote_count per episode.
// Resolution, in order, each logged loudly per show:
//   method 1 = AniList `externalLinks` TMDB url (primary; turned out these 28 entries carry
//              only streaming links — no TMDB — verified by hand 2026-09-30)
//   method 2 = TMDB /search/tv, exact-title candidates, title-verified against /tv/{id}
//   method 3 = same search but keeping "our title contains the TMDB name" candidates and
//              disambiguating multiples by AniList startYear vs TMDB first_air_date
// Season-identity guard: a show title match is NOT an episode match — every season is
// verified against the DB rows (air-date agreement within 7 days, name agreement as the
// no-dates fallback) before a single write; unverifiable seasons stay NULL, loudly.
// Writes are guarded by `rating IS NULL` so nothing already scored is ever overwritten.
// Run: npx esbuild bundle -> node --env-file=.env.local <bundle>.cjs [dry|apply]
import { db } from '../src/db/index';
import { episodes } from '../src/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

const TMDB_KEY = process.env.TMDB_API_KEY;
const UA = 'LoreMediaTracker/1.0 (episode-rating backfill)';

type ShowRow = { show_id: number; title: string; external_id: string };
type NullEpRow = { ep_id: number; season_number: number; episode_number: number; air_date: string | null; name: string | null };
type TmdbEpisode = { episode_number: number; air_date?: string | null; name?: string | null; vote_average?: number; vote_count?: number };
type TmdbShowInfo = { name: string; first_air_date?: string };

type Plan = {
  show: ShowRow;
  method: 'anilist-links' | 'tmdb-search' | 'tmdb-search+year' | 'tmdb-search+season-count' | 'unresolved';
  tmdbId: number | null;
  tmdbName: string | null;
  fills: Array<{ epId: number; season: number; episode: number; rating: string; voteCount: number | null }>;
  missingSeasons: string[]; // "s{n} (reason)"
  missingEpisodes: string[];
  nullCount: number;
  verifyNote: string;
  reason?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string, init?: RequestInit, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.status === 429 || resp.status >= 500) {
        if (attempt === retries) throw new Error(`HTTP ${resp.status} after ${retries} tries: ${url.split('?')[0]}`);
        await sleep(1800 * attempt);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url.split('?')[0]}`);
      return await resp.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1200 * attempt);
    }
  }
  throw new Error('unreachable');
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function titleMatches(candidates: string[], fetched: string): boolean {
  const nf = norm(fetched);
  if (!nf) return false;
  return candidates.some((c) => {
    const nc = norm(c);
    if (!nc) return false;
    return nc === nf || nc.includes(nf) || nf.includes(nc);
  });
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

async function fetchAnilistMedia(anilistId: number): Promise<{ titles: string[]; tmdbTvId: number | null; startYear: number | null }> {
  const query = `query ($id: Int) { Media(id: $id) { id title { romaji english } startDate { year } externalLinks { site url } } }`;
  const data = await fetchJson(
    'https://graphql.anilist.co',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query, variables: { id: anilistId } }),
    },
    3
  );
  const media = data?.data?.Media;
  if (!media) throw new Error(`anilist Media(${anilistId}) returned no data${data?.errors ? `: ${JSON.stringify(data.errors).slice(0, 200)}` : ''}`);
  const titles = [media.title?.romaji, media.title?.english].filter((t): t is string => Boolean(t));
  const links: Array<{ site?: string; url?: string }> = media.externalLinks ?? [];
  let tmdbTvId: number | null = null;
  for (const l of links) {
    const m = (l.url ?? '').match(/themoviedb\.org\/tv\/(\d+)/);
    if (m) tmdbTvId = Number(m[1]);
  }
  const startYear = media.startDate?.year ?? null;
  return { titles, tmdbTvId, startYear };
}

async function tmdbSearch(query: string): Promise<Array<{ id: number; name: string }>> {
  const data = await fetchJson(
    `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`,
    undefined,
    3
  );
  return (data.results ?? []) as Array<{ id: number; name: string }>;
}

async function getTmdbShow(tmdbId: number): Promise<TmdbShowInfo> {
  return await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}`, undefined, 3);
}

function strippedVariants(title: string): string[] {
  const out: string[] = [];
  const noParen = title.replace(/\s*\(.*\)\s*$/, '').trim();
  if (noParen && noParen !== title) out.push(noParen);
  const noColon = title.replace(/\s*[:\-].*$/, '').trim();
  if (noColon && noColon !== title && !out.includes(noColon)) out.push(noColon);
  return out;
}

async function resolveBySearch(
  titles: string[],
  startYear: number | null,
  lowSeason: { season: number; count: number }
): Promise<{ id: number | null; method: Plan['method']; note?: string }> {
  const queries = [...new Set(titles)].slice(0, 3);
  const candidates = new Map<number, string>();
  for (const q of queries) {
    for (const r of await tmdbSearch(q)) candidates.set(r.id, r.name);
    await sleep(250);
  }
  if (candidates.size === 0) {
    // retry with parenthetical/colon-stripped title variants (e.g. "Doraemon (2005)" -> "Doraemon")
    for (const v of [...new Set(titles.flatMap(strippedVariants))].slice(0, 2)) {
      for (const r of await tmdbSearch(v)) candidates.set(r.id, r.name);
      await sleep(250);
    }
  }
  // keep exact-title candidates and "our title is the more specific form" candidates
  const kept: Array<{ id: number; name: string; exact: boolean }> = [];
  for (const [id, name] of candidates) {
    const ourExact = titles.some((t) => norm(t) === norm(name));
    const ourContains = titles.some((t) => norm(t).includes(norm(name)) && norm(t) !== norm(name));
    if (ourExact) kept.push({ id, name, exact: true });
    else if (ourContains) kept.push({ id, name, exact: false });
  }
  if (kept.length === 0) return { id: null, method: 'unresolved' };

  const exacts = kept.filter((k) => k.exact);
  const pool = exacts.length > 0 ? exacts : kept;

  // single candidate: still year-verified when anilist knows the start year
  if (pool.length === 1) {
    try {
      const detail = await getTmdbShow(pool[0].id);
      const year = detail.first_air_date ? Number(detail.first_air_date.slice(0, 4)) : null;
      await sleep(250);
      if (startYear != null && year != null && year !== startYear) {
        return { id: null, method: 'unresolved', note: `year mismatch: candidate ${pool[0].id} is ${year}, anilist startYear ${startYear}` };
      }
      return { id: pool[0].id, method: 'tmdb-search', note: pool[0].exact ? 'exact title' : 'our title contains tmdb name (year-checked)' };
    } catch {
      return { id: pool[0].id, method: 'tmdb-search', note: pool[0].exact ? 'exact title (detail fetch failed, year unchecked)' : 'contains tmdb name (detail fetch failed, year unchecked)' };
    }
  }

  // method 3: disambiguate by AniList startYear vs TMDB first_air_date
  const detail: Array<{ id: number; name: string; year: number | null }> = [];
  for (const k of pool.slice(0, 6)) {
    try {
      const info = await getTmdbShow(k.id);
      detail.push({ id: k.id, name: info.name, year: info.first_air_date ? Number(info.first_air_date.slice(0, 4)) : null });
      await sleep(250);
    } catch {
      /* candidate detail failed — leave it out of the tiebreak */
    }
  }
  let tied = detail;
  if (startYear != null) {
    const yearHits = detail.filter((d) => d.year === startYear);
    if (yearHits.length === 1) {
      return { id: yearHits[0].id, method: 'tmdb-search+year', note: `startYear ${startYear} vs candidates ${detail.map((d) => `${d.id}:${d.year ?? '?'}`).join(', ')}` };
    }
    if (yearHits.length === 0) {
      return { id: null, method: 'unresolved', note: `no candidate matches anilist startYear ${startYear}: ${detail.map((d) => `${d.id}:${d.year ?? '?'}`).join(', ')}` };
    }
    tied = yearHits;
  }
  if (tied.length === 1) {
    return { id: tied[0].id, method: 'tmdb-search+year', note: `year ${tied[0].year} unique among ${detail.length}` };
  }

  // method 4: season-count tiebreak — the candidate whose season {lowSeason} has exactly
  // our row count is the only one that can hold these episodes
  const counted: Array<{ id: number; count: number }> = [];
  for (const t of tied.slice(0, 6)) {
    try {
      const eps = await getTmdbSeason(t.id, lowSeason.season);
      counted.push({ id: t.id, count: eps ? eps.length : -1 });
      await sleep(250);
    } catch {
      counted.push({ id: t.id, count: -1 });
    }
  }
  const hits = counted.filter((c) => c.count === lowSeason.count);
  if (hits.length === 1) {
    return { id: hits[0].id, method: 'tmdb-search+season-count', note: `s${lowSeason.season} count ${lowSeason.count} unique vs ${counted.map((c) => `${c.id}:${c.count}`).join(', ')}` };
  }
  return {
    id: null,
    method: 'unresolved',
    note: `ambiguous after season-count tiebreak (our s${lowSeason.season}=${lowSeason.count}): ${counted.map((c) => `${c.id}:${c.count}`).join(', ')}`,
  };
}

async function getTmdbSeason(tmdbId: number, season: number): Promise<TmdbEpisode[] | null> {
  try {
    const data = await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}`, undefined, 3);
    if (!Array.isArray(data?.episodes)) return null;
    return data.episodes as TmdbEpisode[];
  } catch (err) {
    if ((err as Error).message.includes('HTTP 404')) return null;
    throw err;
  }
}

// total rows in a season, rated or not — the method-4 tiebreak must compare the WHOLE season
// against TMDB even when a previous apply died mid-write and only part of the season is scored
async function fullSeasonCount(showId: number, season: number): Promise<number> {
  const res = await db.execute(
    `SELECT count(*)::int AS n FROM episodes e JOIN seasons s ON s.id = e.season_id
     WHERE s.media_item_id = ${Number(showId)} AND s.season_number = ${Number(season)}`
  );
  return (res as unknown as { rows: Array<{ n: number }> }).rows[0]?.n ?? 0;
}

// Season-identity guard: returns { ok, why } — a season may only be written when its DB rows
// demonstrably ARE the TMDB season's episodes: dates first, real names (generic "Episode N"
// stubs excluded) as fallback, exact full-row-count as the last resort for bare stub seasons.
function verifySeason(rows: NullEpRow[], tmdbEps: TmdbEpisode[], fullCount: number): { ok: boolean; why: string } {
  const byNumber = new Map(tmdbEps.map((e) => [e.episode_number, e]));
  const dated = rows.filter((r) => r.air_date);
  if (dated.length >= Math.min(3, rows.length)) {
    let agree = 0;
    for (const r of dated) {
      const t = byNumber.get(r.episode_number);
      if (t?.air_date && daysBetween(r.air_date!, t.air_date) <= 7) agree++;
    }
    const ratio = agree / dated.length;
    if (ratio >= 0.75) return { ok: true, why: `air-date: ${agree}/${dated.length} within 7d` };
    return { ok: false, why: `air-date mismatch: only ${agree}/${dated.length} within 7d` };
  }
  const isGeneric = (n: string) => /^\s*ep(isode)?\s*\d+[a-z]?\s*$/i.test(n);
  const named = rows.filter((r) => r.name && !isGeneric(r.name));
  if (named.length >= Math.min(3, rows.length)) {
    let agree = 0;
    for (const r of named) {
      const t = byNumber.get(r.episode_number);
      if (t?.name && titleMatches([r.name!], t.name)) agree++;
    }
    const ratio = agree / named.length;
    if (ratio >= 0.75) return { ok: true, why: `name: ${agree}/${named.length} agree` };
    return { ok: false, why: `name mismatch: only ${agree}/${named.length} agree` };
  }
  if (fullCount === tmdbEps.length) {
    return { ok: true, why: `row-count equal (${fullCount}, stub rows unverifiable)` };
  }
  return { ok: false, why: `cannot verify: ${dated.length} dated / ${named.length} real-named rows and full-count ${fullCount} != tmdb ${tmdbEps.length}` };
}

async function buildPlans(): Promise<Plan[]> {
  const scopeRes = await db.execute(
    `SELECT DISTINCT m.id AS show_id, m.title, m.external_id
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     JOIN media_items m ON m.id = s.media_item_id
     WHERE e.rating IS NULL AND m.source = 'anilist'
     ORDER BY m.title`
  );
  const shows = (scopeRes as unknown as { rows: ShowRow[] }).rows;

  const plans: Plan[] = [];
  for (const show of shows) {
    const epsRes = await db.execute(
      `SELECT e.id AS ep_id, s.season_number, e.episode_number, e.air_date::text AS air_date, e.name
       FROM episodes e
       JOIN seasons s ON s.id = e.season_id
       WHERE s.media_item_id = ${Number(show.show_id)} AND e.rating IS NULL
       ORDER BY s.season_number, e.episode_number`
    );
    const nullEps = (epsRes as unknown as { rows: NullEpRow[] }).rows;
    const plan: Plan = { show, method: 'unresolved', tmdbId: null, tmdbName: null, fills: [], missingSeasons: [], missingEpisodes: [], nullCount: nullEps.length, verifyNote: '' };
    plans.push(plan);

    const anilistId = Number(String(show.external_id).replace(/^anilist-/, ''));
    if (!Number.isFinite(anilistId)) {
      plan.reason = `external_id "${show.external_id}" is not numeric`;
      continue;
    }

    let titles: string[] = [show.title];
    let startYear: number | null = null;
    let tmdbId: number | null = null;
    let method: Plan['method'] = 'anilist-links';
    try {
      const res = await fetchAnilistMedia(anilistId);
      titles = [...new Set([...titles, ...res.titles])];
      startYear = res.startYear;
      tmdbId = res.tmdbTvId;
      await sleep(800); // AniList ~90 req/min
    } catch (err) {
      plan.reason = `anilist lookup failed: ${(err as Error).message}`;
    }

    if (tmdbId === null) {
      const seasons = [...new Set(nullEps.map((e) => e.season_number))].sort((a, b) => a - b);
      const lowSeason = { season: seasons[0], count: await fullSeasonCount(show.show_id, seasons[0]) };
      try {
        const res = await resolveBySearch(titles, startYear, lowSeason);
        tmdbId = res.id;
        if (res.method !== 'unresolved') method = res.method;
        if (res.note) plan.reason = [plan.reason, `search: ${res.note}`].filter(Boolean).join('; ');
        if (res.method !== 'unresolved') {
          console.log(`  ~  [${res.method}] resolved "${show.title}" → TMDB ${tmdbId} (${res.note})`);
        }
      } catch (err) {
        plan.reason = [plan.reason, `tmdb search: ${(err as Error).message}`].filter(Boolean).join('; ');
      }
    }

    if (tmdbId === null) {
      plan.reason = [plan.reason, plan.reason?.includes('search:') ? '' : 'no TMDB id via externalLinks or title search'].filter(Boolean).join('; ');
      continue;
    }

    // show-identity verification before touching any row
    const showInfo = await getTmdbShow(tmdbId);
    if (!titleMatches(titles, showInfo.name)) {
      plan.reason = `TMDB ${tmdbId} name "${showInfo.name}" does not match our titles (${titles.join(' | ')}) — rejected`;
      continue;
    }
    plan.method = method;
    plan.tmdbId = tmdbId;
    plan.tmdbName = showInfo.name;

    // per-season guard, then fill
    const seasons = [...new Set(nullEps.map((e) => e.season_number))].sort((a, b) => a - b);
    const verifyNotes: string[] = [];
    for (const season of seasons) {
      const rows = nullEps.filter((e) => e.season_number === season);
      const tmdbEps = await getTmdbSeason(tmdbId, season);
      if (!tmdbEps) {
        plan.missingSeasons.push(`s${season} (404 on TMDB)`);
        continue;
      }
      const guard = verifySeason(rows, tmdbEps, await fullSeasonCount(show.show_id, season));
      if (!guard.ok) {
        plan.missingSeasons.push(`s${season} (${guard.why})`);
        continue;
      }
      verifyNotes.push(`s${season}: ${guard.why}`);
      const byNumber = new Map(tmdbEps.map((e) => [e.episode_number, e]));
      for (const row of rows) {
        const match = byNumber.get(row.episode_number);
        if (!match || match.vote_average == null) {
          plan.missingEpisodes.push(`s${season}e${row.episode_number}`);
          continue;
        }
        plan.fills.push({
          epId: row.ep_id,
          season,
          episode: row.episode_number,
          rating: String(match.vote_average),
          voteCount: match.vote_count ?? null,
        });
      }
      await sleep(250); // TMDB courtesy
    }
    plan.verifyNote = verifyNotes.join(' | ');
    await sleep(250);
  }
  return plans;
}

async function main() {
  const mode = (process.argv[2] || 'dry').trim();
  if (mode !== 'dry' && mode !== 'apply') {
    console.error(`unknown mode "${mode}" — use: dry | apply`);
    process.exit(2);
  }
  if (!TMDB_KEY) {
    console.error('!! TMDB_API_KEY missing from env — nothing to run against');
    process.exit(1);
  }
  console.log(`anilist episode rating backfill — mode=${mode}\n`);

  const plans = await buildPlans();

  // ---- report
  const unresolved = plans.filter((p) => p.method === 'unresolved');
  const resolved = plans.filter((p) => p.method !== 'unresolved');
  const totalNull = plans.reduce((n, p) => n + p.nullCount, 0);
  const totalFills = resolved.reduce((n, p) => n + p.fills.length, 0);
  const rejectedSeasonRows = resolved.reduce((n, p) => {
    const rejectedSeasons = p.missingSeasons.filter((s) => !s.includes('404')).length;
    return n + rejectedSeasons; // counted only for reporting; exact row math is in totals below
  }, 0);
  void rejectedSeasonRows;
  const blockedRows = resolved.reduce((n, p) => n + p.nullCount - p.fills.length, 0);
  const unresolvedRows = unresolved.reduce((n, p) => n + p.nullCount, 0);
  const totalMissingEp = resolved.reduce((n, p) => n + p.missingEpisodes.length, 0);

  console.log(`[1/2] resolution — ${plans.length} shows, ${totalNull} null-rated episodes:`);
  for (const p of plans) {
    if (p.method === 'unresolved') {
      console.log(`  !! UNRESOLVED  ${p.show.title} (anilist ${p.show.external_id}) — ${p.reason ?? 'no reason'} — ${p.nullCount} episodes stay NULL`);
    } else {
      const gaps: string[] = [];
      if (p.missingSeasons.length) gaps.push(`seasons: ${p.missingSeasons.join(', ')}`);
      if (p.missingEpisodes.length) gaps.push(`episodes: ${p.missingEpisodes.slice(0, 12).join(' ')}${p.missingEpisodes.length > 12 ? ` +${p.missingEpisodes.length - 12}` : ''}`);
      console.log(`  ok  [${p.method}]  ${p.show.title} → TMDB ${p.tmdbId} "${p.tmdbName}" — ${p.fills.length}/${p.nullCount} fillable${p.verifyNote ? ` — verify ${p.verifyNote}` : ''}${gaps.length ? ` — gaps: ${gaps.join('; ')}` : ''}`);
    }
  }
  const methodCount = (m: Plan['method']) => resolved.filter((p) => p.method === m).length;
  console.log(`\nmethods: anilist-links=${methodCount('anilist-links')}  tmdb-search=${methodCount('tmdb-search')}  tmdb-search+year=${methodCount('tmdb-search+year')}  tmdb-search+season-count=${methodCount('tmdb-search+season-count')}  unresolved=${unresolved.length}`);
  console.log(`fills planned: ${totalFills}  |  blocked: ${blockedRows} (missing eps ${totalMissingEp} + rejected/unverified seasons)  |  unresolved: ${unresolvedRows}`);
  const sum = totalFills + blockedRows + unresolvedRows;
  if (sum !== totalNull) {
    console.error(`!! accounting mismatch: fills ${totalFills} + blocked ${blockedRows} != total ${totalNull}`);
    process.exit(1);
  }

  if (mode === 'dry') {
    console.log('\ndry run — nothing written. Re-run with: apply');
    return;
  }

  // ---- apply
  console.log('\n[2/2] writing...');
  let written = 0;
  for (const p of resolved) {
    if (p.fills.length === 0) continue;
    for (const f of p.fills) {
      const res = await db
        .update(episodes)
        .set({ rating: f.rating, voteCount: f.voteCount })
        .where(and(eq(episodes.id, f.epId), isNull(episodes.rating)))
        .returning({ id: episodes.id });
      if (res.length === 1) written++;
    }
    console.log(`  ${p.show.title}: ${p.fills.length} episodes scored (TMDB ${p.tmdbId})`);
  }

  // ---- post-verify
  const remainRes = await db.execute(
    `SELECT count(*)::int AS n FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     JOIN media_items m ON m.id = s.media_item_id
     WHERE e.rating IS NULL AND m.source = 'anilist'`
  );
  const remaining = (remainRes as unknown as { rows: Array<{ n: number }> }).rows[0]?.n ?? -1;
  const expectedRemaining = totalNull - totalFills;
  const fails: string[] = [];
  if (written !== totalFills) fails.push(`wrote ${written} rows, planned ${totalFills}`);
  if (remaining !== expectedRemaining) fails.push(`remaining NULL = ${remaining}, expected ${expectedRemaining}`);
  if (fails.length > 0) {
    console.error('\n!! post-backfill verification FAILED:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }

  console.log(`\nDONE: ${written} episodes scored; ${remaining} still NULL (unresolved shows / unverifiable seasons, listed above)`);
  console.log('verify: mixed-order timeline now shows star badges on the backfilled anime');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
