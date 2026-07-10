import { db } from '../src/db';
import { collections, collectionItems } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { eq } from 'drizzle-orm';

/**
 * Angry Birds Universe — All Official Media Items
 * Research: Wikipedia + TMDB/AniList searches
 * Ordered by release order (earliest first)
 * RULE: include EVERYTHING official. no pruning based on size.
 */

interface UniverseItem {
  title: string;
  externalId: string;
  source: 'tmdb' | 'anilist' | 'igdb' | 'manual';
  mediaType: 'movie' | 'tv' | 'game';
  releaseDate: string;
  notes?: string;
}

const ANGRY_BIRDS_UNIVERSE_ITEMS: UniverseItem[] = [
  // === VIDEO GAMES ===
  {
    title: 'Angry Birds',
    externalId: 'manual-game-2009',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2009-12-11',
    notes: 'Original mobile puzzle game by Rovio Entertainment',
  },
  {
    title: 'Angry Birds Seasons',
    externalId: 'manual-game-2010',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2010-10-21',
    notes: 'First sequel with holiday-themed levels',
  },
  {
    title: 'Angry Birds Rio',
    externalId: 'manual-game-2011',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2011-03-22',
    notes: 'Crossover tie-in with Rio film',
  },
  {
    title: 'Angry Birds Facebook / Friends',
    externalId: 'manual-game-2012-friends',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2012-02-13',
    notes: 'Social multiplayer version',
  },
  {
    title: 'Angry Birds Space',
    externalId: 'manual-game-2012-space',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2012-03-22',
    notes: 'Space-themed with gravity mechanics',
  },
  {
    title: 'Angry Birds Trilogy',
    externalId: 'manual-game-2012-trilogy',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2012-09-25',
    notes: 'Console compilation of original + Seasons + Rio',
  },
  {
    title: 'Bad Piggies',
    externalId: 'manual-game-2012-piggies',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2012-09-27',
    notes: 'Spin-off starring the pigs as playable characters',
  },
  {
    title: 'Angry Birds Star Wars',
    externalId: 'manual-game-2012-sw',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2012-11-08',
    notes: 'Crossover with Star Wars franchise',
  },
  {
    title: 'Angry Birds Star Wars II',
    externalId: 'manual-game-2013-sw2',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2013-09-18',
    notes: 'Sequel with prequel trilogy characters',
  },
  {
    title: 'Angry Birds Go!',
    externalId: 'manual-game-2013-go',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2013-12-11',
    notes: 'Kart racing spin-off',
  },
  {
    title: 'Angry Birds Epic',
    externalId: 'manual-game-2014-epic',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2014-06-12',
    notes: 'Turn-based RPG',
  },
  {
    title: 'Angry Birds Stella',
    externalId: 'manual-game-2014-stella',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2014-09-04',
    notes: 'Female-led spin-off game',
  },
  {
    title: 'Angry Birds Transformers',
    externalId: 'manual-game-2014-tf',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2014-10-15',
    notes: 'Crossover with Transformers franchise',
  },
  {
    title: 'Angry Birds POP!',
    externalId: 'manual-game-2015-pop',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2015-03-12',
    notes: 'Bubble shooter spin-off',
  },
  {
    title: 'Angry Birds Fight!',
    externalId: 'manual-game-2015-fight',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2015-06-11',
    notes: 'Match-3 RPG (Japan-first)',
  },
  {
    title: 'Angry Birds 2',
    externalId: 'manual-game-2015-ab2',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2015-07-30',
    notes: 'Direct sequel to original with card system',
  },
  {
    title: 'Angry Birds Action!',
    externalId: 'manual-game-2016-action',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2016-04-28',
    notes: 'Movie tie-in with AR pinball gameplay',
  },
  {
    title: 'Angry Birds Blast!',
    externalId: 'manual-game-2016-blast',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2016-12-15',
    notes: 'Match-3 puzzle game',
  },
  {
    title: 'Angry Birds Evolution',
    externalId: 'manual-game-2017-evo',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2017-06-15',
    notes: '3D RPG with turn-based combat',
  },
  {
    title: 'Angry Birds Match',
    externalId: 'manual-game-2017-match',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2017-11-13',
    notes: 'Match-3 with hatchlings',
  },
  {
    title: 'Angry Birds Dream Blast',
    externalId: 'manual-game-2018-dream',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2018-11-12',
    notes: 'Bubble puzzle with dream theme',
  },
  {
    title: 'Angry Birds VR: Isle of Pigs',
    externalId: 'manual-game-2019-vr',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2019-02-07',
    notes: 'VR puzzle game',
  },
  {
    title: 'The Angry Birds Movie 2 VR: Under Pressure',
    externalId: 'manual-game-2019-vr2',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2019-08-06',
    notes: 'Movie tie-in VR game',
  },
  {
    title: 'Angry Birds Reloaded',
    externalId: 'manual-game-2021-reloaded',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2021-07-15',
    notes: 'Apple Arcade exclusive remake',
  },
  {
    title: 'Angry Birds Journey',
    externalId: 'manual-game-2022-journey',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2022-01-20',
    notes: 'Casual slingshot puzzle',
  },
  {
    title: 'Rovio Classics: Angry Birds',
    externalId: 'manual-game-2022-classics',
    source: 'manual',
    mediaType: 'game',
    releaseDate: '2022-03-31',
    notes: 'Unity remake of original game',
  },

  // === TV SERIES (TMDB-backed) ===
  {
    title: 'Angry Birds Toons',
    externalId: '46848',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2013-03-16',
    notes: 'Animated series, 3 seasons (2013–2016)',
  },
  {
    title: 'Piggy Tales',
    externalId: '67862',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2014-04-17',
    notes: 'Stop-motion claymation series, 4 seasons (2014–2019)',
  },
  {
    title: 'Angry Birds Stella (TV)',
    externalId: '69353',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2014-11-01',
    notes: 'Animated series about Stella, 2 seasons (2014–2016)',
  },
  {
    title: 'Angry Birds Blues',
    externalId: '70933',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2017-03-10',
    notes: 'Short series about the Blues and Hatchlings',
  },
  {
    title: 'Angry Birds BirLd Cup',
    externalId: 'manual-tv-2018-birld',
    source: 'manual',
    mediaType: 'tv',
    releaseDate: '2018-06-09',
    notes: 'YouTube soccer-themed series — not found on TMDB',
  },
  {
    title: 'Angry Birds Zero Gravity',
    externalId: '291696',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2018-10-03',
    notes: 'YouTube short series in zero gravity',
  },
  {
    title: 'Angry Birds on the Run',
    externalId: '219440',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2018-11-17',
    notes: 'YouTube live-action/animation hybrid, 2 seasons',
  },
  {
    title: 'Angry Birds MakerSpace',
    externalId: '204247',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2019-06-01',
    notes: 'YouTube series about birds and pigs in shared workspace',
  },
  {
    title: 'Angry Birds Slingshot Stories',
    externalId: '139480',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2020-01-18',
    notes: 'YouTube ongoing series about behind-the-scenes of levels',
  },
  {
    title: 'Angry Birds Bubble Trouble',
    externalId: '120126',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2020-12-05',
    notes: 'YouTube series with Dream Blast designs',
  },
  {
    title: 'Angry Birds: Summer Madness',
    externalId: '154647',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2022-01-28',
    notes: 'Netflix series, 3 seasons. Teen birds at summer camp',
  },
  {
    title: 'Angry Birds Mystery Island',
    externalId: '228103',
    source: 'tmdb',
    mediaType: 'tv',
    releaseDate: '2024-05-21',
    notes: 'Amazon Prime series about Hatchlings on uncharted island',
  },
  {
    title: 'Angry Birds Slingshot Space Stories',
    externalId: 'manual-tv-2025-space',
    source: 'manual',
    mediaType: 'tv',
    releaseDate: '2025-10-15',
    notes: 'YouTube space-themed short series — not found on TMDB',
  },

  // === MOVIES ===
  {
    title: 'The Angry Birds Movie',
    externalId: '153518',
    source: 'tmdb',
    mediaType: 'movie',
    releaseDate: '2016-05-20',
    notes: 'Theatrical film by Sony Pictures, directed by Clay Kaytis and Fergal Reilly',
  },
  {
    title: 'The Angry Birds Movie 2',
    externalId: '454626',
    source: 'tmdb',
    mediaType: 'movie',
    releaseDate: '2019-08-14',
    notes: 'Sequel co-produced by Sony Pictures Animation',
  },
  {
    title: 'The Angry Birds Movie 3',
    externalId: 'manual-movie-2026',
    source: 'manual',
    mediaType: 'movie',
    releaseDate: '2026-12-23',
    notes: 'Upcoming sequel produced by Sega/DNEG Animation, Paramount distribution',
  },
];

