import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { artists, artworks, userArtistProgress, userArtworkProgress, users } from '@/db/schema';
import { artistProgress, artworkTotals, exploredArtworkCount, reconcileArtist } from '@/lib/artists/progress';

const PAINTINGS_LIMIT = 500;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.query.users.findFirst({ where: eq(users.email, session.user.email), columns: { id: true } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const user = await requireUser();
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0);
    const artist = await db.query.artists.findFirst({ where: and(eq(artists.provider, 'wikiart'), eq(artists.slug, slug)) });
    if (!artist) {
      return NextResponse.json({ error: `Artist "${slug}" is not in the local catalog. Run scripts/sync-artists-wikiart-keyless.ts single ${slug} to crawl it.` }, { status: 404 });
    }
    const rows = await db.select({
      id: artworks.id,
      title: artworks.title,
      year: artworks.year,
      imageUrl: artworks.imageUrl,
      sourceUrl: artworks.paintingUrl,
      width: artworks.width,
      height: artworks.height,
      total: sql<number>`count(*) over()`.as('total'),
    }).from(artworks)
      .where(and(eq(artworks.artistId, artist.id), isNotNull(artworks.paintingUrl)))
      .orderBy(sql`${artworks.year} asc nulls last, ${artworks.id} asc`)
      .offset(offset)
      .limit(PAINTINGS_LIMIT);

    const total = rows.length ? Number(rows[0].total) : offset + rows.length;
    const sliceIds = rows.map((row) => row.id);
    const exploredRows = sliceIds.length
      ? await db.select({ artworkId: userArtworkProgress.artworkId }).from(userArtworkProgress)
          .where(and(eq(userArtworkProgress.userId, user?.id ?? -1), eq(userArtworkProgress.isExplored, true), inArray(userArtworkProgress.artworkId, sliceIds)))
      : [];
    const exploredIds = new Set(exploredRows.map((row) => row.artworkId));

    const { explored } = user ? await reconcileArtist(user.id, artist.id, 'down') : { explored: 0 };
    const progress = user ? await artistProgress(user.id, artist.id) : null;

    const paintings = rows.map((row) => ({ id: String(row.id), title: row.title, year: row.year, imageUrl: row.imageUrl, sourceUrl: row.sourceUrl || `https://www.wikiart.org/en/${slug}`, width: row.width, height: row.height, explored: exploredIds.has(row.id) }));
    return NextResponse.json({ artist, paintings, total, truncated: offset + rows.length < total, isExplored: Boolean(progress?.isExplored), isAuto: Boolean(progress?.isAuto), exploredCount: explored });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Artist could not be loaded.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const body = await request.json() as { isExplored?: boolean; artistId?: number; name?: string; artworkId?: number };

  if (body.artworkId) {
    const artwork = await db.query.artworks.findFirst({ where: eq(artworks.id, body.artworkId), columns: { id: true, artistId: true } });
    if (!artwork) return NextResponse.json({ error: 'Artwork not found.' }, { status: 404 });
    const isExplored = body.isExplored !== false;
    await db.insert(userArtworkProgress).values({ userId: user.id, artworkId: artwork.id, isExplored, exploredAt: isExplored ? new Date() : null })
      .onConflictDoUpdate({ target: [userArtworkProgress.userId, userArtworkProgress.artworkId], set: { isExplored, exploredAt: isExplored ? new Date() : null, updatedAt: new Date() } });
    const state = await reconcileArtist(user.id, artwork.artistId, 'both');
    const artistRow = await db.query.artists.findFirst({ where: eq(artists.id, artwork.artistId), columns: { slug: true } });
    const progress = await artistProgress(user.id, artwork.artistId);
    return NextResponse.json({ ...state, artistSlug: artistRow?.slug, artistExplored: Boolean(progress?.isExplored), artistIsAuto: Boolean(progress?.isAuto) });
  }

  let artist = body.artistId ? await db.query.artists.findFirst({ where: eq(artists.id, body.artistId) }) : await db.query.artists.findFirst({ where: and(eq(artists.provider, 'wikiart'), eq(artists.slug, slug)) });
  if (!artist) {
    artist = (await db.insert(artists).values({ provider: 'wikiart', externalId: slug, slug, name: body.name || slug, sourceUrl: `https://www.wikiart.org/en/${slug}` }).returning())[0];
  }
  const isExplored = body.isExplored !== false;
  const [progress] = await db.insert(userArtistProgress).values({ userId: user.id, artistId: artist.id, isExplored, isAuto: false, exploredAt: isExplored ? new Date() : null })
    .onConflictDoUpdate({ target: [userArtistProgress.userId, userArtistProgress.artistId], set: { isExplored, isAuto: false, exploredAt: isExplored ? new Date() : null, updatedAt: new Date() } }).returning();
  const totals = await artworkTotals(artist.id);
  const explored = await exploredArtworkCount(user.id, artist.id);
  return NextResponse.json({ progress, total: totals, exploredCount: explored });
}
