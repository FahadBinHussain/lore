// Round 3: verify IGDB ids found in earlier re-searches, pull MusicBrainz
// release dates for the one remaining 3422 ("Lost Memories") candidate, and
// resolve edition->work for the last three ISBNs (3777 x2, 418).
// Fail loudly on any non-response.

const log = (...a: unknown[]) => console.log(...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fetchText = async (url: string, opts: RequestInit = {}, label = ''): Promise<{ url: string; status: number; body: string }> => {
  const res = await fetch(url, opts);
  const body = await res.text();
  log(`[net] ${res.status} ${body.length}b ${label || url}`);
  return { url, status: res.status, body };
};
const j = async (u: string, opts: RequestInit = {}, label = '') => {
  const r = await fetchText(u, opts, label);
  if (!r.body.trim()) throw new Error(`empty response body from ${u} (status ${r.status})`);
  try { return JSON.parse(r.body); } catch { throw new Error(`non-JSON response from ${u} (status ${r.status}): ${r.body.slice(0, 200)}`); }
};

async function igdbToken(): Promise<string> {
  const cid = process.env.IGDB_CLIENT_ID;
  const sec = process.env.IGDB_CLIENT_SECRET;
  if (!cid || !sec) throw new Error('missing IGDB_CLIENT_ID / IGDB_CLIENT_SECRET in env');
  const tok = await j('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cid, client_secret: sec, grant_type: 'client_credentials' }),
  }, 'igdb-token');
  if (!tok.access_token) throw new Error(`igdb token failed: ${JSON.stringify(tok)}`);
  return tok.access_token;
}

async function main() {
  log(`# Containment round 3 - ${new Date().toISOString()}\n`);

  // ---- IGDB id verification (round 1 searches only surfaced oddball entries) ----
  const token = await igdbToken();
  log('## IGDB id verification');
  const ids = [4379, 18304, 342968, 342969];
  const games = await j('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': process.env.IGDB_CLIENT_ID!, Authorization: `Bearer ${token}` },
    body: `fields id,name,first_release_date,platforms.name,alternative_names.name; where id = (${ids.join(',')}); limit 10;`,
  }, 'igdb-verify');
  if (!Array.isArray(games) || games.length === 0) throw new Error(`IGDB verify returned no games: ${JSON.stringify(games).slice(0, 200)}`);
  for (const g of games) {
    const first = g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : '?';
    log(`- [${g.id}] "${g.name}" first=${first} | platforms: ${(g.platforms ?? []).map((p: { name?: string }) => p.name).join(', ')} | alt-names: ${(g.alternative_names ?? []).map((a: { name?: string }) => a.name).join(' | ')}`);
  }

  // ---- MB: releases of rg 84705524, the "Art of Silent Hill" candidate for row 3422 ----
  log('\n## MB releases of rg 84705524 "Art of Silent Hill" (row 3422 "Lost Memories")');
  await sleep(3200);
  const mbRel = await fetchText('https://musicbrainz.org/ws/2/release?fmt=json&inc=releases+release-groups&query=rg:84705524', {
    headers: { 'User-Agent': 'LoreTracker/1.0 (https://github.com/fahadbinhussain/lore)' },
  }, 'mb-rg-releases');
  if (!mbRel.body.trim().startsWith('{')) throw new Error(`MB rg: search did not return JSON (status ${mbRel.status}): ${mbRel.body.slice(0, 200)}`);
  const mb = JSON.parse(mbRel.body);
  log(`- count=${mb.count} shown=${(mb.releases ?? []).length}`);
  for (const r of (mb.releases ?? []).slice(0, 30)) {
    const first = (r['release-date-range']?.start ?? r.date ?? '').slice(0, 10);
    log(`- id=${r.id} "${r.title}" date=${first || '?'} country=${r.country || '?'} status=${r.status || '?'} | rg="${r['release-group']?.title ?? ''}" rgdate=${r['release-group']?.['first-release-date'] ?? ''}`);
  }

  // ---- OL: edition->work for the final three isbns ----
  // round-2's /api/books jscmd=data returned works=(none) for every isbn, so
  // go edition json -> works[].key -> work title.
  log('\n## OL isbn -> edition -> work');
  for (const isbn of ['9781338767681', '9781338787870', '9781338888959']) {
    await sleep(600);
    const ed = await fetchText(`https://openlibrary.org/isbn/${isbn}.json`, {}, `ol-ed-${isbn}`);
    if (!ed.body.trim().startsWith('{')) { log(`- isbn=${isbn} -> HTTP ${ed.status} (no OL record)`); continue; }
    const e = JSON.parse(ed.body);
    const works: string[] = (e.works ?? []).map((w: { key?: string }) => w.key ?? '');
    log(`- isbn=${isbn} -> edition "${e.title}" pub=${(e.publish_date ?? '').slice(0, 20)} pages=${e.number_of_pages ?? '?'} publisher=${(e.publishers ?? []).join('/')} works=${works.join(',') || '(none)'}`);
    for (const wk of works) {
      await sleep(600);
      const wres = await fetchText(`https://openlibrary.org${wk}.json`, {}, `ol-work-${wk}`);
      if (!wres.body.trim().startsWith('{')) { log(`    ${wk} -> HTTP ${wres.status}`); continue; }
      const w = JSON.parse(wres.body);
      log(`    ${wk} "${w.title}" first_publish=${w.first_publish_date ?? '?'}`);
    }
  }

  log('\n(end round 3)');
}

main().catch((e) => { console.error(e); process.exit(1); });
