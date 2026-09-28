import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, ilike, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { artists, userArtistProgress, users } from '@/db/schema';

async function currentUserId() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await db.query.users.findFirst({ where: eq(users.email, session.user.email), columns: { id: true } });
  return user?.id ?? null;
}

async function exploredBy(userId: number | null) {
  if (!userId) return new Map<number, boolean>();
  const rows = await db.query.userArtistProgress.findMany({ where: eq(userArtistProgress.userId, userId) });
  return new Map(rows.map((row) => [row.artistId, row.isExplored]));
}

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    const progress = await exploredBy(userId);
    const query = request.nextUrl.searchParams.get('q')?.trim() || '';
    if (query) {
      const rows = await db.query.artists.findMany({
        where: or(ilike(artists.name, `%${query}%`), ilike(artists.slug, `%${query}%`)),
        limit: 50,
        orderBy: [desc(artists.artworkCount), desc(artists.updatedAt)],
      });
      return NextResponse.json({ source: 'db', total: rows.length, artists: rows.map((artist) => ({ ...artist, isExplored: progress.get(artist.id) ?? false })) });
    }
    const rows = await db.query.artists.findMany({ orderBy: [desc(artists.artworkCount), desc(artists.updatedAt)], limit: 100 });
    return NextResponse.json({ source: 'db', total: rows.length, artists: rows.map((artist) => ({ ...artist, isExplored: progress.get(artist.id) ?? false })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Artist search failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { provider?: string; externalId?: string; slug?: string; name?: string; imageUrl?: string | null; biography?: string; birthYear?: number | null; deathYear?: number | null; sourceUrl?: string };
    if (!body.slug || !body.name) return NextResponse.json({ error: 'Artist slug and name are required.' }, { status: 400 });
    const provider = body.provider || 'wikiart';
    const [artist] = await db.insert(artists).values({ provider, externalId: body.externalId || body.slug, slug: body.slug, name: body.name, imageUrl: body.imageUrl || null, biography: body.biography || null, birthYear: body.birthYear || null, deathYear: body.deathYear || null, sourceUrl: body.sourceUrl || `https://www.wikiart.org/en/${body.slug}` }).onConflictDoUpdate({ target: [artists.provider, artists.externalId], set: { name: body.name, imageUrl: body.imageUrl || null, biography: body.biography || null, birthYear: body.birthYear || null, deathYear: body.deathYear || null, sourceUrl: body.sourceUrl || null, updatedAt: new Date() } }).returning();
    await db.insert(userArtistProgress).values({ userId, artistId: artist.id, isExplored: false }).onConflictDoNothing();
    return NextResponse.json({ artist });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Artist could not be saved.' }, { status: 500 });
  }
}
