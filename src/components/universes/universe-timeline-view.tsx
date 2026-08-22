'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ListTree, Rows3 } from 'lucide-react';
import { UniverseTimelineCard, type UniverseTimelineEntryDisplay } from '@/components/universes/universe-timeline-card';

export interface UniverseReleaseCardData {
  id: number;
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

export type UniverseMixedEntry =
  | {
      kind: 'episode';
      key: string;
      dateLabel: string;
      badge: string;
      title: string;
      seriesTitle: string;
      href: string | null;
      runtimeLabel: string | null;
      watched: boolean;
    }
  | {
      kind: 'release';
      key: string;
      dateLabel: string;
      badge: string;
      title: string;
      href: string | null;
      watched: boolean;
    };

interface UniverseTimelineViewProps {
  releaseItems: UniverseReleaseCardData[];
  mixedEntries: UniverseMixedEntry[];
  mixedCounts: { episodes: number; releases: number };
}

export function UniverseTimelineView({ releaseItems, mixedEntries, mixedCounts }: UniverseTimelineViewProps) {
  const [view, setView] = useState<'release' | 'mixed'>('release');

  return (
    <section className="px-6 md:px-12 py-24 relative max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-[family-name:var(--font-epilogue)] mb-4">Release Timeline</h2>
        <div className="h-1 w-20 bg-primary mx-auto rounded-full" />

        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-base-content/10 bg-base-200/60 p-1">
          <button
            type="button"
            onClick={() => setView('release')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
              view === 'release' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <Rows3 className="w-3.5 h-3.5" />
            Release order
          </button>
          <button
            type="button"
            onClick={() => setView('mixed')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
              view === 'mixed' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            Mixed
            <span className="text-xs opacity-70">{mixedCounts.episodes + mixedCounts.releases}</span>
          </button>
        </div>
      </div>

      {view === 'release' ? (
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent -translate-x-1/2 opacity-30" />
          {releaseItems.map((card) => (
            <UniverseTimelineCard
              key={card.id}
              reverse={card.reverse}
              releaseDateLabel={card.releaseDateLabel}
              href={card.href}
              poster={card.poster}
              title={card.title}
              mediaTypeLabel={card.mediaTypeLabel}
              isCurated={card.isCurated}
              isTrackable={card.isTrackable}
              initialStatus={card.initialStatus}
              description={card.description}
              rating={card.rating}
              mediaId={card.mediaId}
              mediaType={card.mediaType}
              posterPath={card.posterPath}
              releaseDate={card.releaseDate}
              expandedTimeline={card.expandedTimeline}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="space-y-1.5">
            {mixedEntries.map((entry) => (
              <div
                key={entry.key}
                className={`flex items-start gap-3 rounded-lg border border-base-content/10 px-4 py-2.5 transition-colors ${
                  entry.kind === 'episode'
                    ? 'bg-base-300/40 hover:border-primary/30'
                    : 'bg-primary/10 hover:border-primary/40'
                }`}
              >
                <span className="w-28 shrink-0 pt-0.5 text-xs font-bold text-base-content/60">{entry.dateLabel}</span>
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    entry.kind === 'episode' ? 'bg-base-100 text-base-content/60' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {entry.badge}
                </span>
                <div className="min-w-0 flex-1">
                  {entry.href ? (
                    <Link href={entry.href} scroll className="block truncate text-sm font-bold text-base-content hover:text-primary transition-colors">
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-bold text-base-content">{entry.title}</span>
                  )}
                  {entry.kind === 'episode' ? (
                    <span className="mt-0.5 block truncate text-xs text-base-content/50">
                      {entry.seriesTitle}
                      {entry.runtimeLabel ? ` · ${entry.runtimeLabel}` : ''}
                    </span>
                  ) : null}
                </div>
                {entry.watched ? (
                  <span className="mt-1 flex shrink-0 items-center gap-1 text-[10px] font-bold text-green-500">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
