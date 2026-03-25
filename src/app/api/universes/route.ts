import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collections, collectionItems, users, mediaItems } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    return NextResponse.json({ collections: allCollections });
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