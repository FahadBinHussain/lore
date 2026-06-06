import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureCanonicalMediaItem } from '@/lib/media/canonical';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ensured = await ensureCanonicalMediaItem(body);

    if (!ensured) {
      return NextResponse.json(
        { error: 'mediaType, externalId/source, and title are required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: ensured.mediaItem.id,
      mediaItemId: ensured.mediaItem.id,
      mappingId: ensured.mapping?.id ?? null,
      created: ensured.created,
    });
  } catch (error) {
    console.error('Failed to ensure media item:', error);
    return NextResponse.json({ error: 'Failed to ensure media item' }, { status: 500 });
  }
}
