// merge duplicate media rows found by the 2026-10-14 manual re-bind sweep.
// each dup row D is a second, still-manual row for an item whose real provider id
// is already held by row H (from the apply report's DUP decisions). the merge moves
// D's universe memberships and comments onto H, renumbers the touched collections,
// then deletes D — keeping id/progress/membership data lossless.
// modes: dry (default, transaction rolled back) | apply
// usage: node --env-file=.env.local <bundle> [apply]
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PSQL = 'C:/Users/Admin/scoop/apps/postgresql/current/bin/psql.exe';
const REPORT = 'C:/tmp/rebind-report-apply-1791950350549.json';
const APPLY = process.argv.includes('apply');

type Dec = {
  status: string;
  why?: string;
  note?: string;
  row: { id: number; title: string; media_type: string; source: string; external_id: string };
};
const report = JSON.parse(readFileSync(REPORT, 'utf8')) as { decisions: Dec[] };

const fails: string[] = [];
const fail = (s: string) => { fails.push(s); console.log(`FAIL ${s}`); };
const ok = (s: string) => console.log(`OK   ${s}`);

// ---- pairs from DUP notes
const pairs = new Map<number, number>();
for (const d of report.decisions) {
  if (d.status !== 'DUP') continue;
  const m = d.note!.match(/already bound to media_items (\d+)/) ?? d.note!.match(/same provider entity as row (\d+)/);
  if (!m) { fail(`row ${d.row.id}: unparseable dup note: ${d.note}`); continue; }
  pairs.set(d.row.id, Number(m[1]));
}
if (pairs.size !== 250) { console.error(`FATAL expected 250 dup pairs, got ${pairs.size}`); process.exit(2); }
const dupIds = [...pairs.keys()];
const holderIds = [...pairs.values()];

// ---- psql plumbing
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
const q1 = (sql: string): Record<string, string> | undefined => {
  const line = psql(sql)[0];
  if (!line || line.startsWith('(')) return undefined;
  const parts = line.split('|');
  const out: Record<string, string> = {};
  parts.forEach((p, i) => { out[`c${i}`] = p; });
  return out;
};
const n1 = (sql: string): number => Number(q1(sql)?.c0 ?? NaN);
const list = (ids: number[]) => ids.join(',');
const norm = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---- live guards
const rows = psql(`SELECT id, title, source, external_id FROM media_items WHERE id IN (${list([...dupIds, ...holderIds])});`)
  .map((l) => {
    const parts = l.split('|');
    const external_id = parts.pop()!;
    const source = parts.pop()!;
    const id = Number(parts.shift());
    return { id, title: parts.join('|'), source, external_id };
  });
const rowBy = new Map(rows.map((r) => [r.id, r]));
const prog = new Map(psql(`SELECT media_item_id, count(*) FROM user_media_progress WHERE media_item_id IN (${list(dupIds)}) GROUP BY 1;`)
  .map((l) => { const [id, n] = l.split('|'); return [Number(id), Number(n)] as const; }));
const uep = new Map(psql(`SELECT s.media_item_id, count(*) FROM seasons s JOIN episodes e ON e.season_id = s.id JOIN user_episode_progress p ON p.episode_id = e.id WHERE s.media_item_id IN (${list(dupIds)}) GROUP BY 1;`)
  .map((l) => { const [id, n] = l.split('|'); return [Number(id), Number(n)] as const; }));
const epComments = n1(`SELECT count(*) FROM comments c JOIN episodes e ON c.episode_id = e.id JOIN seasons s ON e.season_id = s.id WHERE s.media_item_id IN (${list(dupIds)});`);
const dupLists = n1(`SELECT count(*) FROM list_items WHERE media_item_id IN (${list(dupIds)});`);
const dupComments = n1(`SELECT count(*) FROM comments WHERE media_item_id IN (${list(dupIds)});`);
const actRefs = n1(`SELECT count(*) FROM activity_log WHERE entity_id IN (${list(dupIds)});`);
const totalPre = n1(`SELECT count(*) FROM media_items;`);
const scopePre = n1(`SELECT count(*) FROM media_items WHERE source = 'manual' OR external_id LIKE 'curated-%';`);
const dupSet = new Map(pairs); // dup id -> claimed holder, used to resolve chains

// a dup may point at another dup (in-run loser -> winner that is itself a clash-dup);
// follow the chain to the real, provider-bound holder. cycles fail loudly.
const resolveHolder = (id: number, depth = 0): number => {
  if (depth > 10) { console.error(`FATAL holder chain too deep/cyclic at ${id}`); process.exit(2); }
  const h = pairs.get(id)!;
  return dupSet.has(h) ? resolveHolder(h, depth + 1) : h;
};

