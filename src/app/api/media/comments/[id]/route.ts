import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { comments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAdminRole } from '@/lib/auth/roles';

function parseId(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// DELETE /api/media/comments/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const commentId = parseId(id);
  if (!commentId) {
    return NextResponse.json({ error: 'invalid comment id' }, { status: 400 });
  }

  try {
    const existing = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });

    if (!existing) {
      return NextResponse.json({ error: 'comment not found' }, { status: 404 });
    }

    const userId = parseInt(session.user.id, 10);
    const isOwner = existing.userId === userId;
    const isAdmin = isAdminRole(session.user.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.delete(comments).where(eq(comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}

// PATCH /api/media/comments/:id  { content }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const commentId = parseId(id);
  if (!commentId) {
    return NextResponse.json({ error: 'invalid comment id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const rawContent = body?.content;
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'comment too long (max 2000 chars)' }, { status: 400 });
    }

    const existing = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });

    if (!existing) {
      return NextResponse.json({ error: 'comment not found' }, { status: 404 });
    }

    const userId = parseInt(session.user.id, 10);
    const isOwner = existing.userId === userId;
    const isAdmin = isAdminRole(session.user.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [updated] = await db
      .update(comments)
      .set({ content, updatedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning();

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error('Failed to update comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}
