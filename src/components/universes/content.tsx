'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Trash2, Film, Tv, Clapperboard, Gamepad2, BookOpen, Library, BookA, Mic, Music, Dices, FerrisWheel, LayoutGrid, PenLine, ArrowRight, User, Plus, Lock } from 'lucide-react';
import { isApiBackedMediaItem } from '@/lib/media/provider-support';

interface Universe {
  id: number;
  slug: string;
  name: string;
  description: string;
  bannerImage: string | null;
  coverImage: string | null;
  visibility?: 'public' | 'private' | 'unlisted';
  canEdit?: boolean;
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
  creator?: {
    name: string | null;
    image: string | null;
  } | null;
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
    return {
      path: dominantBackdrop.mediaItem.backdropPath,
      source: dominantBackdrop.mediaItem.source,
    };
  }

  const dominantPoster = dominantItems.find((item) => item.mediaItem.posterPath);
  if (dominantPoster) {
    return {
      path: dominantPoster.mediaItem.posterPath || null,
      source: dominantPoster.mediaItem.source,
    };
  }

  const fallbackBackdrop = universe.items.find((item) => item.mediaItem.backdropPath);
  if (fallbackBackdrop) {
    return {
      path: fallbackBackdrop.mediaItem.backdropPath,
      source: fallbackBackdrop.mediaItem.source,
    };
  }

  const fallbackPoster = universe.items.find((item) => item.mediaItem.posterPath);
  if (fallbackPoster) {
    return {
      path: fallbackPoster.mediaItem.posterPath || null,
      source: fallbackPoster.mediaItem.source,
    };
  }

  return { path: null, source: null };
}

function getUniverseHeroImage(universe: Universe, size: 'w342' | 'w780' | 'w1280' = 'w780'): string | null {
  const heroCandidate = selectHeroImageCandidate(universe);
  return (
    toImageUrl(universe.bannerImage, 'tmdb', size) ||
    toImageUrl(universe.coverImage, 'tmdb', size) ||
    toImageUrl(heroCandidate.path, heroCandidate.source, size)
  );
}

function getMediaTypeBreakdown(items: Universe['items']): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const mt = item.mediaItem.mediaType?.trim() || 'other';
    counts.set(mt, (counts.get(mt) || 0) + 1);
  }
  return counts;
}

function mediaTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    movie: 'Movies',
    tv: 'TV',
    anime: 'Anime',
    game: 'Games',
    book: 'Books',
    comic: 'Comics',
    manga: 'Manga',
    podcast: 'Podcasts',
    soundtrack: 'Music',
    boardgame: 'Board Games',
    themepark: 'Theme Parks',
    other: 'Other',
    manual: 'Manual',
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function MediaTypeIcon({ type, className }: { type: string; className?: string }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    movie: Film,
    tv: Tv,
    anime: Clapperboard,
    game: Gamepad2,
    book: BookOpen,
    comic: Library,
    manga: BookA,
    podcast: Mic,
    soundtrack: Music,
    boardgame: Dices,
    themepark: FerrisWheel,
    other: LayoutGrid,
    manual: PenLine,
  };
  const Icon = icons[type] || LayoutGrid;
  return <Icon className={className} />;
}

function getVariant(index: number): 'primary' | 'secondary' | 'tertiary' {
  const variants: Array<'primary' | 'secondary' | 'tertiary'> = ['primary', 'secondary', 'tertiary', 'primary', 'secondary'];
  return variants[index % variants.length];
}

