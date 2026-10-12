// Universe creator: Bird Box (AGENTS "Universe creation workflow").
// 5 official bound items across 3 providers (TMDB, Open Library, MusicBrainz) —
// verify-then-insert: every item is re-verified against its provider API,
// then inserted or updated through ensureCanonicalMediaItem.
// Run: npx --yes esbuild@0.25.10 scripts/create-bird-box-universe.ts --bundle --platform=node --format=cjs --outfile=C:/tmp/create-bird-box.cjs
// Then: node --env-file=.env --env-file=.env.local C:/tmp/create-bird-box.cjs [dry|apply]
import { db } from '../src/db/index';
import { collections, collectionItems, mediaExternalIds, mediaItems, users } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { and, eq } from 'drizzle-orm';

type MediaType = 'movie' | 'book' | 'soundtrack';

type ResearchItem = {
  mediaType: MediaType;
  title: string;
  source: string;
  externalId: string;
  releaseDate: string | null;
  author?: string;
  publisher?: string | null;
  notes?: string;
};

const ITEMS: ResearchItem[] = [
  // 1. Bird Box (Novel) - Josh Malerman debut novel
  {
    mediaType: 'book',
    title: 'Bird Box',
    source: 'openlibrary',
    externalId: 'OL26500168W',
    releaseDate: '2014-05-13',
    author: 'Josh Malerman',
    publisher: 'Ecco',
    notes: 'Debut novel; first published UK March 27, 2014 via Harper Voyager, US May 13, 2014 via Ecco.',
  },
  // 2. Bird Box (Film) - Directed by Susanne Bier, starring Sandra Bullock
  {
    mediaType: 'movie',
    title: 'Bird Box',
    source: 'tmdb',
    externalId: '405774',
    releaseDate: '2018-12-13',
    notes: '2018 Netflix psychological horror film; premiered AFI Fest 2018-11-12; global streaming 2018-12-21.',
  },
  // 3. Bird Box (Soundtrack) - Trent Reznor & Atticus Ross original score
  {
    mediaType: 'soundtrack',
    title: 'Bird Box (Soundtrack)',
    source: 'musicbrainz',
    externalId: '9d9088f3-356c-445b-8397-d02e09cfec51',
    releaseDate: '2019-01-01',
    author: 'Trent Reznor, Atticus Ross',
    notes: 'Original score composed by Trent Reznor and Atticus Ross for the 2018 film.',
  },
  // 4. Malorie (Novel) - Direct sequel novel by Josh Malerman
  {
    mediaType: 'book',
    title: 'Malorie',
    source: 'openlibrary',
    externalId: 'OL24142948W',
    releaseDate: '2020-07-21',
    author: 'Josh Malerman',
    publisher: 'Del Rey',
    notes: 'Direct sequel to Bird Box, set twelve years later. Published July 21, 2020 via Del Rey.',
  },
  // 5. Bird Box Barcelona (Film) - Spin-off sequel set in Spain
  {
    mediaType: 'movie',
    title: 'Bird Box Barcelona',
    source: 'tmdb',
    externalId: '805320',
    releaseDate: '2023-07-14',
    notes: '2023 Spanish-language spin-off sequel written and directed by Álex and David Pastor.',
  },
];

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return (await res.json()) as T;
}

async function verifyItem(item: ResearchItem): Promise<{
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
}> {
  if (item.source === 'tmdb') {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error('TMDB_API_KEY missing');
    const data = await fetchJson<{
      title: string;
      poster_path: string | null;
      backdrop_path: string | null;
      overview: string | null;
    }>(`https://api.themoviedb.org/3/movie/${item.externalId}?api_key=${key}`);
    console.log(`✓ tmdb movie ${item.externalId}: "${data.title}"`);
    return {
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      overview: data.overview,
    };
  }

  if (item.source === 'openlibrary') {
    const data = await fetchJson<{
      title?: string;
      covers?: number[];
      description?: string | { value?: string };
    }>(`https://openlibrary.org/works/${item.externalId}.json`);
    console.log(`✓ openlibrary work ${item.externalId}: "${data.title}"`);
    const coverId = data.covers?.[0];
    const descText =
      typeof data.description === 'string'
        ? data.description
        : data.description?.value ?? null;
    return {
      posterPath: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
      backdropPath: null,
      overview: descText,
    };
  }

  if (item.source === 'musicbrainz') {
    const data = await fetchJson<{
      title: string;
      'artist-credit'?: Array<{ artist?: { name?: string } }>;
    }>(`https://musicbrainz.org/ws/2/release-group/${item.externalId}?fmt=json`, {
      'User-Agent': 'Lore/1.0 (info@lore.app)',
    });
    console.log(`✓ musicbrainz release-group ${item.externalId}: "${data.title}"`);
    return {
      posterPath: null,
      backdropPath: null,
      overview: `Original soundtrack for Bird Box.`,
    };
  }

  throw new Error(`Unsupported source: ${item.source}`);
}