if (dupLists !== 0) { console.error(`FATAL ${dupLists} list memberships on dup rows — extend the script to move them first`); process.exit(2); }
if (actRefs !== 0) console.log(`NOTE ${actRefs} activity_log rows reference dup ids — log rows are kept, their pointer is not re-pointed`);
if (dupComments !== 0) console.log(`NOTE ${dupComments} comments on dup rows — will move to the holder`);
if (epComments !== 0) { console.error(`FATAL ${epComments} episode comments under dup rows — extend the script before deleting`); process.exit(2); }

const keep: Array<[number, number]> = [];
for (const d of dupIds) {
  const h = resolveHolder(d);
  const dr = rowBy.get(d), hr = rowBy.get(h);
  const skip = (why: string) => { console.log(`SKIP ${d} -> ${h}: ${why} (stays manual)`); };
  if (!dr) { skip('dup row missing'); continue; }
  if (!hr) { skip('holder missing'); continue; }
  if (dr.source !== 'manual' && !dr.external_id.startsWith('curated-')) { skip(`dup row is no longer manual (${dr.source})`); continue; }
  if (hr.source === 'manual' || hr.external_id.startsWith('curated-')) { skip(`holder still unbound (${hr.source})`); continue; }
  const [x, y] = [norm(dr.title), norm(hr.title)];
  if (x !== y && !x.includes(y) && !y.includes(x)) { skip(`title mismatch "${dr.title}" vs "${hr.title}"`); continue; }
  if ((prog.get(d) ?? 0) > 0) { skip(`${prog.get(d)} progress rows on dup — refusing to delete`); continue; }
  if ((uep.get(d) ?? 0) > 0) { skip(`${uep.get(d)} episode-progress rows under dup — refusing to delete`); continue; }
  keep.push([d, h]);
}
const keptDup = keep.map(([d]) => d);
const keptHold = keep.map(([, h]) => h);
if (fails.length) { console.error('FATAL guard failures — refusing to continue'); process.exit(1); }
const dupMemb = n1(`SELECT count(*) FROM collection_items WHERE media_item_id IN (${list(keptDup)});`);
const holderMemb = n1(`SELECT count(*) FROM collection_items WHERE media_item_id IN (${list(keptHold)});`);
ok(`${keep.length}/250 pairs passed every guard (dup memberships=${dupMemb}, holder memberships=${holderMemb})`);

// ---- transaction: move, delete, renumber, recount, assert
const pairsSql = keep.map(([d, h]) => `(${d},${h})`).join(',');
const sql: string[] = [];
sql.push(`CREATE TEMP TABLE dp (dup_id int PRIMARY KEY, holder_id int NOT NULL) ON COMMIT DROP;`);
sql.push(`INSERT INTO dp VALUES ${pairsSql};`);
sql.push(`CREATE TEMP TABLE touched AS SELECT DISTINCT collection_id FROM collection_items ci JOIN dp ON ci.media_item_id = dp.dup_id;`);
sql.push(`WITH d AS (DELETE FROM collection_items ci USING dp WHERE ci.media_item_id = dp.dup_id AND EXISTS (SELECT 1 FROM collection_items c2 WHERE c2.collection_id = ci.collection_id AND c2.media_item_id = dp.holder_id) RETURNING 1) SELECT 'collide-del', count(*) FROM d;`);
sql.push(`WITH u AS (UPDATE collection_items ci SET media_item_id = dp.holder_id FROM dp WHERE ci.media_item_id = dp.dup_id RETURNING 1) SELECT 'coll-move', count(*) FROM u;`);
sql.push(`SELECT 'dups-memb-left', count(*) FROM collection_items WHERE media_item_id IN (${list(keptDup)});`);
sql.push(`WITH d AS (DELETE FROM media_items m USING dp WHERE m.id = dp.dup_id RETURNING 1) SELECT 'deleted', count(*) FROM d;`);
sql.push(`WITH u AS (UPDATE collection_items ci SET release_order = o.rn FROM (SELECT id, row_number() OVER (PARTITION BY collection_id ORDER BY release_order, id) rn FROM collection_items WHERE collection_id IN (SELECT collection_id FROM touched)) o WHERE ci.id = o.id AND ci.release_order <> o.rn RETURNING 1) SELECT 'renumbered', count(*) FROM u;`);
sql.push(`WITH u AS (UPDATE collections c SET item_count = (SELECT count(*) FROM collection_items ci WHERE ci.collection_id = c.id) WHERE c.id IN (SELECT collection_id FROM touched) RETURNING 1) SELECT 'count-updated', count(*) FROM u;`);
sql.push(`SELECT 'scope-left', count(*) FROM media_items WHERE source = 'manual' OR external_id LIKE 'curated-%';`);
sql.push(`SELECT 'dups-left', count(*) FROM media_items WHERE id IN (${list(dupIds)});`);
sql.push(`SELECT 'order-bad', count(*) FROM (SELECT collection_id, count(*) n, count(DISTINCT release_order) d, min(release_order) mn, max(release_order) mx FROM collection_items WHERE collection_id IN (SELECT collection_id FROM touched) GROUP BY 1) x WHERE x.n <> x.d OR x.mn <> 1 OR x.mx <> x.n;`);
sql.push(`SELECT 'count-mismatch', count(*) FROM collections c WHERE c.id IN (SELECT collection_id FROM touched) AND c.item_count IS DISTINCT FROM (SELECT count(*) FROM collection_items ci WHERE ci.collection_id = c.id);`);
sql.push(`SELECT 'memb-holders', count(*) FROM collection_items WHERE media_item_id IN (${list(keptHold)});`);
sql.push(`SELECT 'memb-dups', count(*) FROM collection_items WHERE media_item_id IN (${list(keptDup)});`);
sql.push(APPLY ? 'COMMIT;' : 'ROLLBACK;');

