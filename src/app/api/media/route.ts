import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userMediaProgress, mediaItems, userEpisodeProgress, episodes, seasons } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getTMDBImageUrl } from '@/lib/api/tmdb';

const ANILIST_IMAGE_BASE = 'https://s4.anilist.co/file/anilist/viz';

function getImageUrl(path: string | null, source: string | null): string | null {
  if (!path) return null;
  
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Handle different sources
  switch (source) {
    case 'anilist':
      // AniList images are typically stored as just the filename
      return `${ANILIST_IMAGE_BASE}/${path}`;
    case 'tmdb':
    default:
      return getTMDBImageUrl(path);
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');

  if (!type) {
    return NextResponse.json({ error: 'Type required' }, { status: 400 });
  }

  try {
    let rawItems;

    if (type === 'tv') {
      // For TV shows, include both userMediaProgress and shows with watched episodes
      const mediaProgressItems = await db
        .select()
        .from(userMediaProgress)
        .innerJoin(mediaItems, eq(userMediaProgress.mediaItemId, mediaItems.id))
        .where(and(
          eq(userMediaProgress.userId, parseInt(session.user.id)),
          eq(mediaItems.mediaType, 'tv')
        ));

      // Get TV shows with watched episodes
      const episodeProgressShows = await db
        .select({
          mediaItem: mediaItems,
          watchedEpisodes: sql<number>`count(${userEpisodeProgress.id})`,
          latestActivity: sql<Date>`max(${userEpisodeProgress.updatedAt})`,
        })
        .from(userEpisodeProgress)
        .innerJoin(episodes, eq(userEpisodeProgress.episodeId, episodes.id))
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .innerJoin(mediaItems, eq(seasons.mediaItemId, mediaItems.id))
        .where(and(
          eq(userEpisodeProgress.userId, parseInt(session.user.id)),
          eq(mediaItems.mediaType, 'tv'),
          eq(userEpisodeProgress.isWatched, true)
        ))
        .groupBy(mediaItems.id);

      // Combine and deduplicate
      const mediaItemsMap = new Map();

      // Add media progress items
      mediaProgressItems.forEach(row => {
        mediaItemsMap.set(row.media_items.id, {
          id: row.user_media_progress.id,
          status: row.user_media_progress.status,
          progress: row.user_media_progress.currentProgress || 0,
          mediaItem: row.media_items,
          updatedAt: row.user_media_progress.updatedAt,
        });
      });

      // Add episode progress shows
      for (const row of episodeProgressShows) {
        if (!mediaItemsMap.has(row.mediaItem.id)) {
          // Check if placeholder and update
          if (row.mediaItem.isPlaceholder) {
            try {
              const showResponse = await fetch(
                `https://api.themoviedb.org/3/tv/${row.mediaItem.externalId}?api_key=${process.env.TMDB_API_KEY}`
              );
              if (showResponse.ok) {
                const showData = await showResponse.json();
                console.log('Updating placeholder for', row.mediaItem.externalId, showData?.name);
                await db
                  .update(mediaItems)
                  .set({
                    title: showData.name || showData.title || row.mediaItem.title,
                    description: showData.overview || row.mediaItem.description,
                    posterPath: showData.poster_path || row.mediaItem.posterPath,
                    backdropPath: showData.backdrop_path || row.mediaItem.backdropPath,
                    releaseDate: showData.first_air_date ? new Date(showData.first_air_date) : row.mediaItem.releaseDate,
                    rating: showData.vote_average || row.mediaItem.rating,
                    voteCount: showData.vote_count || row.mediaItem.voteCount,
                    genres: showData.genres ? JSON.stringify(showData.genres) : row.mediaItem.genres,
                    networks: showData.networks ? JSON.stringify(showData.networks) : row.mediaItem.networks,
                    seasons: showData.number_of_seasons || row.mediaItem.seasons,
                    totalEpisodes: showData.number_of_episodes || row.mediaItem.totalEpisodes,
                    status: showData.status || row.mediaItem.status,
                    isPlaceholder: false,
                    tagline: showData.tagline || row.mediaItem.tagline,
                    popularity: showData.popularity || row.mediaItem.popularity,
                  })
                  .where(eq(mediaItems.id, row.mediaItem.id));

                // Update the row data
                row.mediaItem = {
                  ...row.mediaItem,
                  title: showData.name || showData.title || row.mediaItem.title,
                  posterPath: showData.poster_path || row.mediaItem.posterPath,
                  description: showData.overview || row.mediaItem.description,
                  isPlaceholder: false,
                };
              }
            } catch (error) {
              console.log('Failed to update placeholder for', row.mediaItem.externalId, error);
            }
          }

          const progress = row.mediaItem.totalEpisodes && row.mediaItem.totalEpisodes > 0 ? (row.watchedEpisodes / row.mediaItem.totalEpisodes) * 100 : 0;
          mediaItemsMap.set(row.mediaItem.id, {
            id: row.mediaItem.id, // Use mediaItem id as unique identifier
            status: progress === 100 ? 'completed' : 'in_progress',
            progress: Math.round(progress),
            mediaItem: row.mediaItem,
            updatedAt: row.latestActivity,
          });
        }
      }

      rawItems = Array.from(mediaItemsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      // For other types, use the original query
      rawItems = await db
        .select()
        .from(userMediaProgress)
        .innerJoin(mediaItems, eq(userMediaProgress.mediaItemId, mediaItems.id))
        .where(and(
          eq(userMediaProgress.userId, parseInt(session.user.id)),
          eq(mediaItems.mediaType, type as 'movie' | 'tv' | 'game' | 'book' | 'comic' | 'boardgame' | 'soundtrack' | 'podcast' | 'themepark' | 'anime' | 'manga')
        ))
        .orderBy(desc(userMediaProgress.updatedAt));
    }

    // Transform to match expected format
    const items = rawItems.map(row => {
      if (type === 'tv' && !row.user_media_progress) {
        // TV show from episode progress
        return {
          id: row.id,
          status: row.status,
          progress: row.progress,
          mediaItem: {
            id: row.mediaItem.id,
            externalId: row.mediaItem.externalId,
            title: row.mediaItem.title,
            posterPath: getImageUrl(row.mediaItem.posterPath, row.mediaItem.source),
            releaseDate: row.mediaItem.releaseDate ? new Date(row.mediaItem.releaseDate).toISOString().split('T')[0] : null,
            rating: row.mediaItem.rating?.toString() || null,
            description: row.mediaItem.description,
            mediaType: row.mediaItem.mediaType,
            source: row.mediaItem.source,
          },
        };
      } else {
        // Regular media progress
        return {
          id: row.user_media_progress.id,
          status: row.user_media_progress.status,
          progress: row.user_media_progress.currentProgress || 0,
          mediaItem: {
            id: row.media_items.id,
            externalId: row.media_items.externalId,
            title: row.media_items.title,
            posterPath: getImageUrl(row.media_items.posterPath, row.media_items.source),
            releaseDate: row.media_items.releaseDate ? new Date(row.media_items.releaseDate).toISOString().split('T')[0] : null,
            rating: row.media_items.rating?.toString() || null,
            description: row.media_items.description,
            mediaType: row.media_items.mediaType,
            source: row.media_items.source,
          },
        };
      }
    });

    console.log('API /media returning items:', items.map(item => ({ id: item.id, status: item.status, title: item.mediaItem.title })));

    return NextResponse.json({ items }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Failed to fetch media items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mediaItemId, status, currentProgress, rating } = body;

    const existingProgress = await db.query.userMediaProgress.findFirst({
      where: and(
        eq(userMediaProgress.userId, parseInt(session.user.id)),
        eq(userMediaProgress.mediaItemId, mediaItemId)
      ),
    });

    if (existingProgress) {
      const [updated] = await db.update(userMediaProgress)
        .set({
          status,
          currentProgress,
          rating,
          updatedAt: new Date(),
          completedAt: status === 'completed' ? new Date() : existingProgress.completedAt,
          lastActivityAt: new Date(),
        })
        .where(eq(userMediaProgress.id, existingProgress.id))
        .returning();
      return NextResponse.json({ item: updated });
    } else {
      const [newItem] = await db.insert(userMediaProgress).values({
        userId: parseInt(session.user.id),
        mediaItemId,
        status: status || 'not_started',
        currentProgress: currentProgress || 0,
        rating,
        lastActivityAt: new Date(),
      }).returning();
      return NextResponse.json({ item: newItem });
    }
  } catch (error) {
    console.error('Failed to update progress:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}