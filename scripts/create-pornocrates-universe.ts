import { db } from '../src/db';
import { collections, collectionItems } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { eq } from 'drizzle-orm';

/**
 * Pornocrates Universe — All Official Media Items
 * Research: C:\Users\Admin\Downloads\lore\research\pornocrates-franchise.md
 * Ordered by release order (earliest first)
 * RULE: include EVERYTHING official. no pruning based on size.
 */

interface UniverseItem {
  title: string;
  externalId: string;
  source: 'igdb' | 'manual';
  mediaType: 'game';
  releaseDate: string;
  notes?: string;
}

const PORNOCRATES_UNIVERSE_ITEMS: UniverseItem[] = [
  {
    title: 'Pornocrates',
    externalId: 'igdb-158065', // IGDB base game
    source: 'igdb',
    mediaType: 'game',
    releaseDate: '2021-06-03',
    notes: 'Original mainline game and foundation of the franchise.',
  },
  {
    title: "Pornocrates: Osiris's Seed",
    externalId: 'curated-game-2022-pornocrates-osiris-seed', // manual — absent from IGDB and VNDB
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2022-03-26',
    notes: 'Standalone franchise game expanding the universe to ancient Egypt via her simulator.',
  },
  {
    title: 'Pornocrates: VHS',
    externalId: 'curated-game-2022-pornocrates-vhs', // manual — absent from IGDB and VNDB
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2022-04-09',
    notes: 'Standalone franchise game set in 1986, where Pleasure Lady P*ssy is believed to be an incarnation of Pornocrates.',
  },
  {
    title: "Pornocrates' Feast",
    externalId: 'curated-game-2024-pornocrates-feast', // manual — absent from IGDB and VNDB
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2024-03-17',
    notes: 'Official DLC for Pornocrates adding a new level, puzzles, and a visual-novel-style interaction layer.',
  },
];

async function createPornocratesUniverse() {
  console.log('Starting Pornocrates universe creation...');
  console.log(`Total items to process: ${PORNOCRATES_UNIVERSE_ITEMS.length}`);

  const ensuredItems: { mediaItemId: number; releaseDate: string | null; title: string }[] = [];

  for (const item of PORNOCRATES_UNIVERSE_ITEMS) {
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
    .where(eq(collections.slug, 'pornocrates'))
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
      name: 'Pornocrates',
      slug: 'pornocrates',
      description: 'Pornocrates is an interactive erotic art game by "by Cassandra" and published by Orgipix Studios. Inspired by Félicien Rops\' painting of the same name, it blends social critique, stylized sensuality, and allegory, and has since expanded into standalone spin-offs and a substantial DLC.',
      coverImage: null,
      bannerImage: null,
      createdBy: 1,
      visibility: 'private',
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
      notes: PORNOCRATES_UNIVERSE_ITEMS.find(i => i.title === item.title)?.notes || null,
    }))
  );

  console.log(`\n✅ Added ${sortedItems.length} items in release order.`);
  console.log('\nDone!');
}

createPornocratesUniverse().catch(console.error);
