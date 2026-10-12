import { db } from '@/db';
import { artworkExternalIds } from '@/db/schema';

export type ArtworkSourceInput = {
  artworkId: number;
  provider: string;
  externalId: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  title?: string | null;
  confidence?: number;
  isPrimary?: boolean;
  lastSyncedAt?: Date;
};

// One row per catalog holding the artwork; the artworks row stays canonical.
// Identity is (provider, external_id) — re-syncs update in place, never duplicate.
// isPrimary is written at creation only: the update path never flips it.
export async function upsertArtworkSource(input: ArtworkSourceInput) {
  const now = new Date();
  const values = {
    artworkId: input.artworkId,
    provider: input.provider,
    externalId: input.externalId,
    sourceUrl: input.sourceUrl ?? null,
    imageUrl: input.imageUrl ?? null,
    title: input.title ?? null,
    confidence: input.confidence ?? 100,
    isPrimary: input.isPrimary ?? false,
    lastSyncedAt: input.lastSyncedAt ?? now,
  };
  const [row] = await db
    .insert(artworkExternalIds)
    .values(values)
    .onConflictDoUpdate({
      target: [artworkExternalIds.provider, artworkExternalIds.externalId],
      set: {
        sourceUrl: values.sourceUrl,
        imageUrl: values.imageUrl,
        title: values.title,
        confidence: values.confidence,
        lastSyncedAt: values.lastSyncedAt,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}
