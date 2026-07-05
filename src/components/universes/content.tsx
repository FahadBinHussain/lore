'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Trash2, Search, ArrowRight, Sparkles } from 'lucide-react';
import { isApiBackedMediaItem } from '@/lib/media/provider-support';

interface Universe {
  id: number;
  slug: string;
  name: string;
  description: string;
  bannerImage: string | null;
  coverImage: string | null;
  items: Array<{
    mediaItem: {
      id: number;
      mediaType?: string | null;
      source: string | null;
      externalId?: string | null;
      isPlaceholder?: boolean | null;
      backdropPath: string | null;
      posterPath?: string | null;
    };
  }>;
  progress?: number;
  itemsCompleted?: number;
  itemsTotal?: number;
  totalItems?: number;
  untrackableCount?: number;
  canDelete?: boolean;
}

interface UniversesContentProps {
  initialUniverses?: Universe[];
  initialCanCreateUniverse?: boolean;
}

function toImageUrl(path: string | null, source: string | null, size: 'w342' | 'w780' | 'w1280' = 'w780'): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/t/p/')) return `https://image.tmdb.org${trimmed}`;
  if (source === 'anilist' && trimmed.startsWith('/file/')) return `https://s4.anilist.co${trimmed}`;
  if (trimmed.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${trimmed}`;
  return trimmed;
}

function getDominantMediaType(items: Universe['items']): string | null {
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

function selectHeroImageCandidate(universe: Universe): { path: string | null; source: string | null } {
  const dominantType = getDominantMediaType(universe.items);
  const dominantItems = dominantType
    ? universe.items.filter((item) => item.mediaItem.mediaType === dominantType)
    : universe.items;

  const dominantBackdrop = dominantItems.find((item) => item.mediaItem.backdropPath);
  if (dominantBackdrop) {
    return { path: dominantBackdrop.mediaItem.backdropPath, source: dominantBackdrop.mediaItem.source };
  }

  const dominantPoster = dominantItems.find((item) => item.mediaItem.posterPath);
  if (dominantPoster) {
    return { path: dominantPoster.mediaItem.posterPath || null, source: dominantPoster.mediaItem.source };
  }

  const fallbackBackdrop = universe.items.find((item) => item.mediaItem.backdropPath);
  if (fallbackBackdrop) {
    return { path: fallbackBackdrop.mediaItem.backdropPath, source: fallbackBackdrop.mediaItem.source };
  }

  const fallbackPoster = universe.items.find((item) => item.mediaItem.posterPath);
  if (fallbackPoster) {
    return { path: fallbackPoster.mediaItem.posterPath || null, source: fallbackPoster.mediaItem.source };
  }

  return { path: null, source: null };
}

function getUniverseHeroImage(universe: Universe, size: 'w780' | 'w1280' = 'w780'): string | null {
  const heroCandidate = selectHeroImageCandidate(universe);
  return (
    toImageUrl(universe.bannerImage, 'tmdb', size) ||
    toImageUrl(universe.coverImage, 'tmdb', size) ||
    toImageUrl(heroCandidate.path, heroCandidate.source, size)
  );
}

function getUniversePosterImage(universe: Universe): string | null {
  const posterItem = universe.items.find((item) => item.mediaItem.posterPath);
  if (posterItem && posterItem.mediaItem.posterPath) {
    return toImageUrl(posterItem.mediaItem.posterPath, posterItem.mediaItem.source, 'w342');
  }
  return getUniverseHeroImage(universe, 'w342');
}

function getMediaTypeLabel(type: string | null): string {
  if (!type) return '';
  const map: Record<string, string> = {
    movie: 'Film',
    tv: 'Series',
    anime: 'Anime',
    game: 'Game',
    book: 'Book',
    comic: 'Comic',
    boardgame: 'Board Game',
    soundtrack: 'Music',
    podcast: 'Podcast',
    themepark: 'Experience',
  };
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

export function UniversesContent({
  initialUniverses = [],
  initialCanCreateUniverse = false,
}: UniversesContentProps) {
  const router = useRouter();
  const [universes, setUniverses] = useState<Universe[]>(initialUniverses);
  const [loading, setLoading] = useState(initialUniverses.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [deletingUniverseId, setDeletingUniverseId] = useState<number | null>(null);
  const [canCreateUniverse, setCanCreateUniverse] = useState<boolean>(initialCanCreateUniverse);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUniverses = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/universes', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch universes');
      }
      setUniverses(data.collections || []);
      if (typeof data.canCreateUniverse === 'boolean') {
        setCanCreateUniverse(data.canCreateUniverse);
      }
    } catch (err) {
      console.error('Failed to fetch universes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch universes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUniverses();
  }, [fetchUniverses]);

  useEffect(() => {
    const handlePageShow = () => fetchUniverses();
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePageShow);
    };
  }, [fetchUniverses]);

  const handleDeleteUniverse = useCallback(async (universe: Universe) => {
    const confirmed = window.confirm(`Delete "${universe.name}"?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    try {
      setError(null);
      setDeletingUniverseId(universe.id);
      const response = await fetch(`/api/universes/${universe.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete universe');
      }
      setUniverses((prev) => prev.filter((item) => item.id !== universe.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete universe');
    } finally {
      setDeletingUniverseId(null);
    }
  }, []);

  const filtered = universes.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const heroUniverse = universes.length > 0 ? universes[0] : null;
  const heroImage = heroUniverse ? getUniverseHeroImage(heroUniverse, 'w1280') : null;

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* Hero: full-bleed, no rounded container, strong image */}
      <section className="relative h-[70vh] min-h-[480px] max-h-[800px] flex items-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          {heroImage ? (
            <Image
              className="w-full h-full object-cover"
              alt={heroUniverse?.name || 'Featured universe'}
              src={heroImage}
              fill
              sizes="100vw"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-secondary/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        </div>

        <div className="relative z-10 w-full px-6 md:px-12 pb-12 md:pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary tracking-wide">Featured Universe</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tight text-foreground mb-4">
              {heroUniverse?.name || 'Universes'}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mb-8">
              {heroUniverse?.description || 'Explore interconnected worlds and track your journey through every franchise.'}
            </p>
            <div className="flex flex-wrap gap-4">
              {heroUniverse && (
                <button
                  type="button"
                  onClick={() => router.push(`/universes/${heroUniverse.slug || heroUniverse.id}`)}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Explore {heroUniverse.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <Link
                href="/search"
                className="inline-flex items-center gap-2 bg-background/80 backdrop-blur-sm text-foreground font-semibold px-6 py-3 rounded-xl border border-border hover:bg-background transition-colors"
              >
                <Search className="w-4 h-4" />
                Search media
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Search + controls */}
      <section className="px-6 md:px-12 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-headline font-bold text-foreground">All Universes</h2>
            <p className="text-sm text-muted-foreground mt-1">{universes.length} collection{universes.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter universes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 md:px-12 pb-24">
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {loading && (
            <>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
              ))}
            </>
          )}

          {!loading && filtered.map((universe) => {
            const image = getUniverseHeroImage(universe, 'w780');
            const poster = getUniversePosterImage(universe);
            const dominantType = getDominantMediaType(universe.items);
            const totalTitles = universe.totalItems || universe.items.length;
            const isDeleting = deletingUniverseId === universe.id;

            return (
              <div
                key={universe.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-muted/50 border border-border/60 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/universes/${universe.slug || universe.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    router.push(`/universes/${universe.slug || universe.id}`);
                  }
                }}
              >
                {/* Image area */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  {image ? (
                    <Image
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={universe.name}
                      src={image}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : poster ? (
                    <Image
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={universe.name}
                      src={poster}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 via-muted to-secondary/10" />
                  )}
                  {/* Bottom fade for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Top-right delete button for admins */}
                  {universe.canDelete && (
                    <button
                      type="button"
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium text-white hover:bg-destructive/80"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteUniverse(universe);
                      }}
                      disabled={isDeleting}
                      aria-label={`Delete ${universe.name}`}
                    >
                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      <span className="hidden sm:inline">{isDeleting ? 'Deleting' : 'Delete'}</span>
                    </button>
                  )}

                  {/* Type badge */}
                  {dominantType && (
                    <span className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                      {getMediaTypeLabel(dominantType)}
                    </span>
                  )}

                  {/* Title overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-lg font-headline font-bold text-white leading-snug line-clamp-2 drop-shadow-sm">
                      {universe.name}
                    </h3>
                  </div>
                </div>

                {/* Info strip */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                  <span className="text-xs font-medium text-muted-foreground">
                    {totalTitles} title{totalTitles !== 1 ? 's' : ''}
                  </span>
                  {universe.progress !== undefined && universe.progress > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, universe.progress))}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                        {universe.progress}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Create new */}
          {canCreateUniverse && !loading && (
            <Link
              href="/universes/create"
              className="group flex flex-col items-center justify-center aspect-[16/10] rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-muted/30 hover:bg-muted/50"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">New Universe</span>
              <span className="text-xs text-muted-foreground mt-1">Add a collection</span>
            </Link>
          )}
        </div>

        {!loading && filtered.length === 0 && !error && (
          <div className="mt-12 text-center">
            <p className="text-muted-foreground text-sm">
              {searchQuery ? `No universes match "${searchQuery}"` : 'No universes found.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
