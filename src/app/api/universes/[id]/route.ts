import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collections } from '@/db/schema';
import { isAdminRole } from '@/lib/auth/roles';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { id: idParam } = await params;
    const collectionId = Number.parseInt(idParam, 10);

    if (!Number.isFinite(collectionId) || collectionId <= 0) {
      return NextResponse.json({ error: 'Invalid universe ID' }, { status: 400 });
    }

    const universe = await db.query.collections.findFirst({
      where: eq(collections.id, collectionId),
      columns: {
        id: true,
        name: true,
      },
    });

    if (!universe) {
      return NextResponse.json({ error: 'Universe not found' }, { status: 404 });
    }

    await db.delete(collections).where(eq(collections.id, universe.id));

    return NextResponse.json({
      success: true,
      id: universe.id,
      name: universe.name,
    });
  } catch (error) {
    console.error('Failed to delete universe:', error);
    return NextResponse.json({ error: 'Failed to delete universe' }, { status: 500 });
  }
}
