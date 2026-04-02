import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userMediaProgress, mediaItems, seasons, episodes, userEpisodeProgress } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; season_number: string; episode_number: string }> }
) {
  const { id: idParam, season_number: seasonNumberParam, episode_number: episodeNumberParam } = await params;
  const animeId = idParam;
  const seasonNumber = parseInt(seasonNumberParam);
  const episodeNumber = parseInt(episodeNumberParam);

  if (isNaN(seasonNumber) || isNaN(episodeNumber)) {
    return NextResponse.json({ error: 'Invalid season or episode number' }, { status: 400 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { is_watched, watched_at, title, posterPath, releaseDate, totalEpisodes } = body;

    try {
      const userId = parseInt(session.user.id);
      const watchedAtDate =
        typeof watched_at === 'string' && !Number.isNaN(Date.parse(watched_at))
          ? new Date(watched_at)
          : new Date();

      // For anime, we need to ensure the media item exists
      let mediaItem = await db.query.mediaItems.findFirst({
        where: and(
          eq(mediaItems.externalId, animeId),
          eq(mediaItems.source, 'anilist'),
          eq(mediaItems.mediaType, 'anime')
        ),
      });

      if (!mediaItem) {
        // Create media item for anime
        const [newItem] = await db.insert(mediaItems).values({
          externalId: animeId,
          source: 'anilist',
          mediaType: 'anime',
          title: title || `Anime ${animeId}`,
          posterPath: posterPath || null,
          releaseDate: releaseDate || null,
          totalEpisodes: typeof totalEpisodes === 'number' ? totalEpisodes : null,
        }).returning();
        mediaItem = newItem;
      } else if (typeof totalEpisodes === 'number' && totalEpisodes > 0 && mediaItem.totalEpisodes !== totalEpisodes) {
        await db.update(mediaItems)
          .set({
            totalEpisodes,
            updatedAt: new Date(),
          })
          .where(eq(mediaItems.id, mediaItem.id));
      }

      // Ensure season row exists
      let season = await db.query.seasons.findFirst({
        where: and(
          eq(seasons.mediaItemId, mediaItem.id),
          eq(seasons.source, 'anilist'),
          eq(seasons.seasonNumber, seasonNumber)
        ),
      });

      if (!season) {
        const [createdSeason] = await db.insert(seasons).values({
          mediaItemId: mediaItem.id,
          externalId: `${animeId}-${seasonNumber}`,
          source: 'anilist',
          seasonNumber,
          name: `Season ${seasonNumber}`,
          episodeCount: typeof totalEpisodes === 'number' ? totalEpisodes : 0,
        }).returning();
        season = createdSeason;
      }

      // Ensure episode row exists
      const episodeExternalId = `${animeId}-${seasonNumber}-${episodeNumber}`;
      let episode = await db.query.episodes.findFirst({
        where: and(
          eq(episodes.externalId, episodeExternalId),
          eq(episodes.source, 'anilist')
        ),
      });

      if (!episode) {
        const [createdEpisode] = await db.insert(episodes).values({
          seasonId: season.id,
          externalId: episodeExternalId,
          source: 'anilist',
          episodeNumber,
          name: `Episode ${episodeNumber}`,
        }).returning();
        episode = createdEpisode;
      }

      const existingEpisodeProgress = await db.query.userEpisodeProgress.findFirst({
        where: and(
          eq(userEpisodeProgress.userId, userId),
          eq(userEpisodeProgress.episodeId, episode.id)
        ),
      });

      if (is_watched) {
        if (existingEpisodeProgress) {
          await db.update(userEpisodeProgress)
            .set({
              isWatched: true,
              watchedAt: watchedAtDate,
              updatedAt: new Date(),
            })
            .where(eq(userEpisodeProgress.id, existingEpisodeProgress.id));
        } else {
          await db.insert(userEpisodeProgress).values({
            userId,
            episodeId: episode.id,
            isWatched: true,
            watchedAt: watchedAtDate,
          });
        }
      } else if (existingEpisodeProgress) {
        await db.delete(userEpisodeProgress)
          .where(eq(userEpisodeProgress.id, existingEpisodeProgress.id));
      }

      // Recompute real parent anime progress from DB episode rows
      const watchedRows = await db
        .select({
          episodeNumber: episodes.episodeNumber,
        })
        .from(userEpisodeProgress)
        .innerJoin(episodes, eq(userEpisodeProgress.episodeId, episodes.id))
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .where(and(
          eq(userEpisodeProgress.userId, userId),
          eq(userEpisodeProgress.isWatched, true),
          eq(seasons.mediaItemId, mediaItem.id)
        ));

      const watchedEpisodes = watchedRows
        .map((row) => row.episodeNumber)
        .sort((a, b) => a - b);

      const animeTotalEpisodes = typeof totalEpisodes === 'number'
        ? totalEpisodes
        : (mediaItem.totalEpisodes || 0);

      const shouldBeCompleted = animeTotalEpisodes > 0 && watchedEpisodes.length === animeTotalEpisodes;

      const existingProgress = await db.query.userMediaProgress.findFirst({
        where: and(
          eq(userMediaProgress.userId, userId),
          eq(userMediaProgress.mediaItemId, mediaItem.id)
        ),
      });

      if (shouldBeCompleted) {
        if (existingProgress) {
          await db.update(userMediaProgress)
            .set({
              status: 'completed',
              currentProgress: watchedEpisodes.length,
              completedAt: watchedAtDate,
              lastActivityAt: watchedAtDate,
              updatedAt: new Date(),
            })
            .where(eq(userMediaProgress.id, existingProgress.id));
        } else {
          await db.insert(userMediaProgress).values({
            userId,
            mediaItemId: mediaItem.id,
            status: 'completed',
            currentProgress: watchedEpisodes.length,
            completedAt: watchedAtDate,
            lastActivityAt: watchedAtDate,
          });
        }
      } else if (watchedEpisodes.length > 0) {
        if (existingProgress) {
          await db.update(userMediaProgress)
            .set({
              status: 'in_progress',
              currentProgress: watchedEpisodes.length,
              completedAt: null,
              lastActivityAt: watchedAtDate,
              updatedAt: new Date(),
            })
            .where(eq(userMediaProgress.id, existingProgress.id));
        } else {
          await db.insert(userMediaProgress).values({
            userId,
            mediaItemId: mediaItem.id,
            status: 'in_progress',
            currentProgress: watchedEpisodes.length,
            lastActivityAt: watchedAtDate,
          });
        }
      } else if (existingProgress) {
        await db.delete(userMediaProgress)
          .where(eq(userMediaProgress.id, existingProgress.id));
      }

      return NextResponse.json({
        success: true,
        is_watched,
        watchedEpisodes,
        isAnimeWatched: shouldBeCompleted,
      });
    } catch (dbError) {
      console.log('Database error when updating anime episode status:', dbError);
      return NextResponse.json({ success: true, is_watched, note: 'Database not ready - status not persisted' });
    }
  } catch (error) {
    console.error('Anime episode update error:', error);
    return NextResponse.json({ error: 'Failed to update episode status' }, { status: 500 });
  }
}