const out = psql(sql.join('\n'), true);
const got = new Map<string, number>();
for (const line of out) {
  const [k, v] = line.split('|');
  got.set(k, Number(v));
}
const collide = got.get('collide-del') ?? NaN;
const move = got.get('coll-move') ?? NaN;
const expect: Record<string, number> = {
  'dups-memb-left': 0,
  deleted: keep.length,
  'scope-left': scopePre - keep.length,
  'dups-left': dupIds.length - keep.length,
  'order-bad': 0,
  'count-mismatch': 0,
  'memb-holders': holderMemb + dupMemb - collide,
  'memb-dups': 0,
};

const check = (k: string) => {
  const v = got.get(k);
  if (v === undefined) fail(`${k} missing from output`);
  else if (!Number.isNaN(expect[k]) && v !== expect[k]) fail(`${k}=${v}, expected ${expect[k]}`);
};
for (const k of Object.keys(expect)) check(k);
if (move + collide !== dupMemb) fail(`membership accounting: moved ${move} + collide-deleted ${collide} != dup memberships ${dupMemb}`);
console.log(`PLAN/RESULT: ${keep.length} rows deleted, memberships moved=${move} collide-deleted=${collide} (dup memberships ${dupMemb}), touched collections=${got.get('count-updated')}, renumbered rows=${got.get('renumbered')}`);

// ---- post-verify (apply only, fresh connection — proves the committed state)
if (APPLY && !fails.length) {
  const totalPost = n1(`SELECT count(*) FROM media_items;`);
  if (totalPost !== totalPre - keep.length) fail(`media_items total ${totalPost} != ${totalPre} - ${keep.length}`);
  const gone = n1(`SELECT count(*) FROM media_items WHERE id IN (${list(keptDup)});`);
  if (gone !== 0) fail(`${gone} dup rows still present after commit`);
  const distinctHolders = [...new Set(keptHold)];
  const held = n1(`SELECT count(*) FROM media_items WHERE id IN (${list(distinctHolders)});`);
  if (held !== distinctHolders.length) fail(`only ${held}/${distinctHolders.length} distinct holders survived`);
  const membPost = n1(`SELECT count(*) FROM collection_items WHERE media_item_id IN (${list(distinctHolders)});`);
  if (membPost !== expect['memb-holders']) fail(`post-commit memb-holders ${membPost} != in-tx ${expect['memb-holders']}`);
  ok(`post-commit: total -${keep.length}, 0 dups left, ${held}/${distinctHolders.length} distinct holders intact, memberships settled at ${membPost}`);
}

if (fails.length) { console.error(`MERGE ${APPLY ? 'FAILED' : 'DRY FAILED'} — ${fails.length} problem(s)`); process.exit(1); }
console.log(`MERGE ${APPLY ? 'APPLIED' : 'DRY OK'} — ${keep.length} dup rows ${APPLY ? 'merged and deleted' : 'queued'}; ${pairs.size - keep.length} skipped`);
