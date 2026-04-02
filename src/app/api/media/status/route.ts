import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userMediaProgress, mediaItems, userEpisodeProgress, episodes, seasons } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');
  const mediaType = searchParams.get('mediaType');
  const seasonNumberParam = searchParams.get('seasonNumber');
  const episodeNumberParam = searchParams.get('episodeNumber');

  if (!mediaId || !mediaType) {
    return NextResponse.json({ error: 'mediaId and mediaType required' }, { status: 400 });
  }

  try {
    const userId = parseInt(session.user.id);
    console.log('GET status request:', { mediaId, mediaType, userId, userIdType: typeof session.user.id });

    const preferredSource = mediaType === 'anime' ? 'anilist' : 'tmdb';

    // Find the media item with preferred source first
    let mediaItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(mediaItems.externalId, mediaId),
        eq(mediaItems.source, preferredSource),
        eq(mediaItems.mediaType, mediaType as any)
      ),
    });

    // Fallback: only for non-anime media types
    if (!mediaItem && mediaType !== 'anime') {
      console.log('Media item not found with preferred source, trying any source for this media type...');
      mediaItem = await db.query.mediaItems.findFirst({
        where: and(
          eq(mediaItems.externalId, mediaId),
          eq(mediaItems.mediaType, mediaType as any)
        ),
      });
      if (mediaItem) {
        console.log('Found media item with different source:', { mediaItem, expectedSource: preferredSource });
      }
    }

    if (!mediaItem && mediaType === 'anime') {
      console.log('Anime media item not found in anilist source; no cross-source fallback allowed.');
    }

    console.log('Media item query result:', { mediaId, mediaType, found: !!mediaItem, mediaItem });

    let isWatchedResult = false;
    let watchedEpisodesResult: number[] = [];
    const requestedSeasonNumber = seasonNumberParam ? parseInt(seasonNumberParam, 10) : null;
    const requestedEpisodeNumber = episodeNumberParam ? parseInt(episodeNumberParam, 10) : null;

    if (mediaItem) {
      if (
        (mediaType === 'tv' || mediaType === 'anime') &&
        requestedSeasonNumber !== null &&
        requestedEpisodeNumber !== null &&
        !Number.isNaN(requestedSeasonNumber) &&
        !Number.isNaN(requestedEpisodeNumber)
      ) {
        const episodeSource = mediaType === 'anime' ? 'anilist' : 'tmdb';
        const episodeProgress = await db
          .select({ id: userEpisodeProgress.id })
          .from(userEpisodeProgress)
          .innerJoin(episodes, eq(userEpisodeProgress.episodeId, episodes.id))
          .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
          .where(and(
            eq(userEpisodeProgress.userId, userId),
            eq(userEpisodeProgress.isWatched, true),
            eq(seasons.mediaItemId, mediaItem.id),
            eq(seasons.seasonNumber, requestedSeasonNumber),
            eq(episodes.episodeNumber, requestedEpisodeNumber),
            eq(episodes.source, episodeSource)
          ))
          .limit(1);

        isWatchedResult = episodeProgress.length > 0;
        console.log('GET episode status result:', {
          mediaId,
          mediaType,
          mediaItemId: mediaItem.id,
          seasonNumber: requestedSeasonNumber,
          episodeNumber: requestedEpisodeNumber,
          isWatched: isWatchedResult,
        });

        return NextResponse.json({
          isWatched: isWatchedResult,
          watchedEpisodes: [],
        }, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }

      // Check user's progress
      const progress = await db.query.userMediaProgress.findFirst({
        where: and(
          eq(userMediaProgress.userId, userId),
          eq(userMediaProgress.mediaItemId, mediaItem.id)
        ),
      });

      console.log('Progress query result:', { userId, mediaItemId: mediaItem.id, found: !!progress, progress });

      isWatchedResult = progress?.status === 'completed';

      if (mediaType === 'anime') {
        const watchedEpisodes = await db
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

        watchedEpisodesResult = watchedEpisodes
          .map((row) => row.episodeNumber)
          .sort((a, b) => a - b);

        if (!isWatchedResult && mediaItem.totalEpisodes && mediaItem.totalEpisodes > 0) {
          isWatchedResult = watchedEpisodesResult.length === mediaItem.totalEpisodes;
        }
      }

      console.log('GET status result:', { mediaId, mediaType, mediaItemId: mediaItem.id, progressStatus: progress?.status, isWatched: isWatchedResult });
    } else {
      console.log('GET status result:', { mediaId, mediaType, mediaItemFound: false, isWatched: false });
    }

    return NextResponse.json({
      isWatched: isWatchedResult,
      watchedEpisodes: watchedEpisodesResult,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Failed to check media status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mediaId, mediaType, isWatched, title, posterPath, releaseDate, totalEpisodes } = body;
    
    console.log('Received status update request:', { mediaId, mediaType, isWatched, title });

    if (!mediaId || !mediaType) {
      return NextResponse.json({ error: 'mediaId and mediaType required' }, { status: 400 });
    }

    const preferredSource = mediaType === 'anime' ? 'anilist' : 'tmdb';

    // First, ensure the media item exists
    const existingItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(mediaItems.externalId, mediaId),
        eq(mediaItems.source, preferredSource),
        eq(mediaItems.mediaType, mediaType as any)
      ),
    });

    console.log('Looking for existing media item:', { mediaId, mediaType, source: preferredSource, found: !!existingItem });

    let mediaItemId: number;

    if (!existingItem) {
      // Create the media item first
      const [newItem] = await db.insert(mediaItems).values({
        externalId: mediaId,
        source: preferredSource,
        mediaType,
        title: title || 'Unknown Title',
        posterPath,
        releaseDate: releaseDate || null,
        totalEpisodes: typeof totalEpisodes === 'number' ? totalEpisodes : null,
      }).returning();

      mediaItemId = newItem.id;
    } else {
      mediaItemId = existingItem.id;

      if (['anime', 'tv'].includes(mediaType) && typeof totalEpisodes === 'number' && totalEpisodes > 0 && existingItem.totalEpisodes !== totalEpisodes) {
        await db.update(mediaItems)
          .set({
            totalEpisodes,
            updatedAt: new Date(),
          })
          .where(eq(mediaItems.id, existingItem.id));
      }
    }

    // Now update or create the user's progress
    const existingProgress = await db.query.userMediaProgress.findFirst({
      where: and(
        eq(userMediaProgress.userId, parseInt(session.user.id)),
        eq(userMediaProgress.mediaItemId, mediaItemId)
      ),
    });

    console.log('Looking for existing progress:', { userId: parseInt(session.user.id), mediaItemId, found: !!existingProgress, currentStatus: existingProgress?.status });

    if (existingProgress) {
      if (isWatched) {
        // Update existing progress to completed
        console.log('Updating existing progress:', {
          id: existingProgress.id,
          currentStatus: existingProgress.status,
          newStatus: 'completed',
          isWatched
        });
        await db.update(userMediaProgress)
          .set({
            status: 'completed',
            completedAt: new Date(),
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userMediaProgress.id, existingProgress.id));
      } else {
        // Delete the progress record when unwatching
        console.log('Deleting progress record for:', {
          id: existingProgress.id,
          mediaItemId,
          isWatched
        });
        await db.delete(userMediaProgress)
          .where(eq(userMediaProgress.id, existingProgress.id));
      }
    } else if (isWatched) {
      // Create new progress record only if marking as watched
      console.log('Creating new progress record:', {
        userId: parseInt(session.user.id),
        mediaItemId,
        status: 'completed',
        isWatched
      });
      await db.insert(userMediaProgress).values({
        userId: parseInt(session.user.id),
        mediaItemId,
        status: 'completed',
        completedAt: new Date(),
        lastActivityAt: new Date(),
      });
    }

    // Handle cascading for TV shows
    if (mediaType === 'tv') {
      console.log('Handling cascading episode updates for TV show:', { mediaId, isWatched });

      if (isWatched) {
        const numericMediaId = parseInt(mediaId);

        if (!Number.isNaN(numericMediaId)) {
          try {
            const showResponse = await fetch(
              `https://api.themoviedb.org/3/tv/${numericMediaId}?api_key=${process.env.TMDB_API_KEY}`,
              { cache: 'no-store' }
            );

            if (showResponse.ok) {
              const showData = await showResponse.json() as {
                number_of_seasons?: number;
                number_of_episodes?: number;
              };

              const seasonsCount = showData.number_of_seasons || null;
              const episodesCount = showData.number_of_episodes || null;

              await db.update(mediaItems)
                .set({
                  seasons: seasonsCount,
                  totalEpisodes: episodesCount,
                  updatedAt: new Date(),
                })
                .where(eq(mediaItems.id, mediaItemId));

              for (let seasonNum = 1; seasonNum <= (seasonsCount || 0); seasonNum++) {
                const seasonResponse = await fetch(
                  `https://api.themoviedb.org/3/tv/${numericMediaId}/season/${seasonNum}?api_key=${process.env.TMDB_API_KEY}`,
                  { cache: 'no-store' }
                );

                if (!seasonResponse.ok) {
                  continue;
                }

                const seasonData = await seasonResponse.json() as {
                  name?: string;
                  overview?: string;
                  poster_path?: string | null;
                  air_date?: string | null;
                  episodes?: Array<{
                    episode_number: number;
                    name?: string;
                    overview?: string;
                    still_path?: string | null;
                    air_date?: string | null;
                    runtime?: number | null;
                  }>;
                };

                const seasonExternalId = `${mediaId}-${seasonNum}`;
                let seasonRecord = await db.query.seasons.findFirst({
                  where: and(
                    eq(seasons.externalId, seasonExternalId),
                    eq(seasons.source, 'tmdb')
                  ),
                });

                const episodeCount = seasonData.episodes?.length || 0;

                if (!seasonRecord) {
                  const [createdSeason] = await db.insert(seasons).values({
                    mediaItemId,
                    externalId: seasonExternalId,
                    source: 'tmdb',
                    seasonNumber: seasonNum,
                    name: seasonData.name || `Season ${seasonNum}`,
                    overview: seasonData.overview || null,
                    posterPath: seasonData.poster_path || null,
                    airDate: seasonData.air_date || null,
                    episodeCount,
                  }).returning();
                  seasonRecord = createdSeason;
                } else {
                  await db.update(seasons)
                    .set({
                      name: seasonData.name || seasonRecord.name,
                      overview: seasonData.overview || seasonRecord.overview,
                      posterPath: seasonData.poster_path || seasonRecord.posterPath,
                      airDate: seasonData.air_date || seasonRecord.airDate,
                      episodeCount,
                      updatedAt: new Date(),
                    })
                    .where(eq(seasons.id, seasonRecord.id));
                }

                for (const ep of seasonData.episodes || []) {
                  const episodeExternalId = `${mediaId}-${seasonNum}-${ep.episode_number}`;
                  const existingEpisode = await db.query.episodes.findFirst({
                    where: and(
                      eq(episodes.externalId, episodeExternalId),
                      eq(episodes.source, 'tmdb')
                    ),
                  });

                  if (!existingEpisode) {
                    await db.insert(episodes).values({
                      seasonId: seasonRecord.id,
                      externalId: episodeExternalId,
                      source: 'tmdb',
                      episodeNumber: ep.episode_number,
                      name: ep.name || `Episode ${ep.episode_number}`,
                      overview: ep.overview || null,
                      stillPath: ep.still_path || null,
                      airDate: ep.air_date || null,
                      runtime: ep.runtime || null,
                    });
                  }
                }
              }
            }
          } catch (seedError) {
            console.error('Failed to seed TV episodes before cascading watched status:', seedError);
          }
        }
      }

      // Get all episodes for this TV show
      const showEpisodes = await db
        .select({
          episodeId: episodes.id,
          episodeNumber: episodes.episodeNumber,
          seasonNumber: sql<number>`${seasons.seasonNumber}`,
        })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .where(eq(seasons.mediaItemId, mediaItemId));

      console.log('Found episodes for cascading:', showEpisodes.length);

      if (isWatched) {
        // Mark all episodes as watched
        for (const ep of showEpisodes) {
          const existingEpisodeProgress = await db.query.userEpisodeProgress.findFirst({
            where: and(
              eq(userEpisodeProgress.userId, parseInt(session.user.id)),
              eq(userEpisodeProgress.episodeId, ep.episodeId)
            ),
          });

          if (existingEpisodeProgress) {
            // Update existing
            await db.update(userEpisodeProgress)
              .set({
                isWatched: true,
                watchedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(userEpisodeProgress.id, existingEpisodeProgress.id));
          } else {
            // Create new
            await db.insert(userEpisodeProgress).values({
              userId: parseInt(session.user.id),
              episodeId: ep.episodeId,
              isWatched: true,
              watchedAt: new Date(),
            });
          }
        }
      } else {
        // Mark all episodes as unwatched (delete progress records)
        await db.delete(userEpisodeProgress)
          .where(and(
            eq(userEpisodeProgress.userId, parseInt(session.user.id)),
            sql`${userEpisodeProgress.episodeId} IN (
              SELECT ${episodes.id} FROM ${episodes}
              INNER JOIN ${seasons} ON ${episodes.seasonId} = ${seasons.id}
              WHERE ${seasons.mediaItemId} = ${mediaItemId}
            )`
          ));
      }

      console.log('Completed cascading episode updates');
    }

    // Handle cascading for Anime episode tracking in DB
    if (mediaType === 'anime') {
      const targetEpisodeCount =
        (typeof totalEpisodes === 'number' && totalEpisodes > 0)
          ? totalEpisodes
          : (existingItem?.totalEpisodes || null);

      let season = await db.query.seasons.findFirst({
        where: and(
          eq(seasons.mediaItemId, mediaItemId),
          eq(seasons.source, 'anilist'),
          eq(seasons.seasonNumber, 1)
        ),
      });

      if (!season) {
        const [createdSeason] = await db.insert(seasons).values({
          mediaItemId,
          externalId: `${mediaId}-1`,
          source: 'anilist',
          seasonNumber: 1,
          name: 'Season 1',
          episodeCount: targetEpisodeCount || 0,
        }).returning();
        season = createdSeason;
      } else if (targetEpisodeCount && season.episodeCount !== targetEpisodeCount) {
        await db.update(seasons)
          .set({
            episodeCount: targetEpisodeCount,
            updatedAt: new Date(),
          })
          .where(eq(seasons.id, season.id));
      }

      if (isWatched && targetEpisodeCount && targetEpisodeCount > 0) {
        for (let episodeNumber = 1; episodeNumber <= targetEpisodeCount; episodeNumber++) {
          const episodeExternalId = `${mediaId}-1-${episodeNumber}`;
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
              eq(userEpisodeProgress.userId, parseInt(session.user.id)),
              eq(userEpisodeProgress.episodeId, episode.id)
            ),
          });

          if (existingEpisodeProgress) {
            await db.update(userEpisodeProgress)
              .set({
                isWatched: true,
                watchedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(userEpisodeProgress.id, existingEpisodeProgress.id));
          } else {
            await db.insert(userEpisodeProgress).values({
              userId: parseInt(session.user.id),
              episodeId: episode.id,
              isWatched: true,
              watchedAt: new Date(),
            });
          }
        }
      }

      if (!isWatched) {
        await db.delete(userEpisodeProgress)
          .where(and(
            eq(userEpisodeProgress.userId, parseInt(session.user.id)),
            sql`${userEpisodeProgress.episodeId} IN (
              SELECT ${episodes.id} FROM ${episodes}
              INNER JOIN ${seasons} ON ${episodes.seasonId} = ${seasons.id}
              WHERE ${seasons.mediaItemId} = ${mediaItemId}
            )`
          ));
      }
    }

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Failed to update media status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
