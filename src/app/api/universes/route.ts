import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { universes, universeItems, users, mediaItems } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allUniverses = await db.query.universes.findMany({
      where: eq(universes.isPublic, true),
      orderBy: desc(universes.createdAt),
      with: {
        items: {
          with: {
            mediaItem: true,
          },
          orderBy: universeItems.orderIndex,
        },
        creator: {
          columns: {
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ universes: allUniverses });
  } catch (error) {
    console.error('Failed to fetch universes:', error);
    return NextResponse.json({ error: 'Failed to fetch universes' }, { status: 500 });
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

    // Get the current user from database to get their ID
    const currentUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email!),
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create the universe
    const [newUniverse] = await db.insert(universes).values({
      name,
      description,
      coverImage,
      createdBy: currentUser.id,
      isPublic: true,
    }).returning();

    // Insert universe items if provided
    if (items && items.length > 0) {
      await db.insert(universeItems).values(
        items.map((item: any, index: number) => ({
          universeId: newUniverse.id,
          mediaItemId: item.mediaItemId,
          orderIndex: index,
          isRequired: item.isRequired ?? true,
          notes: item.notes,
        }))
      );
    }

    return NextResponse.json({ universe: newUniverse });
  } catch (error) {
    console.error('Failed to create universe:', error);
    return NextResponse.json({ error: 'Failed to create universe' }, { status: 500 });
  }
}
