import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { comments, mediaItems, users, episodes, seasons } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { findMediaItemByExternalMapping, ensureCanonicalMediaItem } from '@/lib/media/canonical';
import { getPrimaryProviderForMediaType } from '@/lib/media/provider-registry';

function normalizeMediaId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMediaType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  const allowed = [
    'movie',
    'tv',
    'anime',
    'manga',
    'game',
    'book',
    'comic',
    'boardgame',
    'soundtrack',
    'podcast',
    'themepark',
  ];
  if (allowed.includes(trimmed)) return trimmed;
  return null;
}

async function resolveMediaItem(mediaId: string, mediaType: string) {
  const preferredSource = getPrimaryProviderForMediaType(mediaType) || (mediaType === 'anime' ? 'anilist' : 'tmdb');

  let mediaItem = await findMediaItemByExternalMapping({
    externalId: mediaId,
    mediaType,
    provider: preferredSource,
  });

  if (!mediaItem && mediaType !== 'anime') {
    mediaItem = (await db.query.mediaItems.findFirst({
      where: and(eq(mediaItems.externalId, mediaId), eq(mediaItems.mediaType, mediaType as (typeof mediaItems.$inferSelect)['mediaType'])),
    })) ?? null;
  }

  return mediaItem;
}

// Resolve an episode row for `${showId}-${seasonNumber}-${episodeNumber}`.
// Looks up by the canonical structure (media item -> season -> episode number) so it matches
// whatever externalId format the episode rows carry (e.g. `tmdb-episode-63414`). If the
// episode isn't tracked yet, lazily create the parent media item + season + episode rows so
// comments have a stable FK target.
async function resolveEpisode(episodeKey: string, source: string): Promise<{ id: number } | null> {
  if (source !== 'tmdb' && source !== 'anilist') source = 'tmdb';

  // Parse `showId-season-episode` — TMDB episode externalId format.
  const parts = episodeKey.split('-');
  const showId = parts[0];
  const seasonNumber = parts.length > 1 ? parseInt(parts[1], 10) : NaN;
  const episodeNumber = parts.length > 2 ? parseInt(parts[2], 10) : NaN;
  if (!showId || Number.isNaN(seasonNumber) || Number.isNaN(episodeNumber)) return null;

  const mediaType = source === 'anilist' ? 'anime' : 'tv';
  const mediaItem = await resolveMediaItem(showId, mediaType);
  if (!mediaItem) return null;

  let season = await db.query.seasons.findFirst({
    where: and(eq(seasons.mediaItemId, mediaItem.id), eq(seasons.source, source), eq(seasons.seasonNumber, seasonNumber)),
  });

  if (season) {
    const existingEpisode = await db.query.episodes.findFirst({
      where: and(eq(episodes.seasonId, season.id), eq(episodes.source, source), eq(episodes.episodeNumber, episodeNumber)),
    });
    if (existingEpisode) return { id: existingEpisode.id };
  }

  if (!season) {
    const [createdSeason] = await db.insert(seasons).values({
      mediaItemId: mediaItem.id,
      externalId: `${showId}-${seasonNumber}`,
      source,
      seasonNumber,
      name: `Season ${seasonNumber}`,
      episodeCount: 0,
    }).returning();
    season = createdSeason;
  }

  const [createdEpisode] = await db.insert(episodes).values({
    seasonId: season.id,
    externalId: `${showId}-${seasonNumber}-${episodeNumber}`,
    source,
    episodeNumber,
    name: `Episode ${episodeNumber}`,
  }).returning();

  return { id: createdEpisode.id };
}

