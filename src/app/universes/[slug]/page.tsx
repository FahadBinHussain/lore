import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, inArray, or } from 'drizzle-orm';
import { Star, BookOpen, Users, Gem, ChevronDown, ListTree, Film, Tv, Gamepad2, BookA, Music, Podcast, MapPin, Newspaper, Check, Clock, CircleSlash2, PauseCircle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collectionItems, collections, episodes as episodesTable, seasons, userMediaProgress, users } from '@/db/schema';
import { HeroDebugLog } from '@/components/universes/hero-debug-log';
import { getMediaDetailHref, getTimelineItemState, isApiBackedMediaItem } from '@/lib/media/provider-support';

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

interface TimelineMediaItem {
  id: number;
  title: string;
  mediaType: string;
  source: string;
  externalId: string;
  releaseDate: Date | string | null;
  isPlaceholder?: boolean | null;
}

type ExpandedEpisodeEntry = {
  kind: 'episode';
  id: number;
  dateKey: string;
  sortOrder: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  href: string | null;
  airDate: Date | string | null;
  runtime: number | null;
};

type ExpandedReleaseEntry = {
  kind: 'release';
  id: number;
  dateKey: string;
  sortOrder: number;
  title: string;
  mediaType: string;
  href: string | null;
  releaseDate: Date | string | null;
  groupName: string | null;
};

type ExpandedTimelineEntry = ExpandedEpisodeEntry | ExpandedReleaseEntry;

