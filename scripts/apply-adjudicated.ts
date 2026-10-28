// apply reviewed (hand-adjudicated) decisions to rows the matcher refused:
//   {"action":"bind","rowId":N,"provider":"...","externalId":"...","url":"...","why":"..."}
//   {"action":"merge","dupId":N,"holderId":M,"why":"..."}
// bind  = point a still-manual row at a provider entity (keeps id + progress);
// merge = fold a duplicate row into the row that already holds its entity.
// Every decision must carry a `why` with the evidence; merges whose titles do
// not prove the pair are applied as a LOUD title-guard bypass, never silently.
// A holder's placeholder release_date (Jan 1 / Dec 31) is upgraded from the
// dup's precise date in the same transaction; real conflicts are left alone.
// modes: dry (default, transaction rolled back) | apply
// usage: node --env-file=.env.local <bundle> <decisions.json> [apply]
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PSQL = 'C:/Users/Admin/scoop/apps/postgresql/current/bin/psql.exe';
const APPLY = process.argv.includes('apply');
const FILE = process.argv.slice(2).find((a) => a.endsWith('.json'));

type Decision =
  | { action: 'bind'; rowId: number; provider: string; externalId: string; mediaType: string; title: string; url?: string; why: string }
  | { action: 'merge'; dupId: number; holderId: number; why: string };

