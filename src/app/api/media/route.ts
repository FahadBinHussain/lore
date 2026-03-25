import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userMediaProgress, mediaItems } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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
    const items = await db.query.userMediaProgress.findMany({
      where: and(
        eq(userMediaProgress.userId, parseInt(session.user.id)),
        eq(mediaItems.mediaType, type as 'movie' | 'tv' | 'game' | 'book')
      ),
      orderBy: desc(userMediaProgress.updatedAt),
      with: {
        mediaItem: true,
      },
    });

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