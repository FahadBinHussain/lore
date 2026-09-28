import { and, count, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { artworks, userArtistProgress, userArtworkProgress } from '@/db/schema';

export async function artistProgress(userId: number, artistId: number) {
  return db.query.userArtistProgress.findFirst({ where: and(eq(userArtistProgress.userId, userId), eq(userArtistProgress.artistId, artistId)) });
}

export async function artworkTotals(artistId: number) {
  const [row] = await db.select({ total: count() }).from(artworks).where(and(eq(artworks.artistId, artistId), isNotNull(artworks.paintingUrl)));
  return Number(row?.total ?? 0);
}

export async function exploredArtworkCount(userId: number, artistId: number) {
  const [row] = await db.select({ n: count() })
    .from(userArtworkProgress)
    .innerJoin(artworks, eq(artworks.id, userArtworkProgress.artworkId))
    .where(and(eq(userArtworkProgress.userId, userId), eq(artworks.artistId, artistId), eq(userArtworkProgress.isExplored, true)));
  return Number(row?.n ?? 0);
}

/**
 * TV-series rule: every artwork explored → artist auto-marked explored (is_auto).
 * Removing one artwork flips an auto mark back off; a manual mark is never clobbered.
 * - 'up': promote when complete (only after an artwork toggle — a manual artist
 *   un-mark while complete must stay off until the user touches an artwork again)
 * - 'down': demote when incomplete (runs on every read so partial state is honest)
 * - 'both': after an artwork toggle
 */
export async function reconcileArtist(userId: number, artistId: number, mode: 'up' | 'down' | 'both') {
  const total = await artworkTotals(artistId);
  const explored = await exploredArtworkCount(userId, artistId);
  const current = await artistProgress(userId, artistId);
  const complete = total > 0 && explored >= total;

  if (mode !== 'down' && complete && !current?.isExplored) {
    await db.insert(userArtistProgress).values({ userId, artistId, isExplored: true, isAuto: true, exploredAt: new Date() })
      .onConflictDoUpdate({ target: [userArtistProgress.userId, userArtistProgress.artistId], set: { isExplored: true, isAuto: true, exploredAt: new Date(), updatedAt: new Date() } });
  } else if (mode !== 'up' && !complete && current?.isExplored && current.isAuto) {
    await db.update(userArtistProgress).set({ isExplored: false, isAuto: false, exploredAt: null, updatedAt: new Date() })
      .where(and(eq(userArtistProgress.userId, userId), eq(userArtistProgress.artistId, artistId)));
  }
  return { total, explored, complete };
}