const fails: string[] = [];
const fail = (s: string) => { fails.push(s); console.log(`FAIL ${s}`); };
const ok = (s: string) => console.log(`OK   ${s}`);
const esc = (s: string) => s.replace(/'/g, "''");

if (!FILE || !existsSync(FILE)) {
  console.error(`FATAL usage: apply-adjudicated <decisions.json> [apply]  (got file: ${FILE ?? 'none'})`);
  process.exit(2);
}
const decisions = JSON.parse(readFileSync(FILE, 'utf8')) as Decision[];
if (!Array.isArray(decisions) || decisions.length === 0) { console.error('FATAL decisions file empty'); process.exit(2); }
for (const d of decisions) {
  if (!d.why || d.why.trim().length < 20) { console.error(`FATAL decision ${JSON.stringify(d)} has no evidence (why < 20 chars)`); process.exit(2); }
  if (d.action === 'bind' && (!d.provider || !d.externalId || !d.mediaType || !d.title)) { console.error('FATAL bind decision missing provider/externalId/mediaType/title'); process.exit(2); }
  if (d.action === 'merge' && !Number.isInteger(d.holderId)) { console.error('FATAL merge decision missing holderId'); process.exit(2); }
}
const binds = decisions.filter((d): d is Extract<Decision, { action: 'bind' }> => d.action === 'bind');
const merges = decisions.filter((d): d is Extract<Decision, { action: 'merge' }> => d.action === 'merge');
console.log(`FILE  ${FILE}: ${binds.length} bind, ${merges.length} merge`);

// ---- psql plumbing (single connection, single transaction)
const envRaw = (readFileSync(`${process.cwd()}/.env.local`, 'utf8').match(/^DATABASE_URL=(.*)$/m) ?? [])[1];
if (!envRaw) { console.error('FATAL no DATABASE_URL in .env.local (run from the repo root)'); process.exit(2); }
const um = envRaw.replace(/^"|"$/g, '').match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
if (!um) { console.error('FATAL DATABASE_URL parse failed'); process.exit(2); }
let pw = um[2];
try { pw = decodeURIComponent(pw); } catch { /* keep raw */ }
const conn = `host=${um[3]} port=5432 user=${um[1]} dbname=${um[4]} sslmode=require connect_timeout=20`;
function psql(sql: string, single = false): string[] {
  const args = [conn, '-t', '-A', '-v', 'ON_ERROR_STOP=1'];
  if (single) args.push('-1');
  const r = spawnSync(PSQL, args, { input: sql, env: { ...process.env, PGPASSWORD: pw }, encoding: 'utf8' });
  if (r.status !== 0) { console.error(`FATAL psql exit ${r.status}:\n${r.stderr}`); process.exit(2); }
  return r.stdout.split(/\r?\n/).filter(Boolean);
}
const n1 = (sql: string): number => {
  const line = psql(sql)[0];
  if (line === undefined || line.startsWith('(')) return NaN;
  return Number(line);
};
const list = (ids: number[]) => ids.join(',');
const norm = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isScope = (source: string, extid: string) => source === 'manual' || extid.startsWith('curated-');
const isPlaceholder = (d: string | null) => !!d && ((d.slice(5, 7) === '01' && d.slice(8, 10) === '01') || (d.slice(5, 7) === '12' && d.slice(8, 10) === '31'));
const today = new Date().toISOString().slice(0, 10);

// ---- live guards
const allIds = [...new Set([...binds.map((b) => b.rowId), ...merges.map((m) => m.dupId), ...merges.map((m) => m.holderId)])];
const rows = psql(`SELECT id, title, media_type, source, external_id, release_date FROM media_items WHERE id IN (${list(allIds)});`)
  .map((l) => {
    const parts = l.split('|');
    const release_date = parts.pop() ?? '';
    const external_id = parts.pop() ?? '';
    const source = parts.pop() ?? '';
    const media_type = parts.pop() ?? '';
    const id = Number(parts.shift());
    return { id, title: parts.join('|'), media_type, source, external_id, release_date };
  });
const rowBy = new Map(rows.map((r) => [r.id, r]));

// bind targets must be unclaimed (loud failure = needs a merge, never auto-merged)
for (const b of binds) {
  const hits = psql(`SELECT media_item_id FROM media_external_ids WHERE provider='${esc(b.provider)}' AND media_type='${esc(b.mediaType)}' AND external_id='${esc(b.externalId)}';`);
  if (hits.length) fail(`bind ${b.rowId}: target ${b.provider}/${b.externalId} already held by media_items ${hits[0]} — merge it instead`);
  const hit2 = psql(`SELECT id FROM media_items WHERE source='${esc(b.provider)}' AND external_id='${esc(b.externalId)}';`);
  if (hit2.length) fail(`bind ${b.rowId}: target held as primary by media_items ${hit2[0]} — merge it instead`);
}

// merge guards: manual dup, bound holder, no progress anywhere near the dup
const dupIds = merges.map((m) => m.dupId);
const prog = new Map(dupIds.length ? psql(`SELECT media_item_id, count(*) FROM user_media_progress WHERE media_item_id IN (${list(dupIds)}) GROUP BY 1;`)
  .map((l) => { const [id, n] = l.split('|'); return [Number(id), Number(n)] as const; }) : []);
const uep = new Map(dupIds.length ? psql(`SELECT s.media_item_id, count(*) FROM seasons s JOIN episodes e ON e.season_id = s.id JOIN user_episode_progress p ON p.episode_id = e.id WHERE s.media_item_id IN (${list(dupIds)}) GROUP BY 1;`)
  .map((l) => { const [id, n] = l.split('|'); return [Number(id), Number(n)] as const; }) : []);

let dupMemb = NaN, holderMemb = NaN;
const bypasses: string[] = [];
const keptMerges: Array<[number, number]> = [];
for (const m of merges) {
  const d = rowBy.get(m.dupId), h = rowBy.get(m.holderId);
  const skip = (why: string) => fail(`merge ${m.dupId}->${m.holderId}: ${why}`);
  if (!d) { skip('dup row missing'); continue; }
  if (!h) { skip('holder missing'); continue; }
  if (m.dupId === m.holderId) { skip('self-merge'); continue; }
  if (!isScope(d.source, d.external_id)) skip(`dup not in manual scope (source=${d.source})`);
  if (h.source === 'manual' || h.external_id.startsWith('curated-')) skip(`holder still unbound (${h.source})`);
  if ((prog.get(m.dupId) ?? 0) > 0) skip(`${prog.get(m.dupId)} progress rows on dup — refusing to delete`);
  if ((uep.get(m.dupId) ?? 0) > 0) skip(`${uep.get(m.dupId)} episode-progress rows under dup — refusing to delete`);
  if (fails.length) continue;
  const [x, y] = [norm(d.title), norm(h.title)];
  if (!(x === y || x.includes(y) || y.includes(x))) {
    bypasses.push(`TITLE-GUARD-BYPASS merge ${m.dupId} "${d.title}" -> ${m.holderId} "${h.title}": ${m.why}`);
  }
  keptMerges.push([m.dupId, m.holderId]);
}
for (const b of binds) {
  const r = rowBy.get(b.rowId);
  if (!r) { fail(`bind ${b.rowId}: row missing`); continue; }
  if (r.title !== b.title) fail(`bind ${b.rowId}: title drift (file "${b.title}" vs db "${r.title}")`);
  if (!isScope(r.source, r.external_id)) fail(`bind ${b.rowId}: row not in manual scope (source=${r.source}, external_id=${r.external_id})`);
}
if (fails.length) { console.error('FATAL guard failures — refusing to continue'); process.exit(1); }
for (const b of binds) ok(`bind ${b.rowId} -> ${b.provider}/${b.externalId} (${b.why})`);
for (const l of bypasses) console.log(`LOUD ${l}`);
if (merges.length) {
  dupMemb = n1(`SELECT count(*) FROM collection_items WHERE media_item_id IN (${list(keptMerges.map(([d]) => d))});`);
  holderMemb = n1(`SELECT count(*) FROM collection_items WHERE media_item_id IN (${list(keptMerges.map(([, h]) => h))});`);
}
const scopePre = n1(`SELECT count(*) FROM media_items WHERE source = 'manual' OR external_id LIKE 'curated-%';`);
const totalPre = n1(`SELECT count(*) FROM media_items;`);
// date carry: dup precise (not Jan-1/Dec-31 placeholder) + holder placeholder + same year.
// SQL updates each holder row at most once, so count DISTINCT holders, not pairs — two dups
// merging into one placeholder holder (batch 3: 2288 and 3613 -> 2724) carry a single date.
const carryByHolder = new Map<number, string>();
for (const [d, h] of keptMerges) {
  const dd = rowBy.get(d)?.release_date ?? null, hh = rowBy.get(h)?.release_date ?? null;
  if (!(dd && hh && !isPlaceholder(dd) && isPlaceholder(hh) && dd.slice(0, 4) === hh.slice(0, 4))) continue;
  const prev = carryByHolder.get(h);
  if (prev !== undefined && prev !== dd) fail(`date-carry ambiguous: holder ${h} would receive ${prev} and ${dd} from two dups`);
  carryByHolder.set(h, dd);
}
const dateCarryExp = carryByHolder.size;
if (fails.length) { console.error(`ADJUDICATION ABORTED — pre-SQL guard failed, nothing touched`); process.exit(1); }

// ---- one transaction: binds, merges, asserts (dry rolls it back)
const sql: string[] = ['BEGIN;'];
if (binds.length) {
  const bindUpd = binds.map((b) => `(${b.rowId},'${esc(b.title)}','${esc(b.provider)}','${esc(b.externalId)}')`).join(',');
  sql.push(`WITH u AS (UPDATE media_items m SET source = x.provider, external_id = x.external_id FROM (VALUES ${bindUpd}) AS x(id, title, provider, external_id) WHERE m.id = x.id AND m.title = x.title AND (m.source = 'manual' OR m.external_id LIKE 'curated-%') RETURNING 1) SELECT 'bind-rows', count(*) FROM u;`);
  const bindIns = binds.map((b) => `(${b.rowId},'${esc(b.provider)}','${esc(b.mediaType)}','${esc(b.externalId)}','${esc(b.url ?? '')}','${esc(b.why)}')`).join(',');
  // WHERE EXISTS keeps the extid insert tied to the UPDATE above — a 0-row title-guard
  // match can never leave a themeparks extid on a still-manual row.
  sql.push(`WITH i AS (INSERT INTO media_external_ids (media_item_id, provider, media_type, external_id, source_url, is_primary, confidence, metadata) SELECT x.id, x.provider, x.media_type::media_type, x.external_id, nullif(x.url,''), true, 100, jsonb_build_object('rebound', '${today}', 'from', 'manual', 'via', 'apply-adjudicated', 'why', x.why) FROM (VALUES ${bindIns}) AS x(id, provider, media_type, external_id, url, why) WHERE EXISTS (SELECT 1 FROM media_items m WHERE m.id = x.id AND m.source = x.provider AND m.external_id = x.external_id) RETURNING 1) SELECT 'bind-extids', count(*) FROM i;`);
}
if (keptMerges.length) {
  const pairsSql = keptMerges.map(([d, h]) => `(${d},${h})`).join(',');
  sql.push(`CREATE TEMP TABLE md (dup_id int PRIMARY KEY, holder_id int NOT NULL) ON COMMIT DROP;`);
  sql.push(`INSERT INTO md VALUES ${pairsSql};`);
  sql.push(`CREATE TEMP TABLE touched AS SELECT DISTINCT collection_id FROM collection_items ci JOIN md ON ci.media_item_id = md.dup_id;`);
  sql.push(`WITH u AS (UPDATE media_items m SET release_date = d.release_date FROM md JOIN media_items d ON d.id = md.dup_id JOIN media_items h ON h.id = md.holder_id WHERE m.id = md.holder_id AND m.release_date <> d.release_date AND split_part(d.release_date::text, '-', 1) = split_part(m.release_date::text, '-', 1) AND NOT (split_part(d.release_date::text, '-', 2) = '01' AND split_part(d.release_date::text, '-', 3) = '01') AND NOT (split_part(d.release_date::text, '-', 2) = '12' AND split_part(d.release_date::text, '-', 3) = '31') AND ((split_part(m.release_date::text, '-', 2) = '01' AND split_part(m.release_date::text, '-', 3) = '01') OR (split_part(m.release_date::text, '-', 2) = '12' AND split_part(m.release_date::text, '-', 3) = '31')) RETURNING 1) SELECT 'date-carried', count(*) FROM u;`);
  sql.push(`WITH d AS (DELETE FROM collection_items ci USING md WHERE ci.media_item_id = md.dup_id AND EXISTS (SELECT 1 FROM collection_items c2 WHERE c2.collection_id = ci.collection_id AND c2.media_item_id = md.holder_id) RETURNING 1) SELECT 'collide-del', count(*) FROM d;`);
  sql.push(`WITH u AS (UPDATE collection_items ci SET media_item_id = md.holder_id FROM md WHERE ci.media_item_id = md.dup_id RETURNING 1) SELECT 'merge-move', count(*) FROM u;`);
  // in-transaction guarantee: the delete below must never cascade away a membership
  sql.push(`SELECT 'dups-memb-left', count(*) FROM collection_items WHERE media_item_id IN (${list(keptMerges.map(([d]) => d))});`);
  sql.push(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM collection_items WHERE media_item_id IN (SELECT dup_id FROM md)) THEN RAISE EXCEPTION 'dups still hold memberships before delete'; END IF; END $$;`);
  sql.push(`WITH d AS (DELETE FROM media_items m USING md WHERE m.id = md.dup_id RETURNING 1) SELECT 'deleted', count(*) FROM d;`);
  sql.push(`WITH u AS (UPDATE collection_items ci SET release_order = o.rn FROM (SELECT id, row_number() OVER (PARTITION BY collection_id ORDER BY release_order, id) rn FROM collection_items WHERE collection_id IN (SELECT collection_id FROM touched)) o WHERE ci.id = o.id AND ci.release_order <> o.rn RETURNING 1) SELECT 'renumbered', count(*) FROM u;`);
  sql.push(`WITH u AS (UPDATE collections c SET item_count = (SELECT count(*) FROM collection_items ci WHERE ci.collection_id = c.id) WHERE c.id IN (SELECT collection_id FROM touched) RETURNING 1) SELECT 'count-updated', count(*) FROM u;`);
}
sql.push(`SELECT 'scope-left', count(*) FROM media_items WHERE source = 'manual' OR external_id LIKE 'curated-%';`);
sql.push(`SELECT 'total-post', count(*) FROM media_items;`);
if (keptMerges.length) {
  sql.push(`SELECT 'dups-left', count(*) FROM media_items WHERE id IN (${list(keptMerges.map(([d]) => d))});`);
  sql.push(`SELECT 'order-bad', count(*) FROM (SELECT collection_id, count(*) n, count(DISTINCT release_order) d, min(release_order) mn, max(release_order) mx FROM collection_items WHERE collection_id IN (SELECT collection_id FROM touched) GROUP BY 1) x WHERE x.n <> x.d OR x.mn <> 1 OR x.mx <> x.n;`);
  sql.push(`SELECT 'count-mismatch', count(*) FROM collections c WHERE c.id IN (SELECT collection_id FROM touched) AND c.item_count IS DISTINCT FROM (SELECT count(*) FROM collection_items ci WHERE ci.collection_id = c.id);`);
  sql.push(`SELECT 'memb-holders', count(*) FROM collection_items WHERE media_item_id IN (${list(keptMerges.map(([, h]) => h))});`);
  sql.push(`SELECT 'memb-dups', count(*) FROM collection_items WHERE media_item_id IN (${list(keptMerges.map(([d]) => d))});`);
}
sql.push(APPLY ? 'COMMIT;' : 'ROLLBACK;');

const out = psql(sql.join('\n'));
const got = new Map<string, number>();
for (const line of out) {
  const [k, v] = line.split('|');
  got.set(k, Number(v));
}
const expect: Record<string, number> = {};
if (binds.length) {
  expect['bind-rows'] = binds.length;
  expect['bind-extids'] = binds.length;
}
expect['scope-left'] = scopePre - binds.length - keptMerges.length;
expect['total-post'] = totalPre - keptMerges.length;
if (keptMerges.length) {
  const collide = got.get('collide-del') ?? NaN;
  const move = got.get('merge-move') ?? NaN;
  expect['date-carried'] = dateCarryExp;
  expect['dups-memb-left'] = 0;
  expect.deleted = keptMerges.length;
  expect['dups-left'] = 0;
  expect['order-bad'] = 0;
  expect['count-mismatch'] = 0;
  expect['memb-holders'] = holderMemb + dupMemb - collide;
  expect['memb-dups'] = 0;
  if (move + collide !== dupMemb) fail(`membership accounting: moved ${move} + collide-deleted ${collide} != dup memberships ${dupMemb}`);
}
for (const [k, v] of Object.entries(expect)) {
  const g = got.get(k);
  if (g === undefined) fail(`${k} missing from output`);
  else if (g !== v) fail(`${k}=${g}, expected ${v}`);
}
console.log(`PLAN/RESULT: ${binds.length} bound, ${keptMerges.length} merged (move=${got.get('merge-move') ?? 0} collide=${got.get('collide-del') ?? 0}), touched collections=${got.get('count-updated') ?? 0}, date-carried=${got.get('date-carried') ?? 0}`);

// ---- post-commit proof (apply only, fresh reads)
if (APPLY && !fails.length) {
  for (const b of binds) {
    const r = psql(`SELECT source, external_id FROM media_items WHERE id = ${b.rowId};`);
    const [source, external_id] = (r[0] ?? '').split('|');
    if (source !== b.provider || external_id !== b.externalId) fail(`bind ${b.rowId}: post state source=${source} extid=${external_id}`);
    const via = n1(`SELECT count(*) FROM media_external_ids WHERE media_item_id = ${b.rowId} AND provider = '${esc(b.provider)}' AND metadata->>'via' = 'apply-adjudicated';`);
    if (via !== 1) fail(`bind ${b.rowId}: adjudicated extid row count ${via}`);
  }
  if (keptMerges.length) {
    const gone = n1(`SELECT count(*) FROM media_items WHERE id IN (${list(keptMerges.map(([d]) => d))});`);
    if (gone !== 0) fail(`${gone} merged rows still present after commit`);
    const holders = [...new Set(keptMerges.map(([, h]) => h))];
    const held = n1(`SELECT count(*) FROM media_items WHERE id IN (${list(holders)});`);
    if (held !== holders.length) fail(`holders missing after commit (${held}/${holders.length})`);
  }
  const scopePost = n1(`SELECT count(*) FROM media_items WHERE source = 'manual' OR external_id LIKE 'curated-%';`);
  if (scopePost !== scopePre - binds.length - keptMerges.length) fail(`scope ${scopePost} != expected ${scopePre - binds.length - keptMerges.length}`);
  ok(`post-commit: scope ${scopePre} -> ${scopePost}, ${binds.length} bound, ${keptMerges.length} merged`);
}

if (fails.length) { console.error(`ADJUDICATION ${APPLY ? 'FAILED' : 'DRY FAILED'} — ${fails.length} problem(s)`); process.exit(1); }
console.log(`ADJUDICATION ${APPLY ? 'APPLIED' : 'DRY OK'} — ${binds.length} bound, ${keptMerges.length} merged, 0 failed`);
