// Third-pass detail fetches for batch 1b year-gap adjudication (READ-ONLY).
// Second pass exposed two gaps:
//   - CV volume detail must use resource class 4050 (`/api/volume/4050-<id>/`);
//     the 4000 form answers 102 "Error in URL Format" with results:[] (an empty
//     array is truthy, so it printed "undefined" rows instead of failing loud).
//   - two rows need one more targeted query: Silent Hill / Hitman WoA on MB
//     (the phrase searches ranked wrong) and BIOHAZARD on OpenLibrary.
// No DB access, no writes. Output: C:/tmp/yeargap-evidence3-<ts>.md
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
      if (lastErr.startsWith('HTTP 4') && !lastErr.includes('429')) throw err;
    }
    await sleep(900 * attempt);
  }
  throw new Error(`${url} failed after ${retries} attempts: ${lastErr}`);
}

const CV_KEY = process.env.COMICVINE_API_KEY ?? '';
if (!CV_KEY) die('COMICVINE_API_KEY missing from env files');
const CV_THROTTLE = { statuses: [403, 420], backoff: [60_000, 120_000, 300_000, 600_000, 900_000, 900_000, 900_000] };

const out: string[] = [];
const sec = (t: string) => { out.push('', `## ${t}`); console.log(`-- ${t}`); };
const line = (s: string) => { out.push(s); };

// ---- ComicVine volume detail — resource class 4050 (4000 = wrong class, 102)
async function cvVolumeDetail(volId: number): Promise<void> {
  const data = (await jget(`https://comicvine.gamespot.com/api/volume/4050-${volId}/?api_key=${CV_KEY}&format=json`, {}, 9, CV_THROTTLE)) as {
    error?: string; status_code?: number;
    results?: { name?: string; start_year?: string; end_year?: string; count_of_issues?: number; publisher?: { name?: string }; deck?: string; first_issue?: { issue_number?: string; name?: string }; site_detail_url?: string } | null;
  };
  await sleep(2500);
  if (data.error !== 'OK') { line(`- **volume-${volId}**: PROVIDER ERROR ${data.status_code ?? '?'} "${data.error ?? '?'}"`); return; }
  const v = data.results;
  if (!v || Array.isArray(v)) { line(`- **volume-${volId}**: NO RESULTS (results=${JSON.stringify(v)})`); return; }
  line(`- **volume-${volId}** "${v.name}" run=${v.start_year ?? '?'}–${v.end_year ?? '?'} issues=${v.count_of_issues ?? '?'} publisher=${v.publisher?.name ?? '?'}`);
  line(`  first_issue=#${v.first_issue?.issue_number ?? '?'} ${v.first_issue?.name ? `"${v.first_issue.name}"` : ''} | deck: ${v.deck ? v.deck.slice(0, 200) : '(none)'}`);
  if (v.site_detail_url) line(`  ${v.site_detail_url}`);
}

