import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, inArray, or } from 'drizzle-orm';
import { Star, BookOpen, Users, Gem } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collectionItems, collections, userMediaProgress, users } from '@/db/schema';
import { HeroDebugLog } from '@/components/universes/hero-debug-log';

interface UniversePageProps {
  params: Promise<{ slug: string }>;
}

interface HeroCandidateItem {
  id: number;
  title: string;
  mediaType: string;
  source: string;
  backdropPath: string | null;
  posterPath: string | null;
}

function toImageUrl(path: string | null, source: string | null, size: 'w342' | 'w1280' = 'w342'): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  if (path.startsWith('//')) return `https:${path}`;
  if (path.startsWith('/t/p/')) return `https://image.tmdb.org${path}`;
  if (source === 'anilist' && path.startsWith('/file/')) return `https://s4.anilist.co${path}`;
  if (path.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${path}`;
  return path;
}

function getDominantMediaType(
  items: Array<{ mediaItem: { mediaType: string | null; source: string | null } }>
): string | null {
  const counts = new Map<string, number>();

  for (const item of items) {
    const mediaType = item.mediaItem.mediaType?.trim();
    if (!mediaType) continue;
    if (item.mediaItem.source === 'manual') continue;
    counts.set(mediaType, (counts.get(mediaType) || 0) + 1);
  }

  let dominantType: string | null = null;
  let dominantCount = 0;
  for (const [type, count] of counts.entries()) {
    if (count > dominantCount) {
      dominantType = type;
      dominantCount = count;
    }
  }

  return dominantType;
}

function selectHeroCandidate(
  items: Array<{
    mediaItem: {
      id: number;
      title: string;
      mediaType: string;
      source: string;
      backdropPath: string | null;
      posterPath: string | null;
    };
  }>
): { item: HeroCandidateItem | null; imagePath: string | null; imageKind: 'backdrop' | 'poster' | null } {
  const dominantType = getDominantMediaType(items);
  const dominantItems = dominantType
    ? items.filter((entry) => entry.mediaItem.mediaType === dominantType)
    : items;

  const dominantBackdrop = dominantItems.find((entry) => entry.mediaItem.backdropPath);
  if (dominantBackdrop) {
    return {
      item: dominantBackdrop.mediaItem,
      imagePath: dominantBackdrop.mediaItem.backdropPath,
      imageKind: 'backdrop',
    };
  }

  const dominantPoster = dominantItems.find((entry) => entry.mediaItem.posterPath);
  if (dominantPoster) {
    return {
      item: dominantPoster.mediaItem,
      imagePath: dominantPoster.mediaItem.posterPath,
      imageKind: 'poster',
    };
  }

  const fallbackBackdrop = items.find((entry) => entry.mediaItem.backdropPath);
  if (fallbackBackdrop) {
    return {
      item: fallbackBackdrop.mediaItem,
      imagePath: fallbackBackdrop.mediaItem.backdropPath,
      imageKind: 'backdrop',
    };
  }

  const fallbackPoster = items.find((entry) => entry.mediaItem.posterPath);
  if (fallbackPoster) {
    return {
      item: fallbackPoster.mediaItem,
      imagePath: fallbackPoster.mediaItem.posterPath,
      imageKind: 'poster',
    };
  }

  return { item: null, imagePath: null, imageKind: null };
}

function isTrackableMediaItem(mediaItem: {
  source: string | null;
  externalId: string;
  isPlaceholder?: boolean | null;
}): boolean {
  if (mediaItem.isPlaceholder) return false;
  if (mediaItem.source === 'manual') return false;
  return Boolean(mediaItem.externalId);
}

function getMediaHref(
  mediaType: string,
  externalId: string,
  source: string | null,
  isPlaceholder?: boolean | null
): string | null {
  if (!isTrackableMediaItem({ source, externalId, isPlaceholder })) return null;
  if (!externalId) return null;
  if (mediaType === 'movie') return `/movies/${externalId}`;
  if (mediaType === 'tv') return `/tv/${externalId}`;
  if (mediaType === 'anime') return `/anime/${externalId}`;
  if (mediaType === 'game') return `/games/${externalId}`;
  if (mediaType === 'book') return `/books/${externalId}`;
  return null;
}

function formatReleaseDate(value: Date | string | null): string {
  if (!value) return 'Unknown date';

  let date: Date;
  if (typeof value === 'string') {
    const plainDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    date = plainDateMatch ? new Date(`${value}T00:00:00Z`) : new Date(value);
  } else {
    date = value;
  }

  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatMediaType(type: string): string {
  return type.replace(/[_-]+/g, ' ').toUpperCase();
}

function getUnverifiedInputType(additionalData: unknown): string | null {
  if (!additionalData || typeof additionalData !== 'object' || Array.isArray(additionalData)) {
    return null;
  }

  const unresolved = (additionalData as Record<string, unknown>).unresolved;
  if (!unresolved || typeof unresolved !== 'object' || Array.isArray(unresolved)) {
    return null;
  }

  const rawType = (unresolved as Record<string, unknown>).inputType;
  if (typeof rawType !== 'string') return null;
  const trimmed = rawType.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getUnverifiedReason(additionalData: unknown, mediaType: string): string | null {
  if (additionalData && typeof additionalData === 'object' && !Array.isArray(additionalData)) {
    const unresolved = (additionalData as Record<string, unknown>).unresolved;
    if (unresolved && typeof unresolved === 'object' && !Array.isArray(unresolved)) {
      const unresolvedRecord = unresolved as Record<string, unknown>;
      const rawReason = unresolvedRecord.reason;
      if (typeof rawReason === 'string' && rawReason.trim().length > 0) {
        return rawReason.replace(/\s*\(tried:.*$/i, '').trim();
      }

      const inputSource = unresolvedRecord.inputSource;
      const inputType = unresolvedRecord.inputType;
      if (typeof inputSource === 'string' && inputSource.trim().length > 0) {
        const sourceLabel = inputSource.trim().toUpperCase();
        const typeLabel =
          typeof inputType === 'string' && inputType.trim().length > 0
            ? inputType.trim().toLowerCase()
            : mediaType.toLowerCase();
        return `No ${sourceLabel} ${typeLabel} match found`;
      }
    }
  }

  return null;
}

function getDisplayDescription(description: string | null, isUnverified: boolean): string {
  if (!description) return 'No description available yet.';
  if (!isUnverified) return description;

  const marker = 'is kept as an archive-only entry.';
  const lower = description.toLowerCase();
  const markerIndex = lower.indexOf(marker);
  if (markerIndex >= 0) {
    return description.slice(0, markerIndex + marker.length).trim();
  }

  return description;
}

export default async function Page({ params }: UniversePageProps) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  let userId = Number.parseInt(session.user.id || '', 10);
  if (!Number.isFinite(userId) && session.user.email) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
      columns: { id: true },
    });
    if (dbUser) {
      userId = dbUser.id;
    }
  }

  const { slug } = await params;
  const maybeId = Number.parseInt(slug, 10);

  const universe = await db.query.collections.findFirst({
    where: and(
      eq(collections.visibility, 'public'),
      Number.isNaN(maybeId) ? eq(collections.slug, slug) : or(eq(collections.slug, slug), eq(collections.id, maybeId))
    ),
    with: {
      creator: { columns: { name: true } },
      items: {
        orderBy: collectionItems.releaseOrder,
        with: { mediaItem: true },
      },
    },
  });

  if (!universe) notFound();

  const trackableMediaItemIds = universe.items
    .map((item) => item.mediaItem)
    .filter((mediaItem) => isTrackableMediaItem(mediaItem))
    .map((mediaItem) => mediaItem.id);
  const progressRows =
    Number.isFinite(userId) && trackableMediaItemIds.length > 0
      ? await db.query.userMediaProgress.findMany({
          where: and(
            eq(userMediaProgress.userId, userId),
            inArray(userMediaProgress.mediaItemId, trackableMediaItemIds)
          ),
          columns: {
            mediaItemId: true,
            status: true,
          },
        })
      : [];
  const watchedMediaIds = new Set(
    progressRows
      .filter((row) => row.status !== 'not_started')
      .map((row) => row.mediaItemId)
  );

  const heroCandidate = selectHeroCandidate(universe.items);
  const heroImage =
    toImageUrl(universe.bannerImage, 'tmdb', 'w1280') ||
    toImageUrl(universe.coverImage, 'tmdb', 'w1280') ||
    toImageUrl(heroCandidate.imagePath, heroCandidate.item?.source ?? null, 'w1280');

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-manrope)] overflow-x-hidden">
      <HeroDebugLog
        universeSlug={universe.slug}
        universeName={universe.name}
        bannerImage={universe.bannerImage}
        coverImage={universe.coverImage}
        firstBackdropItem={heroCandidate.item ? {
          id: heroCandidate.item.id,
          title: heroCandidate.item.title,
          mediaType: heroCandidate.item.mediaType,
          source: heroCandidate.item.source,
          backdropPath: heroCandidate.item.backdropPath,
          posterPath: heroCandidate.item.posterPath,
          imageKind: heroCandidate.imageKind,
        } : null}
        resolvedHeroImage={heroImage}
      />
      <main className="pb-32">
        <section className="relative h-[716px] w-full flex items-end overflow-hidden">
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <img src={heroImage} alt={`${universe.name} hero`} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/60 to-transparent" />
          </div>
          <div className="relative z-10 px-6 md:px-12 pb-16 max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase rounded-sm">Curated Universe</span>
              {universe.creator?.name ? <span className="text-base-content/70 text-xs font-medium">by {universe.creator.name}</span> : null}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-[family-name:var(--font-epilogue)] mb-6 tracking-tight">{universe.name}</h1>
            <p className="text-lg text-base-content/80 leading-relaxed mb-8 max-w-2xl">{universe.description || 'Explore this universe timeline in release order.'}</p>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col">
                <span className="text-primary font-bold text-2xl">{universe.items.length}</span>
                <span className="text-base-content/60 text-xs uppercase tracking-widest font-bold">Titles</span>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 md:px-12 py-24 relative max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-[family-name:var(--font-epilogue)] mb-4">Release Timeline</h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
          </div>
          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent -translate-x-1/2 opacity-30" />

            {universe.items.map((item, index) => {
              const reverse = index % 2 === 1;
              const poster = toImageUrl(item.mediaItem.posterPath, item.mediaItem.source, 'w342');
              const href = getMediaHref(
                item.mediaItem.mediaType,
                item.mediaItem.externalId,
                item.mediaItem.source,
                item.mediaItem.isPlaceholder
              );
              const releaseDate = formatReleaseDate(item.mediaItem.releaseDate);
              const isTrackable = isTrackableMediaItem(item.mediaItem);
              const isUnverified = !isTrackable;
              const isWatched = isTrackable && watchedMediaIds.has(item.mediaItem.id);
              const unverifiedInputType = isUnverified ? getUnverifiedInputType(item.mediaItem.additionalData) : null;
              const mediaTypeLabel = unverifiedInputType ? formatMediaType(unverifiedInputType) : formatMediaType(item.mediaItem.mediaType);
              const description = getDisplayDescription(item.mediaItem.description, isUnverified);
              const unverifiedReason = isUnverified
                ? getUnverifiedReason(item.mediaItem.additionalData, item.mediaItem.mediaType)
                : null;

              return (
                <div key={item.id} className={`relative mb-16 md:mb-24 flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center justify-between w-full`}>
                  <div className="hidden md:block w-5/12" />
                  <div className="z-20 w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center mb-4 md:mb-0">
                    {isUnverified ? (
                      <div className="w-2 h-2 rounded-full border border-base-content/40" />
                    ) : isWatched ? (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <div className="w-full md:w-5/12 max-w-xl mx-auto md:mx-0">
                    <div className="bg-base-200/60 backdrop-blur-xl p-6 rounded-xl border border-base-content/10 hover:border-primary/30 transition-all group">
                      <span className={`text-primary text-sm font-bold tracking-tighter mb-1 block ${reverse ? 'md:text-right' : ''}`}>{releaseDate}</span>
                      <div className={`flex gap-4 ${reverse ? 'md:flex-row-reverse' : ''}`}>
                        <div className="w-24 h-36 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {href ? (
                            <Link href={href} scroll className="block h-full w-full">
                              {poster ? (
                                <img
                                  src={poster}
                                  alt={item.mediaItem.title}
                                  className="h-full w-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                                />
                              ) : (
                                <div className="h-full w-full bg-base-300" />
                              )}
                            </Link>
                          ) : poster ? (
                            <img
                              src={poster}
                              alt={item.mediaItem.title}
                              className="h-full w-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                            />
                          ) : (
                            <div className="h-full w-full bg-base-300" />
                          )}
                        </div>
                        <div className={`flex-grow ${reverse ? 'md:text-right' : ''}`}>
                          {href ? (
                            <Link href={href} scroll className="text-xl font-[family-name:var(--font-epilogue)] mb-2 group-hover:text-primary transition-colors block">
                              {item.mediaItem.title}
                            </Link>
                          ) : (
                            <h3 className="text-xl font-[family-name:var(--font-epilogue)] mb-2 group-hover:text-primary transition-colors">
                              {item.mediaItem.title}
                            </h3>
                          )}
                          <span className="inline-block px-2 py-0.5 bg-base-300 text-base-content/70 text-[10px] font-bold rounded mb-2">
                            {mediaTypeLabel}
                          </span>
                          {isUnverified ? (
                            <span className="inline-block ml-2 px-2 py-0.5 bg-warning/15 text-warning text-[10px] font-bold rounded mb-2">
                              Unverified
                            </span>
                          ) : null}
                          <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
                            {description}
                          </p>
                          {unverifiedReason ? (
                            <p className="text-xs text-warning mb-3">{unverifiedReason}</p>
                          ) : null}
                          {item.mediaItem.rating ? (
                            <div className={`flex items-center gap-2 text-yellow-500 ${reverse ? 'md:justify-end' : ''}`}>
                              <Star className="w-4 h-4" fill="currentColor" />
                              <span className="text-xs font-bold">{Number(item.mediaItem.rating).toFixed(1)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-base-200 p-8 rounded-xl border border-base-content/10">
              <BookOpen className="text-primary mb-4 w-8 h-8" />
              <h4 className="text-lg font-[family-name:var(--font-epilogue)] mb-2">Universe Notes</h4>
              <p className="text-sm text-base-content/80">Release-ordered timeline powered from your collection data.</p>
            </div>
            <div className="bg-base-200 p-8 rounded-xl border border-base-content/10">
              <Users className="text-primary mb-4 w-8 h-8" />
              <h4 className="text-lg font-[family-name:var(--font-epilogue)] mb-2">Created By</h4>
              <p className="text-sm text-base-content/80">{universe.creator?.name || 'Unknown creator'}</p>
            </div>
            <div className="bg-base-200 p-8 rounded-xl border border-base-content/10">
              <Gem className="text-primary mb-4 w-8 h-8" />
              <h4 className="text-lg font-[family-name:var(--font-epilogue)] mb-2">Collection Size</h4>
              <p className="text-sm text-base-content/80">{universe.items.length} items in this universe.</p>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