async function createAngryBirdsUniverse() {
  console.log('Starting Angry Birds universe creation...');
  console.log(`Total items to process: ${ANGRY_BIRDS_UNIVERSE_ITEMS.length}`);

  const ensuredItems: { mediaItemId: number; releaseDate: string | null; title: string }[] = [];

  for (const item of ANGRY_BIRDS_UNIVERSE_ITEMS) {
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

  // Sort by release order (earliest first)
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
    .where(eq(collections.slug, 'angry-birds'))
    .limit(1);

  let universeId: number;

  if (existingUniverse.length > 0) {
    console.log(`\nFound existing universe: ${existingUniverse[0].name} (ID: ${existingUniverse[0].id})`);
    universeId = existingUniverse[0].id;
    
    await db.update(collections)
      .set({ itemCount: sortedItems.length })
      .where(eq(collections.id, universeId));
    
    await db.delete(collectionItems)
      .where(eq(collectionItems.collectionId, universeId));
    
    console.log('Cleared existing items for re-insertion.');
  } else {
    console.log('\nCreating new universe...');
    const [newUniverse] = await db.insert(collections).values({
      name: 'Angry Birds',
      slug: 'angry-birds',
      description: 'Angry Birds is a video game series and media franchise created by Finnish game designer Jaakko Iisalo and owned by Rovio Entertainment. The franchise follows a flock of anthropomorphic flightless birds defending their eggs from green pigs, spanning games, films, TV series, and merchandise.',
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
      notes: ANGRY_BIRDS_UNIVERSE_ITEMS.find(i => i.title === item.title)?.notes || null,
    }))
  );

  console.log(`\n✅ Added ${sortedItems.length} items in release order.`);
  console.log('\nDone!');
}

createAngryBirdsUniverse().catch(console.error);