function variantTextClass(variant: 'primary' | 'secondary' | 'tertiary'): string {
  if (variant === 'secondary') return 'text-secondary';
  if (variant === 'tertiary') return 'text-tertiary';
  return 'text-primary';
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

  const totalUniverses = universes.length;
  const totalTitles = universes.reduce((sum, u) => sum + (u.totalItems || u.items.length), 0);

  const scrollToGrid = useCallback(() => {
    const grid = document.getElementById('universe-grid');
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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
    const handlePageShow = () => {
      fetchUniverses();
    };
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

      const response = await fetch(`/api/universes/${universe.id}`, {
        method: 'DELETE',
      });
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

  return (
    <div className="bg-background text-on-background font-body selection:bg-primary/30">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12 pt-16 pb-8 md:pt-24 md:pb-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              {/* Left: title + subtitle */}
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase mb-4">
                  <span className="h-px w-6 bg-primary" />
                  Explore the Archive
                </span>
                <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight text-on-background mb-4 leading-[0.95]">
                  The{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-tertiary">
                    Multiverse
                  </span>
                </h1>
                <p className="text-on-surface-variant text-base md:text-lg max-w-lg leading-relaxed mb-6">
                  Track every legend across interconnected worlds — movies, games, anime, and beyond.
                </p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={scrollToGrid}
                    className="inline-flex items-center gap-2 bg-primary text-on-primary-fixed font-bold px-6 py-2.5 rounded-full text-sm hover:scale-105 transition-transform"
                  >
                    Browse Universes
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {canCreateUniverse && (
                    <Link
                      href="/universes/create"
                      className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-secondary transition-colors"
                    >
                      Create New
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>

              {/* Right: live stats */}
              <div className="flex gap-8 md:gap-12">
                <div>
                  <div className="text-3xl md:text-4xl font-headline font-extrabold text-on-background">{totalUniverses}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mt-1">Universes</div>
                </div>
                <div>
                  <div className="text-3xl md:text-4xl font-headline font-extrabold text-on-background">{totalTitles.toLocaleString()}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mt-1">Titles</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom fade to content */}
          <div className="h-12 bg-gradient-to-b from-transparent to-background" />
        </section>

        <section id="universe-grid" className="px-6 md:px-12 pt-4 pb-32 max-w-7xl mx-auto">
          {error && (
            <div className="rounded-2xl border border-error/30 bg-error/10 p-4 mb-6">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-3xl overflow-hidden animate-pulse">
                  <div className="h-48 bg-surface-container-high/50" />
                  <div className="p-6 space-y-3">
                    <div className="h-6 bg-surface-container-high/50 rounded w-3/4" />
                    <div className="h-4 bg-surface-container-high/50 rounded w-full" />
                    <div className="h-4 bg-surface-container-high/50 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && universes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {universes.map((universe, index) => {
                const variant = getVariant(index);
                const progress = universe.progress || 0;
                const image = getUniverseHeroImage(universe, 'w780');
                const trackableTotal = universe.itemsTotal || 0;
                const totalTitlesCount = universe.totalItems || universe.items.length;
                const untrackableCount = universe.untrackableCount || 0;
                const isDeleting = deletingUniverseId === universe.id;
                const typeBreakdown = getMediaTypeBreakdown(universe.items);
                const creatorName = universe.creator?.name || 'Unknown';
                const creatorImage = universe.creator?.image;

                return (
                  <div
                    key={universe.id}
                    className="group glass-card flex flex-col overflow-hidden rounded-3xl glow-hover transition-all duration-500 cursor-pointer"
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
                    {/* Image Header */}
                    <div className="relative h-48 shrink-0 overflow-hidden">
                      {image ? (
                        <Image
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          alt={universe.name}
                          src={image}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                      {/* Delete button */}
                      {universe.canDelete && (
                        <button
                          type="button"
                          className="absolute top-3 left-3 bg-surface-container-lowest/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 text-error hover:bg-error/20 transition-colors"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteUniverse(universe);
                          }}
                          disabled={isDeleting}
                          aria-label={`Delete ${universe.name}`}
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          <span className="text-xs font-bold">{isDeleting ? 'Deleting' : 'Delete'}</span>
                        </button>
                      )}

                      {/* Progress badge */}
                      <div className="absolute top-3 right-3 bg-surface-container-lowest/60 backdrop-blur-md px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold">{progress}% done</span>
                      </div>

                      {/* Private badge */}
                      {universe.visibility && universe.visibility !== 'public' ? (
                        <div className="absolute top-12 right-3 bg-surface-container-lowest/60 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] font-bold uppercase tracking-tight text-amber-600">Private</span>
                        </div>
                      ) : null}

                      {/* Total titles badge */}
                      <div className="absolute bottom-3 left-3 bg-surface-container-lowest/60 backdrop-blur-md px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold uppercase tracking-tight">{totalTitlesCount} titles</span>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="flex flex-1 flex-col p-5">
                      {/* Title */}
                      <h3 className={`text-xl font-headline font-bold leading-tight text-on-surface mb-2 ${variant === 'primary' ? 'group-hover:text-primary' : variant === 'secondary' ? 'group-hover:text-secondary' : 'group-hover:text-tertiary'} transition-colors`}>
                        {universe.name}
                      </h3>

                      {/* Description */}
                      <p className="text-on-surface-variant text-sm line-clamp-2 font-body mb-4 min-h-[40px]">
                        {universe.description || 'No description available yet.'}
                      </p>

                      {/* Media Type Chips */}
                      {typeBreakdown.size > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {Array.from(typeBreakdown.entries()).slice(0, 4).map(([type, count]) => (
                            <span
                              key={type}
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight bg-surface-container-high/60 text-on-surface-variant px-2 py-1 rounded-full"
                            >
                              <MediaTypeIcon type={type} className="w-3 h-3" />
                              {count} {mediaTypeLabel(type)}
                            </span>
                          ))}
                          {typeBreakdown.size > 4 && (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-tight bg-surface-container-high/60 text-on-surface-variant px-2 py-1 rounded-full">
                              +{typeBreakdown.size - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant mb-1.5">
                          <span>Progress</span>
                          <span>
                            {trackableTotal > 0
                              ? `${universe.itemsCompleted || 0} / ${trackableTotal} done`
                              : 'Curated only'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-primary/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                          />
                        </div>
                        {untrackableCount > 0 && (
                          <p className="mt-1 text-[10px] text-on-surface-variant">
                            +{untrackableCount} curated item{untrackableCount === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>

                      {/* Footer: Creator + Explore */}
                      <div className="mt-auto flex items-center justify-between border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2">
                          {creatorImage ? (
                            <Image
                              src={creatorImage}
                              alt={creatorName}
                              width={20}
                              height={20}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                          )}
                          <span className="text-[11px] font-medium text-on-surface-variant truncate max-w-[120px]">
                            {creatorName}
                          </span>
                        </div>

                        <span className={`${variantTextClass(variant)} flex items-center gap-1 font-bold text-xs hover:translate-x-0.5 transition-transform`}>
                          Explore <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Create New Card */}
              {canCreateUniverse ? (
                <Link
                  href="/universes/create"
                  className="group border-2 border-dashed border-outline-variant/30 rounded-3xl flex flex-col items-center justify-center p-12 hover:border-primary/50 transition-colors bg-surface-container-low/20 min-h-[380px]"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold font-headline mb-2">Forge New Realm</h3>
                  <p className="text-on-surface-variant text-center text-sm font-body">Contribute a new universe to the archive and begin its legacy.</p>
                </Link>
              ) : null}
            </div>
          )}

          {!loading && universes.length === 0 && !error && (
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-8 text-center">
              <p className="text-on-surface-variant text-sm">
                No universes found right now.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