// ---- ComicVine issues for a volume, optional extra filter clause
type Issue = { id: number; issue_number?: string; name?: string; store_date?: string | null; cover_date?: string | null };
async function cvIssueFilter(volId: number, extraFilter: string, targets: string[]): Promise<void> {
  const filter = `volume:${volId}${extraFilter ? `,${extraFilter}` : ''}`;
  const url = `https://comicvine.gamespot.com/api/issues/?api_key=${CV_KEY}&format=json&filter=${encodeURIComponent(filter)}&field_list=id,issue_number,name,store_date,cover_date&limit=50&sort=cover_date:asc`;
  const data = (await jget(url, {}, 9, CV_THROTTLE)) as { error?: string; status_code?: number; results?: Issue[]; number_of_total_results?: number };
  await sleep(2500);
  if (data.error !== 'OK') { line(`- **volume-${volId} [${extraFilter || 'all'}]**: PROVIDER ERROR ${data.status_code ?? '?'} "${data.error ?? '?'}"`); return; }
  const rows = data.results ?? [];
  const key = (r: Issue) => r.store_date ?? r.cover_date ?? '';
  const dated = rows.filter((r) => r.store_date || r.cover_date).sort((a, b) => key(a).localeCompare(key(b)));
  line(`- **volume-${volId} [${extraFilter || 'all'}]**: total=${data.number_of_total_results ?? '?'} rows=${rows.length} dated=${dated.length}`);
  if (dated.length) line(`  earliest=${key(dated[0])} latest=${key(dated[dated.length - 1])}`);
  for (const r of dated.slice(0, 8)) line(`    #${r.issue_number} ${r.store_date ?? ''}${r.store_date ? ' store' : ''} / cover ${r.cover_date ?? '-'}`);
  if (dated.length > 8) {
    line('    ...');
    for (const r of dated.slice(-4)) line(`    #${r.issue_number} ${r.store_date ?? ''}${r.store_date ? ' store' : ''} / cover ${r.cover_date ?? '-'}`);
  }
  for (const t of targets) {
    const nearest = dated
      .map((r) => ({ r, d: Math.abs(Date.parse(key(r)) - Date.parse(t)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    line(`  target ${t}: ${nearest.map((n) => `#${n.r.issue_number} ${key(n.r)} (${Math.round(n.d / 86400_000)}d${n.r.store_date ? '' : ', cover only'})`).join(', ') || 'NONE DATED'}`);
  }
}

// ---- MusicBrainz release-group search
async function mbSearch(q: string, raw = false): Promise<void> {
  const run = async (query: string) => (await jget(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`,
    { headers: { 'User-Agent': 'LoreMediaTracker/1.0 (yeargap evidence 3)' } },
    4, { statuses: [502, 503], backoff: [8_000, 20_000, 40_000, 60_000] },
  )) as { 'release-groups'?: Array<{ id: string; title: string; 'first-release-date'?: string; 'primary-type'?: string; 'secondary-types'?: string[]; 'artist-credit'?: Array<{ name?: string }> }> };
  let data = await run(raw ? q : `"${q.replace(/"/g, '')}"`);
  let form = raw ? 'raw' : 'quoted';
  await sleep(3100);
  if ((data['release-groups'] ?? []).length === 0 && !raw) {
    data = await run(q.replace(/"/g, ''));
    form = 'unquoted (quoted empty)';
    await sleep(3100);
  }
  line(`- query: ${raw ? q : `"${q}"`} (${form}) hits=${(data['release-groups'] ?? []).length}`);
  for (const rg of data['release-groups'] ?? []) {
    const yr = rg['first-release-date'] ?? '?';
    const artist = (rg['artist-credit'] ?? []).map((a) => a.name ?? '').join('; ') || '-';
    line(`  - ${rg.id} "${rg.title}" first=${yr} type=${rg['primary-type'] ?? '?'}/${(rg['secondary-types'] ?? []).join(',') || '-'} artist=${artist}`);
  }
}

// ---- OpenLibrary search
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

async function main(): Promise<void> {
  sec('CV volume detail (4050) — 1634 LOTDK, 1533/34275 Young Love, 3463 Witcher 2025, 1510 Hopalong');
  for (const v of [4200, 2114, 34275, 168138, 163808, 164350, 164349, 38368, 73148]) {
    await cvVolumeDetail(v);
  }

  sec('CV issue ranges — 1634 LOTDK vol 4200 (1989-10-10), 1510 Hopalong vol 38368 late covers');
  await cvIssueFilter(4200, '', ['1989-10-10']);
  await cvIssueFilter(38368, 'issue_number:86 to 135', ['1953-12-18']);

  sec('MB search — 2188 Silent Hill Original Soundtracks (1999-03-05)');
  await mbSearch('releasegroup:"Silent Hill Original Soundtracks"', true);
  await mbSearch('releasegroup:"silent hill" AND artist:"Akira Yamaoka"', true);

  sec('MB search — 2333 Hitman WoA OST (2023-01-26)');
  await mbSearch('releasegroup:"world of assassination"', true);
  await mbSearch('releasegroup:hitman AND releasegroup:assassination', true);

  sec('OL searches — 2121 BIOHAZARD (2002-07-01, resident-evil universe)');
  await olSearch('biohazard capcom');
  await olSearch('biohazard resident evil novel');

  const path = `C:/tmp/yeargap-evidence3-${Date.now()}.md`;
  writeFileSync(path, out.join('\n') + '\n', 'utf8');
  console.log(`WROTE ${path} (${out.length} lines)`);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
