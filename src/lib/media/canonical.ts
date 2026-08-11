import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { mediaExternalIds, mediaItems } from '@/db/schema';
import {
  getPrimaryProviderForMediaType,
  getProviderSourceUrl,
  normalizeMediaType,
  normalizeProviderId,
  type MediaType,
} from './provider-registry';

async function fetchPosterFromProvider(
  provider: string,
  mediaType: MediaType,
  externalId: string,
): Promise<{ posterPath: string | null; backdropPath: string | null }> {
  try {
    if (provider === 'tmdb') {
      const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
      const resp = await fetch(
        `https://api.themoviedb.org/3/${endpoint}/${externalId}?api_key=${process.env.TMDB_API_KEY}`,
        { next: { revalidate: 86400 } },
      );
      if (!resp.ok) return { posterPath: null, backdropPath: null };
      const data = (await resp.json()) as { poster_path: string | null; backdrop_path: string | null };
      return { posterPath: data.poster_path, backdropPath: data.backdrop_path };
    }

    if (provider === 'igdb') {
      const clientId = process.env.IGDB_CLIENT_ID;
      const clientSecret = process.env.IGDB_CLIENT_SECRET;
      if (!clientId || !clientSecret) return { posterPath: null, backdropPath: null };

      const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }),
      });
      if (!tokenResp.ok) return { posterPath: null, backdropPath: null };
      const tokenData = (await tokenResp.json()) as { access_token: string };

      const gameResp = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'text/plain',
        },
        body: `fields id,cover.image_id,artworks.image_id; where id = ${externalId}; limit 1;`,
      });
      if (!gameResp.ok) return { posterPath: null, backdropPath: null };
      const gameData = (await gameResp.json()) as Array<{
        cover?: { image_id: string };
        artworks?: Array<{ image_id: string }>;
      }>;
      if (gameData.length === 0) return { posterPath: null, backdropPath: null };

      const game = gameData[0];
      const posterPath = game.cover
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null;
      const backdropPath = game.artworks && game.artworks.length > 0
        ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.artworks[0].image_id}.jpg`
        : null;
      return { posterPath, backdropPath };
    }

    if (provider === 'openlibrary') {
      const workResp = await fetch(
        `https://openlibrary.org/works/${externalId}.json`,
        { next: { revalidate: 86400 } },
      );
      if (!workResp.ok) return { posterPath: null, backdropPath: null };
      const workData = (await workResp.json()) as { covers?: number[] };
      if (workData.covers && workData.covers.length > 0) {
        return {
          posterPath: `https://covers.openlibrary.org/b/id/${workData.covers[0]}-L.jpg`,
          backdropPath: null,
        };
      }
      return { posterPath: null, backdropPath: null };
    }
  } catch {
    // Network/API errors are non-fatal — the item just won't have a poster
  }

  return { posterPath: null, backdropPath: null };
}

async function backfillPosterIfNeeded(
  mediaItem: typeof mediaItems.$inferSelect,
  provider: string,
  mediaType: MediaType,
  externalId: string,
): Promise<typeof mediaItems.$inferSelect> {
  if (mediaItem.posterPath) return mediaItem;

  const { posterPath, backdropPath } = await fetchPosterFromProvider(provider, mediaType, externalId);

  if (posterPath) {
    const [updated] = await db
      .update(mediaItems)
      .set({
        posterPath,
        backdropPath: backdropPath || mediaItem.backdropPath,
      })
      .where(eq(mediaItems.id, mediaItem.id))
      .returning();
    return updated || mediaItem;
  }

  return mediaItem;
}

export type CanonicalMediaPayload = {
  mediaItemId?: number | null;
  externalId?: unknown;
  provider?: unknown;
  source?: unknown;
  mediaType?: unknown;
  title?: unknown;
  originalTitle?: unknown;
  description?: unknown;
  posterPath?: unknown;
  backdropPath?: unknown;
  releaseDate?: unknown;
  rating?: unknown;
  voteCount?: unknown;
  genres?: unknown;
  runtime?: unknown;
  pageCount?: unknown;
  developer?: unknown;
  publisher?: unknown;
  author?: unknown;
  isbn?: unknown;
  platforms?: unknown;
  networks?: unknown;
  seasons?: unknown;
  totalEpisodes?: unknown;
  episodes?: unknown;
  status?: unknown;
  isPlaceholder?: unknown;
  tagline?: unknown;
  popularity?: unknown;
  additionalData?: unknown;
  mappingMetadata?: unknown;
  mappingConfidence?: unknown;
};

