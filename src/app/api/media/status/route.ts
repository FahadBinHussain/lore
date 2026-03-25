import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userMediaProgress, mediaItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');
  const mediaType = searchParams.get('mediaType');

  if (!mediaId || !mediaType) {
    return NextResponse.json({ error: 'mediaId and mediaType required' }, { status: 400 });
  }

  try {
    // Find the media item
    const mediaItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(mediaItems.externalId, mediaId),
        eq(mediaItems.source, 'tmdb'), // Default to tmdb for now
        eq(mediaItems.mediaType, mediaType as any)
      ),
    });

    if (!mediaItem) {
      return NextResponse.json({ status: 'not_started' });
    }

    // Check user's progress
    const progress = await db.query.userMediaProgress.findFirst({
      where: and(
        eq(userMediaProgress.userId, parseInt(session.user.id)),
        eq(userMediaProgress.mediaItemId, mediaItem.id)
      ),
    });

    return NextResponse.json({
      isWatched: progress?.status === 'completed',
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
    const { mediaId, mediaType, isWatched, title, posterPath, releaseDate } = body;

    if (!mediaId || !mediaType) {
      return NextResponse.json({ error: 'mediaId and mediaType required' }, { status: 400 });
    }

    // First, ensure the media item exists
    const existingItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(mediaItems.externalId, mediaId),
        eq(mediaItems.source, 'tmdb'),
        eq(mediaItems.mediaType, mediaType as any)
      ),
    });

    let mediaItemId: number;

    if (!existingItem) {
      // Create the media item first
      const [newItem] = await db.insert(mediaItems).values({
        externalId: mediaId,
        source: 'tmdb',
        mediaType,
        title: title || 'Unknown Title',
        posterPath,
        releaseDate: releaseDate || null,
      }).returning();

      mediaItemId = newItem.id;
    } else {
      mediaItemId = existingItem.id;
    }

    // Now update or create the user's progress
    const existingProgress = await db.query.userMediaProgress.findFirst({
      where: and(
        eq(userMediaProgress.userId, parseInt(session.user.id)),
        eq(userMediaProgress.mediaItemId, mediaItemId)
      ),
    });

    if (existingProgress) {
      // Update existing progress
      await db.update(userMediaProgress)
        .set({
          status: isWatched ? 'completed' : 'not_started',
          completedAt: isWatched ? new Date() : null,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userMediaProgress.id, existingProgress.id));
    } else {
      // Create new progress record
      await db.insert(userMediaProgress).values({
        userId: parseInt(session.user.id),
        mediaItemId,
        status: isWatched ? 'completed' : 'not_started',
        completedAt: isWatched ? new Date() : null,
        lastActivityAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update media status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}