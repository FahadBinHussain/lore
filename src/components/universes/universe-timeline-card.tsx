'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  Clock,
  CircleSlash2,
  PauseCircle,
  Loader2,
  ListTree,
  Star,
  Film,
  Tv,
  Gamepad2,
  BookA,
  Music,
  Podcast,
  MapPin,
  Newspaper,
  Gem,
} from 'lucide-react';

export type UniverseTimelineEntryDisplay =
  | {
      kind: 'episode';
      id: number;
      dateLabel: string;
      seasonNumber: number;
      episodeNumber: number;
      title: string;
      href: string | null;
      runtimeLabel: string | null;
    }
  | {
      kind: 'release';
      id: number;
      dateLabel: string;
      title: string;
      href: string | null;
      mediaTypeLabel: string;
      groupName: string | null;
    };

export interface UniverseTimelineCardProps {
  reverse: boolean;
  releaseDateLabel: string;
  href: string | null;
  poster: string | null;
  title: string;
  mediaTypeLabel: string;
  isCurated: boolean;
  isTrackable: boolean;
  initialStatus: string | null;
  description: string;
  rating: number | null;
  mediaId: string;
  mediaType: string;
  posterPath: string | null;
  releaseDate: string | null;
  expandedTimeline: {
    episodeCount: number;
    releaseCount: number;
    entries: UniverseTimelineEntryDisplay[];
  } | null;
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

function getStatusBadge(status: string) {
  switch (status) {
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

export function UniverseTimelineCard({
  reverse,
  releaseDateLabel,
  href,
  poster,
  title,
  mediaTypeLabel,
  isCurated,
  isTrackable,
  initialStatus,
  description,
  rating,
  mediaId,
  mediaType,
  posterPath,
  releaseDate,
  expandedTimeline,
}: UniverseTimelineCardProps) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [updating, setUpdating] = useState(false);
  const watched = status === 'completed';
  const statusBadge = isTrackable && status && status !== 'completed' ? getStatusBadge(status) : null;

  async function toggleWatched() {
    if (updating) return;
    const target = !watched;

    setUpdating(true);
    try {
      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          mediaType,
          isWatched: target,
          title,
          posterPath,
          releaseDate,
        }),
      });

      if (response.ok) {
        setStatus(target ? 'completed' : null);
      }
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className={`relative mb-16 md:mb-24 flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center justify-between w-full`}>
      <div className="hidden md:block w-5/12" />
      <div className="z-20 w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center mb-4 md:mb-0">
        {!isTrackable ? (
          <div className="w-2 h-2 rounded-full border border-base-content/40" />
        ) : watched ? (
          <div className="w-2 h-2 rounded-full bg-primary" />
        ) : null}
      </div>
      <div className="w-full md:w-5/12 max-w-xl mx-auto md:mx-0">
        <div className="bg-base-200/60 backdrop-blur-xl p-6 rounded-xl border border-base-content/10 hover:border-primary/30 transition-all group">
          <span className={`text-primary text-sm font-bold tracking-tighter mb-1 block ${reverse ? 'md:text-right' : ''}`}>{releaseDateLabel}</span>
          <div className={`flex gap-4 ${reverse ? 'md:flex-row-reverse' : ''}`}>
            <div className="w-24 h-36 rounded-lg overflow-hidden flex-shrink-0 relative">
              {href ? (
                <Link href={href} scroll className="block h-full w-full">
                  {poster ? (
                    <img
                      src={poster}
                      alt={title}
                      className="h-full w-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                    />
                  ) : (
                    <div className="h-full w-full bg-base-300 flex items-center justify-center">
                      {getMediaTypeFallbackIcon(mediaType)}
                    </div>
                  )}
                </Link>
              ) : poster ? (
                <img
                  src={poster}
                  alt={title}
                  className="h-full w-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                />
              ) : (
                <div className="h-full w-full bg-base-300 flex items-center justify-center">
                  {getMediaTypeFallbackIcon(mediaType)}
                </div>
              )}
            </div>
            <div className={`flex-grow ${reverse ? 'md:text-right' : ''}`}>
              {href ? (
                <Link href={href} scroll className="text-xl font-[family-name:var(--font-epilogue)] mb-2 group-hover:text-primary transition-colors block">
                  {title}
                </Link>
              ) : (
                <h3 className="text-xl font-[family-name:var(--font-epilogue)] mb-2 group-hover:text-primary transition-colors">
                  {title}
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
                {isTrackable ? (
                  <button
                    type="button"
                    onClick={toggleWatched}
                    disabled={updating}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                      watched
                        ? 'bg-green-500/15 text-green-500'
                        : 'bg-base-100 border border-base-content/20 text-base-content/70 hover:text-primary hover:border-primary/40'
                    }`}
                  >
                    {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {watched ? 'Watched' : 'Mark as watched'}
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
                {description}
              </p>
              {rating ? (
                <div className={`flex items-center gap-2 text-yellow-500 ${reverse ? 'md:justify-end' : ''}`}>
                  <Star className="w-4 h-4" fill="currentColor" />
                  <span className="text-xs font-bold">{rating.toFixed(1)}</span>
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
                        {entry.dateLabel}
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
                            {entry.runtimeLabel ? (
                              <span className="mt-1 block text-xs text-base-content/50">{entry.runtimeLabel}</span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                {entry.mediaTypeLabel}
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
}
