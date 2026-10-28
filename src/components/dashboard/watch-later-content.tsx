'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bookmark, Check, Trash2, Search, Film, Tv, Gamepad2,
  BookOpen, Zap, Clock, ArrowRight, Loader2, Sparkles, Filter
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface WatchLaterMediaItem {
  id: number;
  status: string;
  progress: number;
  mediaItem: {
    id: number;
    externalId: string;
    title: string;
    posterPath: string | null;
    releaseDate: string | null;
    rating: string | null;
    description: string | null;
    mediaType: string;
  };
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All Items' },
  { key: 'movie', label: 'Movies', icon: Film },
  { key: 'tv', label: 'TV Shows', icon: Tv },
  { key: 'anime', label: 'Anime', icon: Zap },
  { key: 'game', label: 'Games', icon: Gamepad2 },
  { key: 'book', label: 'Books', icon: BookOpen },
] as const;

function getDetailUrl(mediaType: string, externalId: string): string {
  switch (mediaType) {
    case 'movie': return `/movies/${externalId}`;
    case 'tv': return `/tv/${externalId}`;
    case 'anime': return `/anime/${externalId}`;
    case 'manga': return `/manga/${externalId}`;
    case 'game': return `/games/${externalId}`;
    case 'book': return `/books/${externalId}`;
    case 'comic': return `/comics/${externalId}`;
    case 'boardgame': return `/boardgames/${externalId}`;
    case 'soundtrack': return `/soundtracks/${externalId}`;
    case 'podcast': return `/podcasts/${externalId}`;
    case 'themepark': return `/themeparks/${externalId}`;
    default: return `/${mediaType}s/${externalId}`;
  }
}

function getMediaTypeBadge(type: string) {
  switch (type) {
    case 'movie': return { label: 'Movie', color: 'badge-primary' };
    case 'tv': return { label: 'TV Show', color: 'badge-secondary' };
    case 'anime': return { label: 'Anime', color: 'badge-accent' };
    case 'game': return { label: 'Game', color: 'badge-info' };
    case 'book': return { label: 'Book', color: 'badge-warning' };
    default: return { label: type.toUpperCase(), color: 'badge-neutral' };
  }
}