// GET /api/media/comments
//  - media scope:  ?mediaId=X&mediaType=movie
//  - episode scope: ?episodeKey=1403-1-4&episodeSource=tmdb
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mediaId = normalizeMediaId(searchParams.get('mediaId'));
  const mediaType = normalizeMediaType(searchParams.get('mediaType'));
  const episodeKey = normalizeMediaId(searchParams.get('episodeKey'));
  const episodeSource = normalizeMediaId(searchParams.get('episodeSource')) || 'tmdb';

  if (episodeKey) {
    try {
      const episode = await resolveEpisode(episodeKey, episodeSource);
      if (!episode) return NextResponse.json({ comments: [] });

      const rows = await db
        .select({
          id: comments.id,
          mediaItemId: comments.mediaItemId,
          episodeId: comments.episodeId,
          userId: comments.userId,
          parentId: comments.parentId,
          content: comments.content,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          userName: users.name,
          userImage: users.image,
          userUsername: users.username,
          userEmail: users.email,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.episodeId, episode.id))
        .orderBy(asc(comments.createdAt));

      return NextResponse.json({ comments: rows });
    } catch (error) {
      console.error('Failed to fetch episode comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
  }

  if (!mediaId || !mediaType) {
    return NextResponse.json({ error: 'mediaId and mediaType (or episodeKey) required' }, { status: 400 });
  }

  try {
    const mediaItem = await resolveMediaItem(mediaId, mediaType);

    if (!mediaItem) {
      return NextResponse.json({ comments: [] });
    }

    const rows = await db
      .select({
        id: comments.id,
        mediaItemId: comments.mediaItemId,
        episodeId: comments.episodeId,
        userId: comments.userId,
        parentId: comments.parentId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        userName: users.name,
        userImage: users.image,
        userUsername: users.username,
        userEmail: users.email,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.mediaItemId, mediaItem.id))
      .orderBy(asc(comments.createdAt));

    return NextResponse.json({ comments: rows });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/media/comments
//  - media scope:  body { mediaId, mediaType, content, parentId?, title?, posterPath?, releaseDate? }
//  - episode scope: body { episodeKey, episodeSource?, content, parentId? }
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content: rawContent, parentId: rawParentId } = body;

    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'comment too long (max 2000 chars)' }, { status: 400 });
    }

    const episodeKey = normalizeMediaId(body.episodeKey);
    const episodeSource = normalizeMediaId(body.episodeSource) || 'tmdb';

    if (episodeKey) {
      const episode = await resolveEpisode(episodeKey, episodeSource);
      if (!episode) {
        return NextResponse.json({ error: 'Unable to resolve episode' }, { status: 400 });
      }

      let parentId: number | null = null;
      if (rawParentId !== undefined && rawParentId !== null) {
        const parsedParentId = typeof rawParentId === 'string' ? parseInt(rawParentId, 10) : rawParentId;
        if (!Number.isInteger(parsedParentId) || parsedParentId <= 0) {
          return NextResponse.json({ error: 'invalid parentId' }, { status: 400 });
        }
        const parent = await db.query.comments.findFirst({
          where: eq(comments.id, parsedParentId),
        });
        if (!parent) {
          return NextResponse.json({ error: 'parent comment not found' }, { status: 404 });
        }
        if (parent.episodeId !== episode.id) {
          return NextResponse.json({ error: 'parent comment belongs to a different episode' }, { status: 400 });
        }
        parentId = parsedParentId;
      }

      const userId = parseInt(session.user.id, 10);
      if (Number.isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
      }

      const [created] = await db
        .insert(comments)
        .values({ episodeId: episode.id, userId, parentId, content })
        .returning();

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true, image: true, username: true, email: true },
      });

      return NextResponse.json(
        {
          comment: {
            id: created.id,
            mediaItemId: created.mediaItemId,
            episodeId: created.episodeId,
            userId: created.userId,
            parentId: created.parentId,
            content: created.content,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
            userName: user?.name ?? null,
            userImage: user?.image ?? null,
            userUsername: user?.username ?? null,
            userEmail: user?.email ?? null,
          },
        },
        { status: 201 }
      );
    }

    const { mediaId: rawMediaId, mediaType: rawMediaType, title, posterPath, releaseDate } = body;
    const mediaId = normalizeMediaId(rawMediaId);
    const mediaType = normalizeMediaType(rawMediaType);

    if (!mediaId || !mediaType) {
      return NextResponse.json({ error: 'mediaId and mediaType (or episodeKey) required' }, { status: 400 });
    }

    const preferredSource = getPrimaryProviderForMediaType(mediaType) || (mediaType === 'anime' ? 'anilist' : 'tmdb');

    let mediaItem = await resolveMediaItem(mediaId, mediaType);

    if (!mediaItem) {
      const ensured = await ensureCanonicalMediaItem({
        externalId: mediaId,
        source: preferredSource,
        mediaType,
        title: typeof title === 'string' && title.trim() ? title.trim() : 'Unknown Title',
        posterPath: typeof posterPath === 'string' ? posterPath : null,
        releaseDate: typeof releaseDate === 'string' ? releaseDate : null,
      });
      if (!ensured) {
        return NextResponse.json({ error: 'Unable to resolve media item' }, { status: 400 });
      }
      mediaItem = ensured.mediaItem;
    }

    let parentId: number | null = null;
    if (rawParentId !== undefined && rawParentId !== null) {
      const parsedParentId = typeof rawParentId === 'string' ? parseInt(rawParentId, 10) : rawParentId;
      if (!Number.isInteger(parsedParentId) || parsedParentId <= 0) {
        return NextResponse.json({ error: 'invalid parentId' }, { status: 400 });
      }
      const parent = await db.query.comments.findFirst({
        where: eq(comments.id, parsedParentId),
      });
      if (!parent) {
        return NextResponse.json({ error: 'parent comment not found' }, { status: 404 });
      }
      if (parent.mediaItemId !== mediaItem.id) {
        return NextResponse.json({ error: 'parent comment belongs to a different item' }, { status: 400 });
      }
      parentId = parsedParentId;
    }

    const userId = parseInt(session.user.id, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }

    const [created] = await db
      .insert(comments)
      .values({ mediaItemId: mediaItem.id, userId, parentId, content })
      .returning();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, image: true, username: true, email: true },
    });

    return NextResponse.json(
      {
        comment: {
          id: created.id,
          mediaItemId: created.mediaItemId,
          episodeId: created.episodeId,
          userId: created.userId,
          parentId: created.parentId,
          content: created.content,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          userName: user?.name ?? null,
          userImage: user?.image ?? null,
          userUsername: user?.username ?? null,
          userEmail: user?.email ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
