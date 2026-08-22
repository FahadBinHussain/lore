'use client';

import { useState } from 'react';
import { UniverseTimelineCard, type UniverseTimelineCardProps } from '@/components/universes/universe-timeline-card';

interface UniverseTimelineViewProps {
  releaseItems: UniverseTimelineCardProps[];
  mixedItems: UniverseTimelineCardProps[];
}

export function UniverseTimelineView({ releaseItems, mixedItems }: UniverseTimelineViewProps) {
  const [view, setView] = useState<'release' | 'mixed'>('mixed');
  const items = view === 'release' ? releaseItems : mixedItems;

  return (
    <section className="px-6 md:px-12 py-24 relative max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-[family-name:var(--font-epilogue)] mb-4">
          {view === 'release' ? 'Release Timeline' : 'Mixed Timeline'}
        </h2>
        <div className="h-1 w-20 bg-primary mx-auto rounded-full" />

        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-base-content/10 bg-base-200/60 p-1">
          <button
            type="button"
            onClick={() => setView('release')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
              view === 'release' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            Release order
            <span className="text-xs opacity-70">{releaseItems.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setView('mixed')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
              view === 'mixed' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            Mixed
            <span className="text-xs opacity-70">{mixedItems.length}</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent -translate-x-1/2 opacity-30" />
        {items.map((card) => (
          <UniverseTimelineCard
            key={card.id}
            id={card.id}
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
            seasonNumber={card.seasonNumber}
            episodeNumber={card.episodeNumber}
            seriesTitle={card.seriesTitle}
          />
        ))}
      </div>
    </section>
  );
}