async function main() {
  const mode = process.argv[2] ?? 'dry';
  const apply = mode === 'apply';
  console.log(`=== Bird Box Universe Creator (${apply ? 'APPLY' : 'DRY RUN'}) ===\n`);

  console.log(`verifying ${ITEMS.length} items against primary provider APIs...`);
  const verified: Array<ResearchItem & { posterPath: string | null; backdropPath: string | null; overview: string | null }> = [];

  for (const item of ITEMS) {
    const details = await verifyItem(item);
    verified.push({ ...item, ...details });
  }

  console.log(`\nall ${verified.length} items verified successfully.`);

  if (!apply) {
    console.log('\n[DRY RUN] run with `apply` to commit to database.');
    return;
  }

  console.log('\napplying changes to database...');

  const creator =
    (process.env.CREATOR_EMAIL
      ? await db.query.users.findFirst({ where: eq(users.email, process.env.CREATOR_EMAIL) })
      : null) || (await db.query.users.findFirst());

  if (!creator) {
    console.error('!! no user found in database — aborting');
    process.exit(1);
  }

  // 1. Ensure or update the collection
  const existingColl = await db.query.collections.findFirst({
    where: eq(collections.slug, 'bird-box'),
  });

  const movieEntry = verified.find((i) => i.source === 'tmdb' && i.externalId === '405774');
  const coverImage = movieEntry?.posterPath ?? null;
  const bannerImage = movieEntry?.backdropPath ?? null;
  const description =
    "Josh Malerman's post-apocalyptic psychological horror universe, spanning novels, Netflix film adaptations, and the original soundtrack by Trent Reznor and Atticus Ross.";

  let universeId: number;

  if (existingColl) {
    console.log(`updating existing universe id ${existingColl.id} ("${existingColl.name}")...`);
    await db
      .update(collections)
      .set({
        name: 'Bird Box',
        description,
        coverImage,
        bannerImage,
        itemCount: verified.length,
        visibility: 'public',
        updatedAt: new Date(),
      })
      .where(eq(collections.id, existingColl.id));
    universeId = existingColl.id;
  } else {
    console.log('creating new universe "Bird Box"...');
    const [inserted] = await db
      .insert(collections)
      .values({
        name: 'Bird Box',
        slug: 'bird-box',
        description,
        coverImage,
        bannerImage,
        createdBy: creator.id,
        itemCount: verified.length,
        visibility: 'public',
      })
      .returning({ id: collections.id });
    universeId = inserted.id;
  }

  // 2. Insert or ensure each media item
  for (let idx = 0; idx < verified.length; idx++) {
    const item = verified[idx];
    const order = idx + 1;

    const canonical = await ensureCanonicalMediaItem({
      externalId: item.externalId,
      mediaType: item.mediaType,
      title: item.title,
      source: item.source,
      releaseDate: item.releaseDate,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      description: item.overview,
      author: item.author,
      publisher: item.publisher,
    });

    if (!canonical) {
      throw new Error(`Failed to ensure canonical media item for "${item.title}"`);
    }

    const targetMediaItemId = canonical.mediaItem.id;

    // Check membership
    const existingMembership = await db.query.collectionItems.findFirst({
      where: and(
        eq(collectionItems.collectionId, universeId),
        eq(collectionItems.mediaItemId, targetMediaItemId)
      ),
    });

    if (existingMembership) {
      await db
        .update(collectionItems)
        .set({
          releaseOrder: order,
          notes: item.notes,
        })
        .where(eq(collectionItems.id, existingMembership.id));
      console.log(`  [${order}/${verified.length}] updated membership for: "${item.title}" (id: ${targetMediaItemId})`);
    } else {
      await db.insert(collectionItems).values({
        collectionId: universeId,
        mediaItemId: targetMediaItemId,
        releaseOrder: order,
        notes: item.notes,
      });
      console.log(`  [${order}/${verified.length}] inserted membership for: "${item.title}" (id: ${targetMediaItemId})`);
    }
  }

  console.log(`\n✓ Bird Box universe successfully applied!`);
  console.log(`  ID: ${universeId}`);
  console.log(`  Slug: bird-box`);
  console.log(`  Items: ${verified.length}`);
  console.log(`  Cover: ${coverImage}`);
  console.log(`  Banner: ${bannerImage}`);
  console.log(`  URL: /universes/bird-box (univrs.vercel.app)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
