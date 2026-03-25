import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userMediaProgress, mediaItems } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getTMDBImageUrl } from '@/lib/api/tmdb';

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
    const rawItems = await db
      .select()
      .from(userMediaProgress)
      .innerJoin(mediaItems, eq(userMediaProgress.mediaItemId, mediaItems.id))
      .where(and(
        eq(userMediaProgress.userId, parseInt(session.user.id)),
        eq(mediaItems.mediaType, type as 'movie' | 'tv' | 'game' | 'book' | 'comic' | 'boardgame' | 'soundtrack' | 'podcast' | 'themepark' | 'anime' | 'manga')
      ))
      .orderBy(desc(userMediaProgress.updatedAt));

    // Transform to match expected format
    const items = rawItems.map(row => ({
      id: row.user_media_progress.id,
      status: row.user_media_progress.status,
      progress: row.user_media_progress.currentProgress || 0,
      mediaItem: {
        id: row.media_items.id,
        externalId: row.media_items.externalId,
        title: row.media_items.title,
        posterPath: getTMDBImageUrl(row.media_items.posterPath),
        releaseDate: row.media_items.releaseDate ? new Date(row.media_items.releaseDate).toISOString().split('T')[0] : null,
        rating: row.media_items.rating?.toString() || null,
        description: row.media_items.description,
        mediaType: row.media_items.mediaType,
      },
    }));

    return NextResponse.json({ items });
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