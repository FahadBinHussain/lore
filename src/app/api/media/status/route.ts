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
    const userId = parseInt(session.user.id);
    console.log('GET status request:', { mediaId, mediaType, userId, userIdType: typeof session.user.id });

    // Find the media item - try different source values if tmdb doesn't work
    let mediaItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(mediaItems.externalId, mediaId),
        eq(mediaItems.source, 'tmdb'),
        eq(mediaItems.mediaType, mediaType as any)
      ),
    });

    // If not found with tmdb, try finding by externalId only
    if (!mediaItem) {
      console.log('Media item not found with tmdb source, trying without source filter...');
      mediaItem = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.externalId, mediaId),
      });
      if (mediaItem) {
        console.log('Found media item with different source:', { mediaItem, expectedSource: 'tmdb' });
      }
    }

    console.log('Media item query result:', { mediaId, mediaType, found: !!mediaItem, mediaItem });

    let isWatchedResult = false;

    if (mediaItem) {
      // Check user's progress
      const progress = await db.query.userMediaProgress.findFirst({
        where: and(
          eq(userMediaProgress.userId, userId),
          eq(userMediaProgress.mediaItemId, mediaItem.id)
        ),
      });

      console.log('Progress query result:', { userId, mediaItemId: mediaItem.id, found: !!progress, progress });

      isWatchedResult = progress?.status === 'completed';
      console.log('GET status result:', { mediaId, mediaType, mediaItemId: mediaItem.id, progressStatus: progress?.status, isWatched: isWatchedResult });
    } else {
      console.log('GET status result:', { mediaId, mediaType, mediaItemFound: false, isWatched: false });
    }

    return NextResponse.json({
      isWatched: isWatchedResult,
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
    const { mediaId, mediaType, isWatched, title, posterPath, releaseDate } = body;
    
    console.log('Received status update request:', { mediaId, mediaType, isWatched, title });

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

    console.log('Looking for existing media item:', { mediaId, mediaType, source: 'tmdb', found: !!existingItem });

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