export type CanonicalMediaResult = {
  mediaItem: typeof mediaItems.$inferSelect;
  mapping: typeof mediaExternalIds.$inferSelect | null;
  created: boolean;
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeOptionalInteger(value: unknown): number | null {
  const normalized = normalizeOptionalNumber(value);
  return normalized === null ? null : Math.trunc(normalized);
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : null;
}

function normalizeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeReleaseDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toCuratedExternalId(mediaType: MediaType, title: string, releaseDate: string | null): string {
  const titleToken = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
  const yearToken = releaseDate && /^\d{4}/.test(releaseDate) ? releaseDate.slice(0, 4) : 'na';
  return `curated-${mediaType}-${yearToken}-${titleToken}`;
}

function normalizeProviderForPayload(payload: CanonicalMediaPayload, mediaType: MediaType, isPlaceholder: boolean): string {
  return (
    normalizeProviderId(payload.provider) ||
    normalizeProviderId(payload.source) ||
    (isPlaceholder ? 'manual' : null) ||
    getPrimaryProviderForMediaType(mediaType) ||
    'manual'
  );
}

export async function findMediaItemByExternalMapping(input: {
  provider?: unknown;
  source?: unknown;
  mediaType?: unknown;
  externalId?: unknown;
}) {
  const mediaType = normalizeMediaType(input.mediaType);
  const provider = normalizeProviderId(input.provider) || normalizeProviderId(input.source);
  const externalId = normalizeOptionalString(input.externalId);

  if (!mediaType || !provider || !externalId) return null;

  const mapping = await db.query.mediaExternalIds.findFirst({
    where: and(
      eq(mediaExternalIds.provider, provider),
      eq(mediaExternalIds.mediaType, mediaType),
      eq(mediaExternalIds.externalId, externalId)
    ),
    with: {
      mediaItem: true,
    },
  });

  if (mapping?.mediaItem) {
    return mapping.mediaItem;
  }

  const legacyItem = await db.query.mediaItems.findFirst({
    where: and(
      eq(mediaItems.source, provider),
      eq(mediaItems.mediaType, mediaType),
      eq(mediaItems.externalId, externalId)
    ),
  });

  if (legacyItem) {
    await ensureMediaExternalMapping({
      mediaItemId: legacyItem.id,
      provider,
      mediaType,
      externalId,
      isPrimary: legacyItem.source === provider,
    });
  }

  return legacyItem || null;
}

export async function ensureMediaExternalMapping(input: {
  mediaItemId: number;
  provider: string;
  mediaType: MediaType;
  externalId: string;
  sourceUrl?: string | null;
  confidence?: number | null;
  isPrimary?: boolean;
  metadata?: Record<string, unknown> | null;
}) {
  const existing = await db.query.mediaExternalIds.findFirst({
    where: and(
      eq(mediaExternalIds.provider, input.provider),
      eq(mediaExternalIds.mediaType, input.mediaType),
      eq(mediaExternalIds.externalId, input.externalId)
    ),
  });

  const confidence = input.confidence ?? 100;
  const sourceUrl = input.sourceUrl ?? getProviderSourceUrl(input.provider, input.mediaType, input.externalId);
  const metadata = input.metadata ?? null;

  if (existing) {
    if (
      existing.mediaItemId === input.mediaItemId &&
      (existing.sourceUrl !== sourceUrl || existing.confidence !== confidence || existing.isPrimary !== Boolean(input.isPrimary))
    ) {
      const [updated] = await db
        .update(mediaExternalIds)
        .set({
          sourceUrl,
          confidence,
          isPrimary: Boolean(input.isPrimary),
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(mediaExternalIds.id, existing.id))
        .returning();
      return updated;
    }

    return existing;
  }

  const [created] = await db.insert(mediaExternalIds).values({
    mediaItemId: input.mediaItemId,
    provider: input.provider,
    mediaType: input.mediaType,
    externalId: input.externalId,
    sourceUrl,
    confidence,
    isPrimary: Boolean(input.isPrimary),
    metadata,
    lastSyncedAt: new Date(),
  }).returning();

  return created;
}

export async function ensureCanonicalMediaItem(payload: CanonicalMediaPayload): Promise<CanonicalMediaResult | null> {
  const mediaType = normalizeMediaType(payload.mediaType);
  const title = normalizeOptionalString(payload.title);
  const releaseDate = normalizeReleaseDate(payload.releaseDate);
  const isPlaceholder = normalizeOptionalBoolean(payload.isPlaceholder) === true;

  if (!mediaType) return null;

  const provider = normalizeProviderForPayload(payload, mediaType, isPlaceholder);
  let externalId = normalizeOptionalString(payload.externalId);

  if (!externalId && provider === 'manual' && title) {
    externalId = toCuratedExternalId(mediaType, title, releaseDate);
  }

  if (!externalId || !provider) return null;

  if (typeof payload.mediaItemId === 'number' && payload.mediaItemId > 0) {
    const existingById = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, Math.trunc(payload.mediaItemId)),
    });

    if (!existingById) return null;

    const mapping = await ensureMediaExternalMapping({
      mediaItemId: existingById.id,
      provider,
      mediaType,
      externalId,
      isPrimary: existingById.source === provider && existingById.externalId === externalId,
      confidence: normalizeOptionalInteger(payload.mappingConfidence),
      metadata: normalizeObject(payload.mappingMetadata),
    });

    const enrichedItem = await backfillPosterIfNeeded(existingById, provider, mediaType, externalId);

    return {
      mediaItem: enrichedItem,
      mapping,
      created: false,
    };
  }

  const mappedItem = await findMediaItemByExternalMapping({ provider, mediaType, externalId });
  if (mappedItem) {
    const mapping = await ensureMediaExternalMapping({
      mediaItemId: mappedItem.id,
      provider,
      mediaType,
      externalId,
      isPrimary: mappedItem.source === provider && mappedItem.externalId === externalId,
      confidence: normalizeOptionalInteger(payload.mappingConfidence),
      metadata: normalizeObject(payload.mappingMetadata),
    });

    const enrichedItem = await backfillPosterIfNeeded(mappedItem, provider, mediaType, externalId);

    return {
      mediaItem: enrichedItem,
      mapping,
      created: false,
    };
  }

  const safeTitle = title || `Untitled ${mediaType}`;
  const rating = normalizeOptionalNumber(payload.rating);
  const popularity = normalizeOptionalNumber(payload.popularity);
  const totalEpisodes =
    normalizeOptionalInteger(payload.totalEpisodes) ??
    normalizeOptionalInteger(payload.episodes);

  const [createdItem] = await db.insert(mediaItems).values({
    externalId,
    source: provider,
    mediaType,
    title: safeTitle,
    originalTitle: normalizeOptionalString(payload.originalTitle) || safeTitle,
    description: normalizeOptionalString(payload.description),
    posterPath: normalizeOptionalString(payload.posterPath),
    backdropPath: normalizeOptionalString(payload.backdropPath),
    releaseDate,
    rating: rating !== null ? rating.toString() : null,
    voteCount: normalizeOptionalInteger(payload.voteCount) ?? 0,
    genres: normalizeStringArray(payload.genres),
    runtime: normalizeOptionalInteger(payload.runtime),
    pageCount: normalizeOptionalInteger(payload.pageCount),
    developer: normalizeOptionalString(payload.developer),
    publisher: normalizeOptionalString(payload.publisher),
    author: normalizeOptionalString(payload.author),
    isbn: normalizeOptionalString(payload.isbn),
    platforms: normalizeStringArray(payload.platforms),
    networks: normalizeStringArray(payload.networks),
    seasons: normalizeOptionalInteger(payload.seasons),
    totalEpisodes,
    status: normalizeOptionalString(payload.status),
    isPlaceholder,
    tagline: normalizeOptionalString(payload.tagline),
    popularity: popularity !== null ? popularity.toString() : null,
    additionalData: normalizeObject(payload.additionalData),
  }).returning();

  const mapping = await ensureMediaExternalMapping({
    mediaItemId: createdItem.id,
    provider,
    mediaType,
    externalId,
    isPrimary: true,
    confidence: normalizeOptionalInteger(payload.mappingConfidence),
    metadata: normalizeObject(payload.mappingMetadata),
  });

  const enrichedItem = await backfillPosterIfNeeded(createdItem, provider, mediaType, externalId);

  return {
    mediaItem: enrichedItem,
    mapping,
    created: true,
  };
}