interface ExpandedSeriesTimeline {
  episodeCount: number;
  releaseCount: number;
  firstDate: Date | string | null;
  lastDate: Date | string | null;
  entries: ExpandedTimelineEntry[];
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

function getMediaTypeFallbackIcon(mediaType: string) {
  const iconClass = 'w-8 h-8 text-base-content/30';
  switch (mediaType) {
    case 'movie': return <Film className={iconClass} />;
    case 'tv': return <Tv className={iconClass} />;
    case 'anime': return <Tv className={iconClass} />;
    case 'game': return <Gamepad2 className={iconClass} />;
    case 'book': return <BookA className={iconClass} />;
    case 'comic': return <BookA className={iconClass} />;
    case 'manga': return <BookA className={iconClass} />;
    case 'soundtrack': return <Music className={iconClass} />;
    case 'podcast': return <Podcast className={iconClass} />;
    case 'boardgame': return <Gem className={iconClass} />;
    case 'themepark': return <MapPin className={iconClass} />;
    default: return <Newspaper className={iconClass} />;
  }
}

function getDominantMediaType(
  items: Array<{
    mediaItem: {
      mediaType: string | null;
      source: string | null;
      externalId?: string | null;
      isPlaceholder?: boolean | null;
    };
  }>
): string | null {
  const counts = new Map<string, number>();

  for (const item of items) {
    const mediaType = item.mediaItem.mediaType?.trim();
    if (!mediaType) continue;
    if (!isApiBackedMediaItem(item.mediaItem)) continue;
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
      externalId: string;
      isPlaceholder?: boolean | null;
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

function toDateKey(value: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 10) : null;
  }

  if (Number.isNaN(value.getTime())) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareDateKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isSeriesMediaItem(mediaItem: { mediaType?: string | null }): boolean {
  const type = mediaItem.mediaType?.trim().toLowerCase();
  return type === 'anime' || type === 'tv';
}

function formatRuntime(runtime: number | null): string | null {
  if (!runtime) return null;
  return `${runtime} min`;
}

function getEpisodeDetailHref(
  mediaItem: TimelineMediaItem,
  seasonNumber: number,
  episodeNumber: number
): string | null {
  if (!isApiBackedMediaItem(mediaItem)) return null;

  const externalId = mediaItem.externalId?.trim();
  if (!externalId) return null;

  const season = encodeURIComponent(String(seasonNumber));
  const episode = encodeURIComponent(String(episodeNumber));
  const id = encodeURIComponent(externalId);

  switch (mediaItem.mediaType?.trim().toLowerCase()) {
    case 'tv':
      return `/tv/${id}/season/${season}/episode/${episode}`;
    case 'anime':
      return `/anime/${id}/season/${season}/episode/${episode}`;
    default:
      return null;
  }
}

function getCuratedInputType(additionalData: unknown): string | null {
  if (!additionalData || typeof additionalData !== 'object' || Array.isArray(additionalData)) {
    return null;
  }

  const metadata = additionalData as Record<string, unknown>;
  const curated = metadata.curated ?? metadata.unresolved;
  if (!curated || typeof curated !== 'object' || Array.isArray(curated)) {
    return null;
  }

  const rawType = (curated as Record<string, unknown>).inputType;
  if (typeof rawType !== 'string') return null;
  const trimmed = rawType.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getDisplayDescription(description: string | null): string {
  return description || 'No description available yet.';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return {
        label: 'Watched',
        icon: <Check className="w-3 h-3" />,
        className: 'bg-green-500/15 text-green-500',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-amber-500/15 text-amber-500',
      };
    case 'dropped':
      return {
        label: 'Dropped',
        icon: <CircleSlash2 className="w-3 h-3" />,
        className: 'bg-red-500/15 text-red-500',
      };
    case 'on_hold':
      return {
        label: 'On Hold',
        icon: <PauseCircle className="w-3 h-3" />,
        className: 'bg-blue-500/15 text-blue-500',
      };
    default:
      return null;
  }
}

export default async function Page({ params }: UniversePageProps) {
  const session = await auth();

  let userId = Number.parseInt(session?.user?.id || '', 10);
  if (!Number.isFinite(userId) && session?.user?.email) {
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

  const seriesMediaItemIds = universe.items
    .map((item) => item.mediaItem)
    .filter(isSeriesMediaItem)
    .map((mediaItem) => mediaItem.id);

  const seriesSeasons =
    seriesMediaItemIds.length > 0
      ? await db.query.seasons.findMany({
          where: and(inArray(seasons.mediaItemId, seriesMediaItemIds), inArray(seasons.source, ['tmdb', 'anilist'])),
          orderBy: [seasons.mediaItemId, seasons.seasonNumber],
          with: {
            episodes: {
              orderBy: [episodesTable.episodeNumber],
            },
          },
        })
      : [];

  const seasonsByMediaItemId = new Map<number, typeof seriesSeasons>();
  for (const season of seriesSeasons) {
    const current = seasonsByMediaItemId.get(season.mediaItemId) || [];
    current.push(season);
    seasonsByMediaItemId.set(season.mediaItemId, current);
  }

  const expandedTimelinesByMediaItemId = new Map<number, ExpandedSeriesTimeline>();
  for (const item of universe.items) {
    const mediaItem = item.mediaItem as TimelineMediaItem;
    const matchedSeasons = seasonsByMediaItemId.get(mediaItem.id) || [];
    const episodeEntries: ExpandedEpisodeEntry[] = matchedSeasons
      .flatMap((season) =>
        season.episodes.flatMap((episode) => {
          const dateKey = toDateKey(episode.airDate);
          if (!dateKey) return [];
          const entry: ExpandedEpisodeEntry = {
            kind: 'episode' as const,
            id: episode.id,
            dateKey,
            sortOrder: season.seasonNumber * 10000 + episode.episodeNumber * 10,
            seasonNumber: season.seasonNumber,
            episodeNumber: episode.episodeNumber,
            title: episode.name,
            href: getEpisodeDetailHref(mediaItem, season.seasonNumber, episode.episodeNumber),
            airDate: episode.airDate,
            runtime: episode.runtime,
          };
          return [entry];
        })
      );

    if (episodeEntries.length === 0) continue;

    const sortedEpisodes = [...episodeEntries].sort((a, b) => {
      const dateDiff = compareDateKeys(a.dateKey, b.dateKey);
      return dateDiff !== 0 ? dateDiff : a.sortOrder - b.sortOrder;
    });
    const firstDateKey = sortedEpisodes[0]?.dateKey;
    const lastDateKey = sortedEpisodes[sortedEpisodes.length - 1]?.dateKey;
    if (!firstDateKey || !lastDateKey) continue;

    const releaseEntries: ExpandedReleaseEntry[] = universe.items
      .filter((timelineItem) => timelineItem.mediaItem.id !== mediaItem.id)
      .flatMap((timelineItem) => {
        const releaseDateKey = toDateKey(timelineItem.mediaItem.releaseDate);
        if (!releaseDateKey || releaseDateKey < firstDateKey || releaseDateKey > lastDateKey) {
          return [];
        }

        const entry: ExpandedReleaseEntry = {
          kind: 'release' as const,
          id: timelineItem.id,
          dateKey: releaseDateKey,
          sortOrder: timelineItem.releaseOrder * 10 + 5,
          title: timelineItem.mediaItem.title,
          mediaType: timelineItem.mediaItem.mediaType,
          href: getMediaDetailHref(timelineItem.mediaItem),
          releaseDate: timelineItem.mediaItem.releaseDate,
          groupName: timelineItem.groupName,
        };
        return [entry];
      });

    const entries = [...sortedEpisodes, ...releaseEntries].sort((a, b) => {
      const dateDiff = compareDateKeys(a.dateKey, b.dateKey);
      return dateDiff !== 0 ? dateDiff : a.sortOrder - b.sortOrder;
    });

    expandedTimelinesByMediaItemId.set(mediaItem.id, {
      episodeCount: episodeEntries.length,
      releaseCount: releaseEntries.length,
      firstDate: sortedEpisodes[0].airDate,
      lastDate: sortedEpisodes[sortedEpisodes.length - 1].airDate,
      entries,
    });
  }

  const trackableMediaItemIds = universe.items
    .map((item) => item.mediaItem)
    .filter((mediaItem) => isApiBackedMediaItem(mediaItem))
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
  const statusByMediaItemId = new Map(progressRows.map((row) => [row.mediaItemId, row.status]));
  const watchedCount = universe.items.filter((item) => isApiBackedMediaItem(item.mediaItem) && watchedMediaIds.has(item.mediaItem.id)).length;

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
              {watchedCount > 0 ? (
                <div className="flex flex-col">
                  <span className="text-green-500 font-bold text-2xl">{watchedCount}</span>
                  <span className="text-base-content/60 text-xs uppercase tracking-widest font-bold">Watched</span>
                </div>
              ) : null}
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
              const href = getMediaDetailHref(item.mediaItem);
              const releaseDate = formatReleaseDate(item.mediaItem.releaseDate);
              const itemState = getTimelineItemState(item.mediaItem);
              const isTrackable = itemState === 'trackable';
              const isCurated = itemState === 'curated';
              const isWatched = isTrackable && watchedMediaIds.has(item.mediaItem.id);
              const statusBadge = isTrackable ? getStatusBadge(statusByMediaItemId.get(item.mediaItem.id) || '') : null;
              const expandedTimeline = expandedTimelinesByMediaItemId.get(item.mediaItem.id);
              const curatedInputType = !isTrackable ? getCuratedInputType(item.mediaItem.additionalData) : null;
              const mediaTypeLabel = curatedInputType ? formatMediaType(curatedInputType) : formatMediaType(item.mediaItem.mediaType);
              const description = getDisplayDescription(item.mediaItem.description);

              return (
                <div key={item.id} className={`relative mb-16 md:mb-24 flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center justify-between w-full`}>
                  <div className="hidden md:block w-5/12" />
                  <div className="z-20 w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center mb-4 md:mb-0">
                    {!isTrackable ? (
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
                                <div className="h-full w-full bg-base-300 flex items-center justify-center">
                                  {getMediaTypeFallbackIcon(item.mediaItem.mediaType)}
                                </div>
                              )}
                            </Link>
                          ) : poster ? (
                            <img
                              src={poster}
                              alt={item.mediaItem.title}
                              className="h-full w-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                            />
                          ) : (
                            <div className="h-full w-full bg-base-300 flex items-center justify-center">
                              {getMediaTypeFallbackIcon(item.mediaItem.mediaType)}
                            </div>
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
                          <div className={`mb-2 flex flex-wrap gap-2 ${reverse ? 'md:justify-end' : ''}`}>
                            <span className="inline-block px-2 py-0.5 bg-base-300 text-base-content/70 text-[10px] font-bold rounded">
                              {mediaTypeLabel}
                            </span>
                            {isCurated ? (
                              <span className="inline-block px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-bold rounded">
                                Curated
                              </span>
                            ) : null}
                            {statusBadge ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${statusBadge.className}`}>
                                {statusBadge.icon}
                                {statusBadge.label}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
                            {description}
                          </p>
                          {item.mediaItem.rating ? (
                            <div className={`flex items-center gap-2 text-yellow-500 ${reverse ? 'md:justify-end' : ''}`}>
                              <Star className="w-4 h-4" fill="currentColor" />
                              <span className="text-xs font-bold">{Number(item.mediaItem.rating).toFixed(1)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {expandedTimeline ? (
                        <details className="group/details mt-5 border-t border-base-content/10 pt-4">
                          <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 text-left ${reverse ? 'md:text-right' : ''}`}>
                            <span className={`flex min-w-0 items-center gap-2 text-sm font-bold text-base-content ${reverse ? 'md:flex-row-reverse' : ''}`}>
                              <ListTree className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate">Expanded airing window</span>
                            </span>
                            <span className={`flex shrink-0 items-center gap-2 text-xs font-bold text-base-content/60 ${reverse ? 'md:flex-row-reverse' : ''}`}>
                              {expandedTimeline.episodeCount} episodes
                              {expandedTimeline.releaseCount > 0 ? ` + ${expandedTimeline.releaseCount} releases` : ''}
                              <ChevronDown className="h-4 w-4 transition-transform group-open/details:rotate-180" />
                            </span>
                          </summary>
                          <div className="mt-4 max-h-[520px] overflow-y-auto pr-1">
                            <div className="space-y-1.5">
                              {expandedTimeline.entries.map((entry) => (
                                <div
                                  key={`${entry.kind}-${entry.id}`}
                                  className={`grid grid-cols-[108px_minmax(0,1fr)] items-start gap-3 rounded-md px-3 py-2 text-sm ${entry.kind === 'release' ? 'bg-primary/10 text-base-content' : 'bg-base-300/40 text-base-content/80'}`}
                                >
                                  <span className="text-xs font-bold text-base-content/60">
                                    {formatReleaseDate(entry.kind === 'episode' ? entry.airDate : entry.releaseDate)}
                                  </span>
                                  <div className="min-w-0">
                                    {entry.kind === 'episode' ? (
                                      <>
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className="shrink-0 rounded bg-base-100 px-1.5 py-0.5 text-[10px] font-bold text-base-content/60">
                                            S{entry.seasonNumber} EP {entry.episodeNumber}
                                          </span>
                                          {entry.href ? (
                                            <Link href={entry.href} scroll className="truncate font-medium text-primary hover:underline">
                                              {entry.title}
                                            </Link>
                                          ) : (
                                            <span className="truncate font-medium">{entry.title}</span>
                                          )}
                                        </div>
                                        {formatRuntime(entry.runtime) ? (
                                          <span className="mt-1 block text-xs text-base-content/50">{formatRuntime(entry.runtime)}</span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                            {formatMediaType(entry.mediaType)}
                                          </span>
                                          {entry.href ? (
                                            <Link href={entry.href} scroll className="truncate font-bold text-primary hover:underline">
                                              {entry.title}
                                            </Link>
                                          ) : (
                                            <span className="truncate font-bold text-primary">{entry.title}</span>
                                          )}
                                        </div>
                                        {entry.groupName ? (
                                          <span className="mt-1 block text-xs text-base-content/50">{entry.groupName}</span>
                                        ) : null}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      ) : null}
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
