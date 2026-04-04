import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collectionItems, collections, mediaItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { slugify } from '@/lib/utils';
import { isAdminRole } from '@/lib/auth/roles';

const SUPPORTED_MEDIA_TYPES = ['movie', 'tv', 'anime', 'game', 'book', 'comic', 'boardgame', 'soundtrack', 'podcast', 'themepark'] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

interface UniverseResolvedItemPayload {
  mediaItemId?: number;
  title?: string;
  externalId?: string;
  source?: string;
  mediaType?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  rating?: number | null;
  description?: string | null;
  genres?: string[];
  runtime?: number | null;
  developer?: string | null;
  publisher?: string | null;
  platforms?: string[];
  networks?: string[];
  seasons?: number | null;
  totalEpisodes?: number | null;
  status?: string | null;
  tagline?: string | null;
  popularity?: number | null;
}

interface UniverseCreateJsonBody {
  name?: unknown;
  description?: unknown;
  selectedItems?: unknown;
}

interface EnsuredMediaItemResult {
  mediaItemId: number;
  releaseDate: string | null;
}

function normalizeMediaType(value: unknown): SupportedMediaType | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(normalized)
    ? (normalized as SupportedMediaType)
    : null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeReleaseDateValue(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function parseReleaseDateParts(value: string): { year: number; month: number; day: number } | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const strictMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (strictMatch) {
    const year = Number.parseInt(strictMatch[1], 10);
    const month = Number.parseInt(strictMatch[2], 10);
    const day = Number.parseInt(strictMatch[3], 10);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return { year, month, day };
    }
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

function releaseDateToTimestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;

  const parts = parseReleaseDateParts(value);
  if (!parts) {
    return Number.POSITIVE_INFINITY;
  }

  // Use full date precision for sorting: YYYYMMDD
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function parseSelectedItems(value: unknown): UniverseResolvedItemPayload[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      mediaItemId: normalizeOptionalNumber(entry.mediaItemId) ?? undefined,
      title: normalizeOptionalString(entry.title) ?? undefined,
      externalId: normalizeOptionalString(entry.externalId) ?? undefined,
      source: normalizeOptionalString(entry.source) ?? undefined,
      mediaType: normalizeOptionalString(entry.mediaType) ?? undefined,
      posterPath: normalizeOptionalString(entry.posterPath),
      backdropPath: normalizeOptionalString(entry.backdropPath),
      releaseDate: normalizeOptionalString(entry.releaseDate),
      rating: normalizeOptionalNumber(entry.rating),
      description: normalizeOptionalString(entry.description),
      genres: normalizeStringArray(entry.genres),
      runtime: normalizeOptionalNumber(entry.runtime),
      developer: normalizeOptionalString(entry.developer),
      publisher: normalizeOptionalString(entry.publisher),
      platforms: normalizeStringArray(entry.platforms),
      networks: normalizeStringArray(entry.networks),
      seasons: normalizeOptionalNumber(entry.seasons),
      totalEpisodes: normalizeOptionalNumber(entry.totalEpisodes),
      status: normalizeOptionalString(entry.status),
      tagline: normalizeOptionalString(entry.tagline),
      popularity: normalizeOptionalNumber(entry.popularity),
    }));
}

function parseCreatePayloadFromJson(body: UniverseCreateJsonBody) {
  const name = normalizeOptionalString(body.name) || '';
  const description = normalizeOptionalString(body.description);
  const selectedItems = parseSelectedItems(body.selectedItems);

  return {
    name,
    description,
    selectedItems,
  };
}

async function parseCreatePayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const jsonBody = (await request.json()) as UniverseCreateJsonBody;
    return parseCreatePayloadFromJson(jsonBody);
  }

  const formData = await request.formData();
  const name = normalizeOptionalString(formData.get('name')) || '';
  const description = normalizeOptionalString(formData.get('description'));
  const rawSelectedItems = formData.get('selectedItems');

  let selectedItems: UniverseResolvedItemPayload[] = [];
  if (typeof rawSelectedItems === 'string') {
    try {
      selectedItems = parseSelectedItems(JSON.parse(rawSelectedItems));
    } catch (error) {
      console.error('Failed to parse selected items payload:', error);
    }
  }

  return {
    name,
    description,
    selectedItems,
  };
}

