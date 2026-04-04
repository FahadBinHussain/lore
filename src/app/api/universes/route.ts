import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collections, collectionItems, users, userMediaProgress } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let userId = Number.parseInt(session.user.id || '', 10);
    if (!Number.isFinite(userId) && session.user.email) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, session.user.email),
        columns: { id: true },
      });
      if (dbUser) {
        userId = dbUser.id;
      }
    }

    const allCollections = await db.query.collections.findMany({
      where: eq(collections.visibility, 'public'),
      orderBy: desc(collections.createdAt),
      with: {
        items: {
          with: {
            mediaItem: true,
          },
          orderBy: collectionItems.releaseOrder,
        },
        creator: {
          columns: {
            name: true,
            image: true,
          },
        },
      },
    });

    const mediaItemIds = Array.from(
      new Set(
        allCollections.flatMap((collection) => collection.items.map((item) => item.mediaItem.id))
      )
    );

    const progressRows =
      Number.isFinite(userId) && mediaItemIds.length > 0
        ? await db.query.userMediaProgress.findMany({
            where: and(
              eq(userMediaProgress.userId, userId),
              inArray(userMediaProgress.mediaItemId, mediaItemIds)
            ),
            columns: {
              mediaItemId: true,
              status: true,
            },
          })
        : [];

    const watchedIds = new Set(
      progressRows
        .filter((row) => row.status !== 'not_started')
        .map((row) => row.mediaItemId)
    );

    const collectionsWithProgress = allCollections.map((collection) => {
      const itemsTotal = collection.items.length;
      const itemsCompleted = collection.items.reduce((count, item) => (
        watchedIds.has(item.mediaItem.id) ? count + 1 : count
      ), 0);
      const progress = itemsTotal > 0 ? Math.round((itemsCompleted / itemsTotal) * 100) : 0;

      return {
        ...collection,
        itemsTotal,
        itemsCompleted,
        progress,
      };
    });

    return NextResponse.json({ collections: collectionsWithProgress });
  } catch (error) {
    console.error('Failed to fetch collections:', error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, coverImage, items } = body;

    const currentUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email!),
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const [newCollection] = await db.insert(collections).values({
      name,
      slug: `${slug}-${Date.now()}`,
      description,
      coverImage,
      createdBy: currentUser.id,
      visibility: 'public',
    }).returning();

    if (items && items.length > 0) {
      await db.insert(collectionItems).values(
        items.map((item: { mediaItemId: number; isRequired?: boolean; notes?: string }, index: number) => ({
          collectionId: newCollection.id,
          mediaItemId: item.mediaItemId,
          orderIndex: index,
          isRequired: item.isRequired ?? true,
          notes: item.notes,
        }))
      );
    }

    return NextResponse.json({ collection: newCollection });
  } catch (error) {
    console.error('Failed to create collection:', error);
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
}
