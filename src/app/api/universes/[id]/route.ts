import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collections } from '@/db/schema';
import { isAdminRole } from '@/lib/auth/roles';

const VISIBILITY_OPTIONS = ['public', 'private', 'unlisted'] as const;

async function getAuthUserId(): Promise<{ userId: number; isAdmin: boolean } | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = parseInt(session.user.id, 10);
  if (Number.isNaN(userId)) return null;
  return { userId, isAdmin: isAdminRole(session.user.role) };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authInfo = await getAuthUserId();
  if (!authInfo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!authInfo.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

  try {
    const { id: idParam } = await params;
    const collectionId = Number.parseInt(idParam, 10);
    if (!Number.isFinite(collectionId) || collectionId <= 0) {
      return NextResponse.json({ error: 'Invalid universe ID' }, { status: 400 });
    }

    const universe = await db.query.collections.findFirst({
      where: eq(collections.id, collectionId),
      columns: { id: true, name: true },
    });

    if (!universe) return NextResponse.json({ error: 'Universe not found' }, { status: 404 });

    await db.delete(collections).where(eq(collections.id, universe.id));

    return NextResponse.json({ success: true, id: universe.id, name: universe.name });
  } catch (error) {
    console.error('Failed to delete universe:', error);
    return NextResponse.json({ error: 'Failed to delete universe' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authInfo = await getAuthUserId();
  if (!authInfo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id: idParam } = await params;
    const collectionId = Number.parseInt(idParam, 10);
    if (!Number.isFinite(collectionId) || collectionId <= 0) {
      return NextResponse.json({ error: 'Invalid universe ID' }, { status: 400 });
    }

    const universe = await db.query.collections.findFirst({
      where: eq(collections.id, collectionId),
      columns: { id: true, name: true, createdBy: true, visibility: true },
    });

    if (!universe) return NextResponse.json({ error: 'Universe not found' }, { status: 404 });

    const isOwner = universe.createdBy === authInfo.userId;
    const isAdmin = authInfo.isAdmin;
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only the owner or admin can edit this universe' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.visibility !== undefined) {
      if (!VISIBILITY_OPTIONS.includes(body.visibility)) {
        return NextResponse.json({ error: `Invalid visibility: must be one of ${VISIBILITY_OPTIONS.join(', ')}` }, { status: 400 });
      }
      updates.visibility = body.visibility;
    }

    if (typeof body.name === 'string' && body.name.trim().length > 0) {
      updates.name = body.name.trim();
    }

    if (typeof body.description === 'string') {
      updates.description = body.description.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updatedAt = new Date();

    const [updated] = await db.update(collections)
      .set(updates)
      .where(eq(collections.id, collectionId))
      .returning({ id: collections.id, name: collections.name, visibility: collections.visibility, description: collections.description });

    return NextResponse.json({ collection: updated });
  } catch (error) {
    console.error('Failed to update universe:', error);
    return NextResponse.json({ error: 'Failed to update universe' }, { status: 500 });
  }
}