async function ensureMediaItem(item: UniverseResolvedItemPayload): Promise<EnsuredMediaItemResult | null> {
  if (typeof item.mediaItemId === 'number' && item.mediaItemId > 0) {
    const mediaItemId = Math.trunc(item.mediaItemId);
    const existingById = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, mediaItemId),
    });

    if (!existingById) {
      return null;
    }

    return {
      mediaItemId: existingById.id,
      releaseDate: normalizeReleaseDateValue(existingById.releaseDate),
    };
  }

  const externalId = normalizeOptionalString(item.externalId);
  const source = normalizeOptionalString(item.source);
  const mediaType = normalizeMediaType(item.mediaType);

  if (!externalId || !source || !mediaType) {
    return null;
  }

  const existingItem = await db.query.mediaItems.findFirst({
    where: and(
      eq(mediaItems.externalId, externalId),
      eq(mediaItems.source, source),
      eq(mediaItems.mediaType, mediaType)
    ),
  });

  if (existingItem) {
    return {
      mediaItemId: existingItem.id,
      releaseDate: normalizeReleaseDateValue(existingItem.releaseDate),
    };
  }

  const title = normalizeOptionalString(item.title) || `Untitled ${mediaType}`;
  const genres = normalizeStringArray(item.genres);
  const platforms = normalizeStringArray(item.platforms);
  const networks = normalizeStringArray(item.networks);
  const releaseDate = normalizeOptionalString(item.releaseDate);
  const rating = normalizeOptionalNumber(item.rating);
  const popularity = normalizeOptionalNumber(item.popularity);
  const runtime = normalizeOptionalNumber(item.runtime);
  const seasons = normalizeOptionalNumber(item.seasons);
  const totalEpisodes = normalizeOptionalNumber(item.totalEpisodes);

  const [createdItem] = await db.insert(mediaItems).values({
    externalId,
    source,
    mediaType,
    title,
    originalTitle: title,
    description: normalizeOptionalString(item.description),
    posterPath: normalizeOptionalString(item.posterPath),
    backdropPath: normalizeOptionalString(item.backdropPath),
    releaseDate,
    rating: rating !== null ? rating.toString() : null,
    genres: genres.length > 0 ? genres : null,
    runtime: runtime !== null ? Math.trunc(runtime) : null,
    developer: normalizeOptionalString(item.developer),
    publisher: normalizeOptionalString(item.publisher),
    platforms: platforms.length > 0 ? platforms : null,
    networks: networks.length > 0 ? networks : null,
    seasons: seasons !== null ? Math.trunc(seasons) : null,
    totalEpisodes: totalEpisodes !== null ? Math.trunc(totalEpisodes) : null,
    status: normalizeOptionalString(item.status),
    tagline: normalizeOptionalString(item.tagline),
    popularity: popularity !== null ? popularity.toString() : null,
  }).returning();

  return {
    mediaItemId: createdItem.id,
    releaseDate: normalizeReleaseDateValue(createdItem.releaseDate),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await parseCreatePayload(request);

    if (!payload.name) {
      return NextResponse.json({ error: 'Universe name is required' }, { status: 400 });
    }

    const baseSlug = slugify(payload.name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.query.collections.findFirst({
        where: eq(collections.slug, slug),
      });

      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const ensuredItemsById = new Map<number, { mediaItemId: number; releaseDate: string | null; inputIndex: number }>();
    for (let index = 0; index < payload.selectedItems.length; index += 1) {
      const item = payload.selectedItems[index];
      const ensuredItem = await ensureMediaItem(item);
      if (!ensuredItem) {
        continue;
      }

      const existing = ensuredItemsById.get(ensuredItem.mediaItemId);
      if (!existing) {
        ensuredItemsById.set(ensuredItem.mediaItemId, {
          mediaItemId: ensuredItem.mediaItemId,
          releaseDate: ensuredItem.releaseDate,
          inputIndex: index,
        });
        continue;
      }

      if (!existing.releaseDate && ensuredItem.releaseDate) {
        existing.releaseDate = ensuredItem.releaseDate;
      }
      existing.inputIndex = Math.min(existing.inputIndex, index);
    }

    const orderedMediaItems = Array.from(ensuredItemsById.values()).sort((a, b) => {
      const releaseDiff = releaseDateToTimestamp(a.releaseDate) - releaseDateToTimestamp(b.releaseDate);
      if (releaseDiff !== 0) {
        return releaseDiff;
      }
      return a.inputIndex - b.inputIndex;
    });

    const orderedMediaItemIds = orderedMediaItems.map((item) => item.mediaItemId);

    if (orderedMediaItemIds.length === 0) {
      return NextResponse.json({ error: 'No valid media items selected for this universe' }, { status: 400 });
    }

    const creatorId = Number.parseInt(session.user.id || '', 10);
    if (Number.isNaN(creatorId)) {
      return NextResponse.json({ error: 'Invalid user context' }, { status: 400 });
    }

    const [newUniverse] = await db.insert(collections).values({
      name: payload.name,
      slug,
      description: payload.description,
      coverImage: null,
      bannerImage: null,
      createdBy: creatorId,
      visibility: 'public',
      isFeatured: false,
      viewCount: 0,
      itemCount: orderedMediaItemIds.length,
      followerCount: 0,
    }).returning();

    await db.insert(collectionItems).values(
      orderedMediaItemIds.map((mediaItemId, index) => ({
        collectionId: newUniverse.id,
        mediaItemId,
        releaseOrder: index + 1,
        chronologicalOrder: index + 1,
        isRequired: true,
        notes: null,
      }))
    );

    return NextResponse.json({
      id: newUniverse.id,
      name: newUniverse.name,
      slug: newUniverse.slug,
      description: newUniverse.description,
      visibility: newUniverse.visibility,
      itemCount: orderedMediaItemIds.length,
    });
  } catch (error) {
    console.error('Error creating universe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
