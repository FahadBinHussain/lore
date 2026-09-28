import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/index';
import { userEpisodeProgress, userMediaProgress, episodes, seasons } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { resolveTvShow, resolveTvSeason, resolveTvEpisode } from '@/lib/media/tv-episode-resolver';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; season_number: string; episode_number: string }> }
) {
  const { id: idParam, season_number: seasonNumberParam, episode_number: episodeNumberParam } = await params;
  const numericIdMatch = idParam.match(/(\d+)$/);
  const showId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(idParam);
  const seasonNumber = parseInt(seasonNumberParam);
  const episodeNumber = parseInt(episodeNumberParam);

  if (isNaN(showId) || isNaN(seasonNumber) || isNaN(episodeNumber)) {
    return NextResponse.json({ error: 'Invalid TV show, season, or episode ID' }, { status: 400 });
  }

  try {
    // Fetch episode details from TMDB
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch episode details');
    }

    const episode = await response.json();

    // Check watched status from database
    const session = await auth();
    let isWatched = false;

    if (session?.user?.id) {
      try {
        const userId = parseInt(session.user.id);

        // Resolve the canonical episode row by (show, season, episode number),
        // never by external_id string — see tv-episode-resolver.ts.
        const mediaItem = await resolveTvShow(showId);
        const season = await resolveTvSeason(mediaItem.id, showId, seasonNumber);
        const dbEpisode = await resolveTvEpisode(season.id, showId, seasonNumber, episodeNumber);

        const watchStatus = await db
          .select()
          .from(userEpisodeProgress)
          .where(and(
            eq(userEpisodeProgress.userId, userId),
            eq(userEpisodeProgress.episodeId, dbEpisode.id)
          ))
          .limit(1);

        isWatched = watchStatus.length > 0 && watchStatus[0].isWatched;
      } catch (dbError) {
        // If database tables don't exist yet, episode is not watched
        console.log('Database error when checking watched status:', dbError);
        console.log('Database not ready, assuming episode not watched');
        isWatched = false;
      }
    }

    const result = {
      id: episode.id,
      name: episode.name,
      overview: episode.overview,
      episode_number: episode.episode_number,
      season_number: episode.season_number,
      air_date: episode.air_date,
      runtime: episode.runtime,
      still_path: episode.still_path,
      vote_average: episode.vote_average,
      vote_count: episode.vote_count,
      guest_stars: episode.credits?.guest_stars || [],
      crew: episode.credits?.crew || [],
      is_watched: isWatched,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Episode detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch episode details' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; season_number: string; episode_number: string }> }
) {
  const { id: idParam, season_number: seasonNumberParam, episode_number: episodeNumberParam } = await params;
  const numericIdMatch = idParam.match(/(\d+)$/);
  const showId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(idParam);
  const seasonNumber = parseInt(seasonNumberParam);
  const episodeNumber = parseInt(episodeNumberParam);

  if (isNaN(showId) || isNaN(seasonNumber) || isNaN(episodeNumber)) {
    return NextResponse.json({ error: 'Invalid TV show, season, or episode ID' }, { status: 400 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { is_watched, watched_at } = body;

    try {
      const userId = parseInt(session.user.id);
      const watchedAtDate =
        typeof watched_at === 'string' && !Number.isNaN(Date.parse(watched_at))
          ? new Date(watched_at)
          : new Date();

      // Resolve the canonical episode row by (show, season, episode number).
      // Creating through the resolver keeps the enriched `tmdb-episode-*`
      // convention and can never spawn a duplicate season.
      const mediaItem = await resolveTvShow(showId);
      const season = await resolveTvSeason(mediaItem.id, showId, seasonNumber);
      const episode = await resolveTvEpisode(season.id, showId, seasonNumber, episodeNumber);
      const episodeId = episode.id;

      // Now update or create user progress
      const existingProgress = await db
        .select()
        .from(userEpisodeProgress)
        .where(and(
          eq(userEpisodeProgress.userId, userId),
          eq(userEpisodeProgress.episodeId, episodeId)
        ))
        .limit(1);

      if (existingProgress.length > 0) {
        // Update existing progress
        await db
          .update(userEpisodeProgress)
          .set({
            isWatched: is_watched,
            watchedAt: is_watched ? watchedAtDate : null,
            updatedAt: new Date(),
          })
          .where(eq(userEpisodeProgress.id, existingProgress[0].id));
      } else {
        // Create new progress record
        await db
          .insert(userEpisodeProgress)
          .values({
            userId: userId,
            episodeId: episodeId,
            isWatched: is_watched,
            watchedAt: is_watched ? watchedAtDate : null,
          });
      }

      // Recompute parent show status from DB episode progress (anime parity behavior)
      const watchedCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(userEpisodeProgress)
        .innerJoin(episodes, eq(userEpisodeProgress.episodeId, episodes.id))
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .where(and(
          eq(userEpisodeProgress.userId, userId),
          eq(userEpisodeProgress.isWatched, true),
          eq(seasons.mediaItemId, mediaItem.id)
        ));

      const totalCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .where(eq(seasons.mediaItemId, mediaItem.id));

      const watchedCount = Number(watchedCountResult[0]?.count || 0);
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const shouldBeCompleted = totalCount > 0 && watchedCount === totalCount;

      const existingMediaProgress = await db
        .select()
        .from(userMediaProgress)
        .where(and(
          eq(userMediaProgress.userId, userId),
          eq(userMediaProgress.mediaItemId, mediaItem.id)
        ))
        .limit(1);

      if (shouldBeCompleted) {
        if (existingMediaProgress.length > 0) {
          await db.update(userMediaProgress)
            .set({
              status: 'completed',
              currentProgress: watchedCount,
              completedAt: watchedAtDate,
              lastActivityAt: watchedAtDate,
              updatedAt: new Date(),
            })
            .where(eq(userMediaProgress.id, existingMediaProgress[0].id));
        } else {
          await db.insert(userMediaProgress).values({
            userId,
            mediaItemId: mediaItem.id,
            status: 'completed',
            currentProgress: watchedCount,
            completedAt: watchedAtDate,
            lastActivityAt: watchedAtDate,
          });
        }
      } else if (watchedCount > 0) {
        if (existingMediaProgress.length > 0) {
          await db.update(userMediaProgress)
            .set({
              status: 'in_progress',
              currentProgress: watchedCount,
              completedAt: null,
              lastActivityAt: watchedAtDate,
              updatedAt: new Date(),
            })
            .where(eq(userMediaProgress.id, existingMediaProgress[0].id));
        } else {
          await db.insert(userMediaProgress).values({
            userId,
            mediaItemId: mediaItem.id,
            status: 'in_progress',
            currentProgress: watchedCount,
            lastActivityAt: watchedAtDate,
          });
        }
      } else if (existingMediaProgress.length > 0) {
        await db.delete(userMediaProgress)
          .where(eq(userMediaProgress.id, existingMediaProgress[0].id));
      }

      return NextResponse.json({ success: true, is_watched });
    } catch (dbError) {
      // If database tables don't exist yet, just return success without saving
      console.log('Database error when updating watch status:', dbError);
      console.log('Database not ready, watch status not persisted');
      return NextResponse.json({ success: true, is_watched, note: 'Database not ready - status not persisted' });
    }
  } catch (error) {
    console.error('Episode watch status update error:', error);
    return NextResponse.json({ error: 'Failed to update watch status' }, { status: 500 });
  }
}
