import { db } from '../src/db';
import { collections, collectionItems } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { eq } from 'drizzle-orm';

/**
 * Blame! Universe — All Official Media Items
 * Research: C:\Users\Admin\Downloads\lore\research_blame\
 * Ordered by release order (earliest first)
 */

interface UniverseItem {
  title: string;
  externalId: string;
  source: 'anilist' | 'tmdb' | 'manual';
  mediaType: 'manga' | 'movie' | 'anime';
  releaseDate: string;
  notes?: string;
}

const BLAME_UNIVERSE_ITEMS: UniverseItem[] = [
  // Prequel
  {
    title: 'NOiSE',
    externalId: '30465', // AniList manga
    source: 'anilist',
    mediaType: 'manga',
    releaseDate: '2000-02-10',
    notes: 'Prequel to Blame!',
  },
  // Main series
  {
    title: 'Blame!',
    externalId: '30149', // AniList manga
    source: 'anilist',
    mediaType: 'manga',
    releaseDate: '1997-01-25',
    notes: 'Main manga series (10 volumes)',
  },
  // Early ONAs (AniList anime)
  {
    title: 'Blame! Ver. 0.11',
    externalId: '1055', // AniList ONA
    source: 'anilist',
    mediaType: 'anime',
    releaseDate: '2003-10-24',
    notes: '6-part ONA by Group TAC + 1 DVD episode',
  },
  {
    title: 'Blame! Prologue',
    externalId: '3430',
    source: 'anilist',
    mediaType: 'anime',
    releaseDate: '2007-09-07',
    notes: '2-episode ONA by Production I.G',
  },
  // Spin-off / One-shots
  {
    title: 'Blame Academy!',
    externalId: '47368', // AniList manga
    source: 'anilist',
    mediaType: 'manga',
    releaseDate: '2004-03-25',
    notes: 'Comedy/parody spin-off; compiled in Blame Academy! and So On (2008)',
  },
  {
    title: 'NSE: NetSphere Engineer',
    externalId: 'manual-manga-2004',
    source: 'manual',
    mediaType: 'manga',
    releaseDate: '2004-12-16',
    notes: 'One-shot sequel; compiled in Blame Academy! and So On (2008)',
  },
  {
    title: 'Blame!: The Ancient Terminal City',
    externalId: 'manual-short-2015',
    source: 'manual',
    mediaType: 'anime',
    releaseDate: '2015-05-01',
    notes: 'Short feature in Knights of Sidonia: Battle for Planet Nine Ep.8',
  },
  {
    title: 'Blame!2',
    externalId: '122846', // AniList one-shot
    source: 'anilist',
    mediaType: 'manga',
    releaseDate: '2008-03-21',
    notes: 'Full-color 16-page one-shot sequel; compiled in Blame Academy! and So On',
  },
  // Film era
  {
    title: "Blame! The Electrofishers' Escape",
    externalId: '99840',
    source: 'anilist',
    mediaType: 'manga',
    releaseDate: '2017-04-26',
    notes: 'Manga adaptation of the 2017 film by Kotaro Sekine',
  },
  {
    title: 'Blame!',
    externalId: '21498', // AniList movie
    source: 'anilist',
    mediaType: 'movie',
    releaseDate: '2017-05-19',
    notes: 'Full-length CG animated film by Polygon Pictures / Netflix',
  },
  {
    title: 'Blame! Fortress of Silicon Creatures',
    externalId: '122603',
    source: 'anilist',
    mediaType: 'manga',
    releaseDate: '2017-10-04',
    notes: '14-page one-shot epilogue; included with JP limited edition Blu-ray',
  },
];

async function createBlameUniverse() {
  console.log('Starting Blame! universe creation...');
  console.log(`Total items to process: ${BLAME_UNIVERSE_ITEMS.length}`);

  const ensuredItems: { mediaItemId: number; releaseDate: string | null; title: string }[] = [];

  for (const item of BLAME_UNIVERSE_ITEMS) {
    console.log(`\nProcessing: ${item.title} (${item.mediaType})`);
    
    const ensured = await ensureCanonicalMediaItem({
      externalId: item.externalId,
      source: item.source,
      mediaType: item.mediaType,
      title: item.title,
      releaseDate: item.releaseDate,
    });
    
    if (ensured) {
      ensuredItems.push({
        mediaItemId: ensured.mediaItem.id,
        releaseDate: ensured.mediaItem.releaseDate,
        title: item.title,
      });
      console.log(`  -> Media item ID: ${ensured.mediaItem.id}`);
    } else {
      console.log(`  -> FAILED to ensure media item`);
    }
  }

  if (ensuredItems.length === 0) {
    console.error('No items could be ensured. Aborting.');
    process.exit(1);
  }

  // Sort by release order (earliest first) - THIS IS THE KEY RULE
  const sortedItems = ensuredItems.sort((a, b) => {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return a.releaseDate.localeCompare(b.releaseDate);
  });

  console.log(`\n✅ Successfully ensured ${sortedItems.length} items`);
  console.log('\nRelease order:');
  sortedItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [${item.releaseDate || 'unknown'}] ${item.title} (ID: ${item.mediaItemId})`);
  });

  // Check if universe already exists
  const existingUniverse = await db.select()
    .from(collections)
    .where(eq(collections.slug, 'blame'))
    .limit(1);

  let universeId: number;

  if (existingUniverse.length > 0) {
    console.log(`\nFound existing universe: ${existingUniverse[0].name} (ID: ${existingUniverse[0].id})`);
    universeId = existingUniverse[0].id;
    
    // Update item count
    await db.update(collections)
      .set({ itemCount: sortedItems.length })
      .where(eq(collections.id, universeId));
    
    // Clear existing items to re-insert in correct release order
    await db.delete(collectionItems)
      .where(eq(collectionItems.collectionId, universeId));
    
    console.log('Cleared existing items for re-insertion.');
  } else {
    console.log('\nCreating new universe...');
    const [newUniverse] = await db.insert(collections).values({
      name: 'Blame!',
      slug: 'blame',
      description: 'Blame! is a Japanese science fiction franchise by Tsutomu Nihei. The saga spans a massive megastructure known as "The City," following Killy\'s quest to find the Net Terminal Gene and restore humanity\'s control over an out-of-control automated world.',
      coverImage: null,
      bannerImage: null,
      createdBy: 1,
      visibility: 'public',
      isFeatured: false,
      viewCount: 0,
      itemCount: sortedItems.length,
      followerCount: 0,
    }).returning();
    
    universeId = newUniverse.id;
    console.log(`Created universe: ${newUniverse.name} (ID: ${newUniverse.id})`);
  }

  console.log('\nAdding items to collection in release order...');
  await db.insert(collectionItems).values(
    sortedItems.map((item, index) => ({
      collectionId: universeId,
      mediaItemId: item.mediaItemId,
      releaseOrder: index + 1,
      chronologicalOrder: index + 1,
      isRequired: true,
      notes: BLAME_UNIVERSE_ITEMS.find(i => i.title === item.title)?.notes || null,
    }))
  );

  console.log(`\n✅ Added ${sortedItems.length} items in release order.`);
  console.log('\nDone!');
}

createBlameUniverse().catch(console.error);