export function WatchLaterContent() {
  const [items, setItems] = useState<WatchLaterMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState<Record<number, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/media?type=watch-later', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (err) {
      console.error('Failed to fetch watch later items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleMarkAsWatched = async (item: WatchLaterMediaItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const itemId = item.id;
    setActionInProgress(prev => ({ ...prev, [itemId]: true }));

    try {
      const res = await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: item.mediaItem.externalId,
          mediaType: item.mediaItem.mediaType,
          isWatched: true,
          title: item.mediaItem.title,
          posterPath: item.mediaItem.posterPath,
          releaseDate: item.mediaItem.releaseDate,
        }),
      });

      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== itemId));
      }
    } catch (err) {
      console.error('Failed to mark item as watched:', err);
    } finally {
      setActionInProgress(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleRemoveFromWatchLater = async (item: WatchLaterMediaItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const itemId = item.id;
    setActionInProgress(prev => ({ ...prev, [itemId]: true }));

    try {
      const res = await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: item.mediaItem.externalId,
          mediaType: item.mediaItem.mediaType,
          isWatchLater: false,
        }),
      });

      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== itemId));
      }
    } catch (err) {
      console.error('Failed to remove item from watch later:', err);
    } finally {
      setActionInProgress(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesType = activeType === 'all' || item.mediaItem.mediaType === activeType;
      const matchesSearch = searchQuery.trim() === '' ||
        item.mediaItem.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesType && matchesSearch;
    });
  }, [items, activeType, searchQuery]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      const t = item.mediaItem.mediaType;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center border border-secondary/25">
                <Bookmark className="w-5 h-5 text-secondary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-[family-name:var(--font-epilogue)]">
                Watch Later
              </h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'} saved to watch, read, and explore next.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
            disabled={loading}
            className="self-start sm:self-auto gap-2 group"
          >
            <Clock className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Controls: Search & Category Chips */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-200 group-focus-within:scale-110" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your saved titles..."
            className="input input-bordered w-full pl-10 text-sm bg-base-100 rounded-xl border-border/50 focus:border-secondary"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 items-center">
          {TYPE_FILTERS.map((f) => {
            const count = typeCounts[f.key] || 0;
            const Icon = 'icon' in f ? f.icon : null;
            const isActive = activeType === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveType(f.key)}
                className={`btn btn-sm rounded-xl font-medium transition-all duration-200 gap-1.5 group ${
                  isActive
                    ? 'btn-secondary text-secondary-content shadow-sm'
                    : 'btn-ghost bg-base-200/60 hover:bg-base-200 text-base-content border border-border/40'
                }`}
              >
                {Icon && (
                  <Icon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                )}
                <span>{f.label}</span>
                <span className={`text-xs ml-0.5 px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-secondary-content/20' : 'bg-base-300/80 text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border border-border/40 bg-card/50">
              <div className="aspect-[2/3] skeleton rounded-t-xl" />
              <div className="p-3.5 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredItems.map((item) => {
            const badge = getMediaTypeBadge(item.mediaItem.mediaType);
            const isActing = actionInProgress[item.id];
            const detailUrl = getDetailUrl(item.mediaItem.mediaType, item.mediaItem.externalId);
            const hasPoster = item.mediaItem.posterPath && !imageErrors[item.id];

            return (
              <Card
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 hover:border-secondary/40 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <Link href={detailUrl} className="block relative aspect-[2/3] overflow-hidden bg-muted/60 rounded-t-2xl">
                    {hasPoster ? (
                      <Image
                        src={item.mediaItem.posterPath!}
                        alt={item.mediaItem.title}
                        fill
                        sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-muted/80 to-muted/30">
                        <Bookmark className="w-8 h-8 mb-2 text-muted-foreground/40 group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-xs font-medium text-muted-foreground line-clamp-2">
                          {item.mediaItem.title}
                        </span>
                      </div>
                    )}

                    {/* Media Type Badge */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className={`badge ${badge.color} badge-sm font-semibold shadow-md backdrop-blur-md`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Quick Bookmark Pill */}
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <span className="badge badge-secondary badge-sm gap-1 shadow-md">
                        <Bookmark className="w-3 h-3 fill-current" />
                      </span>
                    </div>
                  </Link>

                  {/* Title and metadata */}
                  <div className="p-3 sm:p-4">
                    <Link href={detailUrl} className="block">
                      <h3 className="font-bold text-xs sm:text-sm line-clamp-2 group-hover:text-secondary transition-colors duration-200">
                        {item.mediaItem.title}
                      </h3>
                    </Link>
                    {item.mediaItem.releaseDate && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(item.mediaItem.releaseDate).getFullYear()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Quick Action Buttons */}
                <div className="p-3 sm:p-4 pt-0 flex items-center gap-1.5 border-t border-border/20 mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleMarkAsWatched(item, e)}
                    disabled={isActing}
                    className="flex-1 h-8 text-xs gap-1.5 group/watch hover:border-success hover:text-success"
                    title="Mark as Watched"
                  >
                    {isActing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 transition-transform duration-200 group-hover/watch:scale-125" />
                    )}
                    <span>Watched</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleRemoveFromWatchLater(item, e)}
                    disabled={isActing}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-error hover:bg-error/10 group/del"
                    title="Remove from Watch Later"
                  >
                    <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover/del:scale-125" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 sm:py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-secondary/15 border border-secondary/30 flex items-center justify-center mx-auto mb-4 group cursor-pointer">
            <Bookmark className="w-8 h-8 text-secondary transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-epilogue)] mb-2">
            {searchQuery ? 'No matching items found' : 'Your watch later list is empty'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {searchQuery
              ? `No titles match "${searchQuery}". Try a different search term or filter.`
              : 'Save movies, tv shows, anime, games, and books you want to experience next by clicking "Watch Later" on any title!'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/universes" className="btn btn-secondary btn-sm rounded-xl gap-2 group">
              <Sparkles className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
              Explore Universes
            </Link>
            <Link href="/movies" className="btn btn-outline btn-sm rounded-xl gap-2 group">
              <Film className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              Browse Movies
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
