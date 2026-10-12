'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  Clock,
  CircleSlash2,
  ExternalLink,
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
      rating: number | null;
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
  id: number;
  reverse: boolean;
  releaseDateLabel: string;
  href: string | null;
  /** Evidence URL stored in media_external_ids.source_url for manual items (rendered when href is null). */
  sourceUrl?: string | null;
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
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  seriesTitle?: string | null;
}

function getMediaTypeFallbackIcon(mediaType: string) {
  const iconClass = 'w-8 h-8 text-base-content/30 transition-transform duration-500 group-hover:scale-110';
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
        icon: <Clock className="w-3 h-3 animate-spin [animation-duration:8s]" />,
        className: 'badge-warning',
      };
    case 'dropped':
      return {
        label: 'Dropped',
        icon: <CircleSlash2 className="w-3 h-3 transition-transform duration-300 group-hover:rotate-45" />,
        className: 'badge-error',
      };
    case 'on_hold':
      return {
        label: 'On Hold',
        icon: <PauseCircle className="w-3 h-3 transition-transform duration-300 group-hover:scale-110" />,
        className: 'badge-info',
      };
    default:
      return null;
  }
}

export function UniverseTimelineCard({
  reverse,
  releaseDateLabel,
  href,
  sourceUrl,
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
  seasonNumber,
  episodeNumber,
  seriesTitle,
}: UniverseTimelineCardProps) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [updating, setUpdating] = useState(false);
  const watched = status === 'completed';
  const statusBadge = isTrackable && status && status !== 'completed' ? getStatusBadge(status) : null;
  const isEpisode = seasonNumber != null && episodeNumber != null;

  async function toggleWatched() {
    if (updating) return;
    const target = !watched;

    setUpdating(true);
    try {
      let ok = false;
      if (isEpisode) {
        const episodeResponse = await fetch(
          `/api/tv/${mediaId}/season/${seasonNumber}/episode/${episodeNumber}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_watched: target }),
          }
        );
        ok = episodeResponse.ok;
      } else {
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
        ok = response.ok;
      }

      if (ok) {
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
        <div className="card card-border bg-base-100 shadow-md hover:shadow-xl hover:border-primary/40 transition-all group overflow-hidden">
          <div className="card-body p-6">
            <span className={`text-primary text-sm font-bold tracking-tighter mb-1 block ${reverse ? 'md:text-right' : ''}`}>{releaseDateLabel}</span>
          <div className={`flex gap-4 ${reverse ? 'md:flex-row-reverse' : ''}`}>
            <div className="w-24 h-36 rounded-lg overflow-hidden flex-shrink-0 relative">
              {(() => {
                const posterContent = poster ? (
                  <Image
                    src={poster}
                    alt={title}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                  />
                ) : (
                  <div className="h-full w-full bg-base-300 flex items-center justify-center">
                    {getMediaTypeFallbackIcon(mediaType)}
                  </div>
                );
                if (href) {
                  return (
                    <Link href={href} scroll className="block h-full w-full">
                      {posterContent}
                    </Link>
                  );
                }
                if (sourceUrl) {
                  return (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                      {posterContent}
                    </a>
                  );
                }
                return posterContent;
              })()}
            </div>
            <div className={`flex-grow ${reverse ? 'md:text-right' : ''}`}>
              {href ? (
                <Link href={href} scroll className="text-xl font-[family-name:var(--font-epilogue)] mb-1 group-hover:text-primary transition-colors block">
                  {title}
                </Link>
              ) : sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-[family-name:var(--font-epilogue)] mb-1 group-hover:text-primary transition-colors inline-flex items-start gap-1.5"
                >
                  {title}
                  <ExternalLink className="w-4 h-4 shrink-0 self-center opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              ) : (
                <h3 className="text-xl font-[family-name:var(--font-epilogue)] mb-1 group-hover:text-primary transition-colors">
                  {title}
                </h3>
              )}
              {isEpisode && seriesTitle ? (
                <p className={`mb-2 text-xs font-bold uppercase tracking-wider text-base-content/50 ${reverse ? 'md:text-right' : ''}`}>
                  {seriesTitle}
                </p>
              ) : null}
              <div className={`mb-2 flex flex-wrap gap-1.5 items-center ${reverse ? 'md:justify-end' : ''}`}>
                <span className="badge badge-neutral badge-xs font-bold">
                  {mediaTypeLabel}
                </span>
                {isCurated ? (
                  <span className="badge badge-primary badge-xs font-bold">
                    Curated
                  </span>
                ) : null}
                {statusBadge ? (
                  <span className={`badge badge-xs font-bold gap-1 ${statusBadge.className}`}>
                    {statusBadge.icon}
                    {statusBadge.label}
                  </span>
                ) : null}
                {isTrackable ? (
                  <button
                    type="button"
                    onClick={toggleWatched}
                    disabled={updating}
                    className={`btn btn-xs gap-1 font-bold group/btn ${
                      watched
                        ? 'btn-success text-success-content'
                        : 'btn-outline border-base-content/20 text-base-content hover:btn-primary'
                    }`}
                  >
                    {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 transition-transform duration-200 group-hover/btn:scale-125" />}
                    {watched ? 'Watched' : 'Mark as watched'}
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
                {description}
              </p>
              {rating ? (
                <div className={`flex items-center gap-2 text-warning ${reverse ? 'md:justify-end' : ''}`}>
                  <Star className="w-4 h-4 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" fill="currentColor" />
                  <span className="text-xs font-bold">{rating.toFixed(1)}</span>
                </div>
              ) : null}
            </div>
          </div>
          {expandedTimeline ? (
            <details className="group/details mt-5 border-t border-base-content/10 pt-4">
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 text-left ${reverse ? 'md:text-right' : ''}`}>
                <span className={`flex min-w-0 items-center gap-2 text-sm font-bold text-base-content ${reverse ? 'md:flex-row-reverse' : ''}`}>
                  <ListTree className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover/details:scale-110" />
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
                            {entry.rating ? (
                              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-warning">
                                <Star className="w-3 h-3 fill-current" />
                                {entry.rating.toFixed(1)}
                              </span>
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
    </div>
  );
}
