import { db } from '../src/db/index';
import { userMediaProgress, users } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { eq, and } from 'drizzle-orm';

interface MovieToAdd {
  tmdbId: string;
  title: string;
  releaseDate: string;
  posterPath: string;
  backdropPath?: string | null;
  overview?: string | null;
}

const MOVIES: MovieToAdd[] = [
  // 1. Satan's Slaves
  {
    tmdbId: '467012',
    title: "Satan's Slaves",
    releaseDate: '2017-09-28',
    posterPath: '/k16xOaI9x5fqepxVwBwUJAozsW8.jpg',
  },
  // 2. The Dark and the Wicked
  {
    tmdbId: '680593',
    title: 'The Dark and the Wicked',
    releaseDate: '2020-04-16',
    posterPath: '/4DB9VFVTp0IQEWFEIf9f3f2z3t5.jpg',
  },
  // 3. Oddity
  {
    tmdbId: '1216191',
    title: 'Oddity',
    releaseDate: '2024-07-19',
    posterPath: '/3Z9c1tbUhP0QruRjczPHnbx3U2D.jpg',
  },
  // 4. Hell House LLC
  {
    tmdbId: '359246',
    title: 'Hell House LLC',
    releaseDate: '2015-10-16',
    posterPath: '/xUSCQEbbAy3Lv6r00RfXtdxhRDX.jpg',
  },
];

async function main() {
  const targetUser =
    (process.env.CREATOR_EMAIL
      ? await db.query.users.findFirst({ where: eq(users.email, process.env.CREATOR_EMAIL) })
      : null) ||
    (await db.query.users.findFirst({ where: eq(users.id, 1) })) ||
    (await db.query.users.findFirst());

  if (!targetUser) {
    console.error('No user found in database!');
    process.exit(1);
  }

  console.log(`Adding ${MOVIES.length} movies to Watch Later for user ID ${targetUser.id} (${targetUser.name})...\n`);

  for (const m of MOVIES) {
    // 1. Ensure canonical media item
    const canonical = await ensureCanonicalMediaItem({
      externalId: m.tmdbId,
      mediaType: 'movie',
      title: m.title,
      source: 'tmdb',
      releaseDate: m.releaseDate,
      posterPath: m.posterPath,
    });

    if (!canonical) {
      console.error(`!! Failed to ensure canonical media item for "${m.title}"`);
      continue;
    }

    const mediaItemId = canonical.mediaItem.id;

    // 2. Check existing user media progress
    const existing = await db.query.userMediaProgress.findFirst({
      where: and(
        eq(userMediaProgress.userId, targetUser.id),
        eq(userMediaProgress.mediaItemId, mediaItemId)
      ),
    });

    if (existing) {
      await db
        .update(userMediaProgress)
        .set({
          status: 'plan_to_watch',
          currentProgress: 0,
          progressPercentage: '0',
          completedAt: null,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userMediaProgress.id, existing.id));

      console.log(`✓ Updated to Watch Later: "${m.title}" (mediaItem: ${mediaItemId}, prev status: ${existing.status})`);
    } else {
      const [inserted] = await db
        .insert(userMediaProgress)
        .values({
          userId: targetUser.id,
          mediaItemId,
          status: 'plan_to_watch',
          currentProgress: 0,
          progressPercentage: '0',
          lastActivityAt: new Date(),
        })
        .returning({ id: userMediaProgress.id });

      console.log(`✓ Added to Watch Later: "${m.title}" (mediaItem: ${mediaItemId}, progressId: ${inserted.id})`);
    }
  }

  console.log(`\nAll ${MOVIES.length} movies successfully added to Watch Later!`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
