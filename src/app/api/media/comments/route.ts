import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { comments, mediaItems, users } from '@/db/schema';
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
  // Normalize aliases like generic-media already handles; keep simple
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

// GET /api/media/comments?mediaId=X&mediaType=movie
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mediaId = normalizeMediaId(searchParams.get('mediaId'));
  const mediaType = normalizeMediaType(searchParams.get('mediaType'));

  if (!mediaId || !mediaType) {
    return NextResponse.json({ error: 'mediaId and mediaType required' }, { status: 400 });
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
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mediaId: rawMediaId, mediaType: rawMediaType, content: rawContent, parentId: rawParentId, title, posterPath, releaseDate } = body;

    const mediaId = normalizeMediaId(rawMediaId);
    const mediaType = normalizeMediaType(rawMediaType);

    if (!mediaId || !mediaType) {
      return NextResponse.json({ error: 'mediaId and mediaType required' }, { status: 400 });
    }

    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'comment too long (max 2000 chars)' }, { status: 400 });
    }
    // Basic XSS guard: disallow excessive html tags via stripping? Store as plain text, escape on render.
    // Keep raw text; client escapes.

    const preferredSource = getPrimaryProviderForMediaType(mediaType) || (mediaType === 'anime' ? 'anilist' : 'tmdb');

    // Resolve or ensure canonical item (so commenting on a not-yet-tracked item works)
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
      .values({
        mediaItemId: mediaItem.id,
        userId,
        parentId,
        content,
      })
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
