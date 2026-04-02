import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/index';
import { userEpisodeProgress, episodes, seasons, mediaItems, userMediaProgress } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

        // Try to find the episode in our database
        const dbEpisode = await db
          .select()
          .from(episodes)
          .where(and(
            eq(episodes.externalId, `${showId}-${seasonNumber}-${episodeNumber}`),
            eq(episodes.source, 'tmdb')
          ))
          .limit(1);

        if (dbEpisode.length > 0) {
          // Check if user has watched this episode
          const watchStatus = await db
            .select()
            .from(userEpisodeProgress)
            .where(and(
              eq(userEpisodeProgress.userId, userId),
              eq(userEpisodeProgress.episodeId, dbEpisode[0].id)
            ))
            .limit(1);

          isWatched = watchStatus.length > 0 && watchStatus[0].isWatched;
        }
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
  console.log('POST episode route called with params:', await params);
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

      // First, try to find the episode in our database
      let dbEpisode = await db
        .select()
        .from(episodes)
        .where(and(
          eq(episodes.externalId, `${showId}-${seasonNumber}-${episodeNumber}`),
          eq(episodes.source, 'tmdb')
        ))
        .limit(1);

      let episodeId: number;

      if (dbEpisode.length === 0) {
        // Episode doesn't exist, create it
        // First, we need to ensure the season exists
        let seasonRecord = await db
          .select()
          .from(seasons)
          .where(and(
            eq(seasons.externalId, `${showId}-${seasonNumber}`),
            eq(seasons.source, 'tmdb')
          ))
          .limit(1);

        if (seasonRecord.length === 0) {
          // Season doesn't exist, create it
          // We need to get the media item ID
          let mediaItem = await db
            .select()
            .from(mediaItems)
            .where(and(
              eq(mediaItems.externalId, showId.toString()),
              eq(mediaItems.source, 'tmdb')
            ))
            .limit(1);

          if (mediaItem.length === 0) {
            // Fetch show details from TMDB
            const showResponse = await fetch(
              `https://api.themoviedb.org/3/tv/${showId}?api_key=${process.env.TMDB_API_KEY}`
            );

            let showData = null;
            if (showResponse.ok) {
              showData = await showResponse.json();
              console.log('Fetched show data for', showId, showData?.name);
            } else {
              console.log('Failed to fetch show data for', showId, 'status:', showResponse.status);
            }

            // Create the media item
            const newMediaItem = await db
              .insert(mediaItems)
              .values([{
                externalId: showId.toString(),
                source: 'tmdb',
                mediaType: 'tv',
                title: showData?.name || showData?.title || `TV Show ${showId}`,
                description: showData?.overview || null,
                posterPath: showData?.poster_path || null,
                backdropPath: showData?.backdrop_path || null,
                releaseDate: showData?.first_air_date || null,
                rating: showData?.vote_average || null,
                voteCount: showData?.vote_count || 0,
                genres: Array.isArray(showData?.genres)
                  ? showData.genres.map((genre: { name?: string }) => genre?.name).filter(Boolean)
                  : null,
                runtime: null,
                pageCount: null,
                developer: null,
                publisher: null,
                author: null,
                isbn: null,
                platforms: null,
                networks: Array.isArray(showData?.networks)
                  ? showData.networks.map((network: { name?: string }) => network?.name).filter(Boolean)
                  : null,
                seasons: showData?.number_of_seasons || null,
                totalEpisodes: showData?.number_of_episodes || null,
                status: showData?.status || null,
                isPlaceholder: !showData,
                tagline: showData?.tagline || null,
                popularity: showData?.popularity || null,
                additionalData: null,
              }])
              .returning();

            mediaItem = newMediaItem;
          } else if (mediaItem[0].isPlaceholder) {
            // Update placeholder media item with real data
            const showResponse = await fetch(
              `https://api.themoviedb.org/3/tv/${showId}?api_key=${process.env.TMDB_API_KEY}`
            );

            let showData = null;
            if (showResponse.ok) {
              showData = await showResponse.json();
              console.log('Fetched show data for existing placeholder', showId, showData?.name);
            } else {
              console.log('Failed to fetch show data for existing placeholder', showId, 'status:', showResponse.status);
            }

            if (showData) {
              await db
                .update(mediaItems)
                .set({
                  title: showData.name || showData.title || mediaItem[0].title,
                  description: showData.overview || mediaItem[0].description,
                  posterPath: showData.poster_path || mediaItem[0].posterPath,
                  backdropPath: showData.backdrop_path || mediaItem[0].backdropPath,
                  releaseDate: showData.first_air_date || mediaItem[0].releaseDate,
                  rating: showData.vote_average || mediaItem[0].rating,
                  voteCount: showData.vote_count || mediaItem[0].voteCount,
                  genres: Array.isArray(showData.genres)
                    ? showData.genres.map((genre: { name?: string }) => genre?.name).filter(Boolean)
                    : mediaItem[0].genres,
                  networks: Array.isArray(showData.networks)
                    ? showData.networks.map((network: { name?: string }) => network?.name).filter(Boolean)
                    : mediaItem[0].networks,
                  seasons: showData.number_of_seasons || mediaItem[0].seasons,
                  totalEpisodes: showData.number_of_episodes || mediaItem[0].totalEpisodes,
                  status: showData.status || mediaItem[0].status,
                  isPlaceholder: false,
                  tagline: showData.tagline || mediaItem[0].tagline,
                  popularity: showData.popularity || mediaItem[0].popularity,
                })
                .where(eq(mediaItems.id, mediaItem[0].id));

              // Update the mediaItem in memory
              mediaItem[0] = { ...mediaItem[0], ...showData, isPlaceholder: false };
            }
          }

          // Create season
          const newSeason = await db
            .insert(seasons)
            .values({
              mediaItemId: mediaItem[0].id,
              externalId: `${showId}-${seasonNumber}`,
              source: 'tmdb',
              seasonNumber: seasonNumber,
              name: `Season ${seasonNumber}`,
              episodeCount: 0, // We'll update this later
            })
            .returning();

          seasonRecord = newSeason;
        }

        // Create episode
        const newEpisode = await db
          .insert(episodes)
          .values({
            seasonId: seasonRecord[0].id,
            externalId: `${showId}-${seasonNumber}-${episodeNumber}`,
            source: 'tmdb',
            episodeNumber: episodeNumber,
            name: `Episode ${episodeNumber}`,
            overview: null,
          })
          .returning();

        episodeId = newEpisode[0].id;
      } else {
        episodeId = dbEpisode[0].id;
      }

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
      const mediaItem = await db
        .select()
        .from(mediaItems)
        .where(and(
          eq(mediaItems.externalId, showId.toString()),
          eq(mediaItems.source, 'tmdb'),
          eq(mediaItems.mediaType, 'tv')
        ))
        .limit(1);

      if (mediaItem.length > 0) {
        const mediaItemId = mediaItem[0].id;

        const watchedCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(userEpisodeProgress)
          .innerJoin(episodes, eq(userEpisodeProgress.episodeId, episodes.id))
          .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
          .where(and(
            eq(userEpisodeProgress.userId, userId),
            eq(userEpisodeProgress.isWatched, true),
            eq(seasons.mediaItemId, mediaItemId)
          ));

        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(episodes)
          .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
          .where(eq(seasons.mediaItemId, mediaItemId));

        const watchedCount = Number(watchedCountResult[0]?.count || 0);
        const totalCount = Number(totalCountResult[0]?.count || 0);
        const shouldBeCompleted = totalCount > 0 && watchedCount === totalCount;

        const existingMediaProgress = await db
          .select()
          .from(userMediaProgress)
          .where(and(
            eq(userMediaProgress.userId, userId),
            eq(userMediaProgress.mediaItemId, mediaItemId)
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
              mediaItemId,
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
              mediaItemId,
              status: 'in_progress',
              currentProgress: watchedCount,
              lastActivityAt: watchedAtDate,
            });
          }
        } else if (existingMediaProgress.length > 0) {
          await db.delete(userMediaProgress)
            .where(eq(userMediaProgress.id, existingMediaProgress[0].id));
        }
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
