// Seeds `artists` from asahi417/wikiart-all (HF, keyless, Mar 2024 snapshot).
// Refs-only: stores slug/name/sourceUrl + artwork_count, never image files.
// Run: bundle with esbuild then `node --env-file=.env --env-file=.env.local <bundle>.cjs`.
import { db } from '../src/db/index';
import { artists } from '../src/db/schema';

const DATASET = 'asahi417/wikiart-all';
const SEED_REV = 'asahi417-2024-03';
const PAGE = 100;
const SOURCE = (slug: string) => `https://www.wikiart.org/en/${slug}`;

type Agg = { slug: string; name: string; hexId: string; count: number };

async function fetchPage(offset: number) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${DATASET}&config=default&split=test&offset=${offset}&length=${PAGE}`;
  let lastErr = '';
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': 'lore-seeder/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data.error) throw new Error(`HF rows FAILED offset=${offset} error=${JSON.stringify(data.error)}`);
      return data.rows as Array<{ row: Record<string, unknown> }>;
    }
    lastErr = `status=${res.status}`;
    if (res.status !== 429 && res.status < 500) throw new Error(`HF rows FAILED offset=${offset} status=${res.status} — aborting, no partial commit`);
    const wait = Math.min(2000 * 2 ** (attempt - 1), 60000);
    console.log(`retry offset=${offset} attempt=${attempt} status=${res.status} wait=${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`HF rows FAILED offset=${offset} ${lastErr} after 6 attempts — aborting, no partial commit`);
}

async function main() {
  const sizeRes = await fetch(`https://datasets-server.huggingface.co/size?dataset=${DATASET}`, {
    headers: { 'User-Agent': 'lore-seeder/1.0' },
  });
  if (!sizeRes.ok) throw new Error(`HF size FAILED status=${sizeRes.status}`);
  const total = (await sizeRes.json()).size.configs[0].num_rows as number;
  console.log(`total rows=${total}`);

  const byArtist = new Map<string, Agg>();
  for (let offset = 0; offset < total; offset += PAGE) {
    const rows = await fetchPage(offset);
    for (const { row } of rows) {
      const slug = String(row.artistUrl || '');
      if (!slug) continue;
      const cur = byArtist.get(slug) || { slug, name: String(row.artistName || slug), hexId: String(row.artistId || ''), count: 0 };
      cur.count += 1;
      if (!cur.name || cur.name === cur.slug) cur.name = String(row.artistName || slug);
      byArtist.set(slug, cur);
    }
    if (offset % 1000 === 0) console.log(`fetched ${offset + rows.length}/${total} artists=${byArtist.size}`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  const list = [...byArtist.values()];
  console.log(`distinct artists=${list.length}`);
  const stal = list.find((a) => a.slug === 'simon-stalenhag');
  console.log(`STALENHAG probe: ${stal ? `${stal.name} works=${stal.count}` : 'MISSING from snapshot'}`);

  let upserted = 0;
  for (const a of list) {
    await db
      .insert(artists)
      .values({
        provider: 'wikiart',
        externalId: a.slug,
        slug: a.slug,
        name: a.name,
        sourceUrl: SOURCE(a.slug),
        seedRev: SEED_REV,
        artworkCount: a.count,
        metadata: { wikiartArtistId: a.hexId, seedRev: SEED_REV } as unknown as typeof artists.$inferInsert.metadata,
      })
      .onConflictDoUpdate({
        target: [artists.provider, artists.externalId],
        set: { name: a.name, sourceUrl: SOURCE(a.slug), seedRev: SEED_REV, artworkCount: a.count, updatedAt: new Date() },
      });
    upserted += 1;
    if (upserted % 500 === 0) console.log(`upserted ${upserted}/${list.length}`);
  }
  console.log(`DONE upserted=${upserted} seed=${SEED_REV}`);
}

main().catch((e) => {
  console.error('SEED FAILED:', e);
  process.exit(1);
});
