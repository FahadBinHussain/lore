import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { mediaItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      externalId,
      mediaType,
      title,
      posterPath,
      backdropPath,
      releaseDate,
      rating,
      description,
      genres,
      runtime,
      pageCount,
      developer,
      publisher,
      author,
      isbn,
      platforms,
      networks,
      seasons,
      episodes,
      status,
      tagline,
      popularity,
      source = 'tmdb', // Default to tmdb if not provided
    } = body;

    // Check if media item already exists
    const existingItem = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.externalId, externalId),
    });

    if (existingItem) {
      return NextResponse.json({ id: existingItem.id });
    }

    // Create new media item
    const [newItem] = await db.insert(mediaItems).values({
      externalId,
      source,
      mediaType,
      title,
      originalTitle: title, // For now, assume same as title
      description,
      posterPath,
      backdropPath,
      releaseDate: releaseDate ? releaseDate : null, // Should be string in YYYY-MM-DD format
      rating: rating ? rating.toString() : null,
      genres,
      runtime,
      pageCount,
      developer,
      publisher,
      author,
      isbn,
      platforms,
      networks,
      seasons,
      totalEpisodes: episodes, // Changed from episodes to totalEpisodes
      status,
      tagline,
      popularity: popularity ? popularity.toString() : null,
    }).returning();

    return NextResponse.json({ id: newItem.id });
  } catch (error) {
    console.error('Failed to ensure media item:', error);
    return NextResponse.json({ error: 'Failed to ensure media item' }, { status: 500 });
  }
}