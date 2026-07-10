'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Trash2 } from 'lucide-react';
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

  // Featured universes for the hero strip — pick 6 with the best images
  const featuredUniverses = universes
    .filter((u) => getUniverseHeroImage(u, 'w342'))
    .slice(0, 6);

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

          {/* Featured universe thumbnails strip */}
          {featuredUniverses.length > 0 && (
            <div className="mt-6 md:mt-8">
              <div className="flex gap-3 overflow-x-auto px-6 md:px-12 no-scrollbar pb-4">
                {featuredUniverses.map((universe) => {
                  const image = getUniverseHeroImage(universe, 'w342');
                  return (
                    <button
                      key={universe.id}
                      type="button"
                      onClick={() => router.push(`/universes/${universe.slug || universe.id}`)}
                      className="group shrink-0 relative w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden transition-transform hover:scale-105 duration-300"
                    >
                      {image ? (
                        <Image
                          src={image}
                          alt={universe.name}
                          fill
                          sizes="144px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <span className="text-[10px] font-bold text-white/90 leading-tight line-clamp-2">
                          {universe.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom fade to content */}
          <div className="h-12 bg-gradient-to-b from-transparent to-background" />
        </section>

        <section id="universe-grid" className="px-6 md:px-12 pt-4 pb-32">
          {error && (
            <div className="col-span-full rounded-2xl border border-error/30 bg-error/10 p-4">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {!loading && universes.map((universe, index) => {
            const variant = getVariant(index);
            const progress = universe.progress || 0;
            const image = getUniverseHeroImage(universe, 'w780');
            const trackableTotal = universe.itemsTotal || 0;
            const totalTitles = universe.totalItems || universe.items.length;
            const untrackableCount = universe.untrackableCount || 0;
            const isDeleting = deletingUniverseId === universe.id;
            return (
              <div
                key={universe.id}
                className="group glass-card flex h-full min-h-[604px] flex-col overflow-hidden rounded-3xl glow-hover transition-all duration-500 cursor-pointer"
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
                <div className="relative h-64 shrink-0 overflow-hidden">
                  {image ? (
                    <Image className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={universe.name} src={image} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
                  )}
                  {universe.canDelete && (
                    <button
                      type="button"
                      className="absolute top-4 left-4 bg-surface-container-lowest/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 text-error hover:bg-error/20 transition-colors"
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
                  <div className="absolute top-4 right-4 bg-surface-container-lowest/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="text-xs font-bold">{progress}% completed</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-2 flex min-h-[72px] items-start justify-between">
                    <h3 className={`line-clamp-2 text-2xl font-headline font-bold leading-tight text-on-surface ${variant === 'primary' ? 'group-hover:text-primary' : variant === 'secondary' ? 'group-hover:text-secondary' : 'group-hover:text-tertiary'} transition-colors`}>{universe.name}</h3>
                  </div>
                  <p className="mb-6 min-h-[40px] text-on-surface-variant text-sm line-clamp-2 font-body">{universe.description || 'No description available yet.'}</p>

                  <div className="mb-4 min-h-[76px]">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">
                      <span>Progress</span>
                      <span>
                        {trackableTotal > 0
                          ? `${universe.itemsCompleted || 0} / ${trackableTotal} Done`
                          : 'Curated only'}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-primary/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                      />
                    </div>
                    {untrackableCount > 0 && (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        +{untrackableCount} curated item{untrackableCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-outline-variant/10 pt-4">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">{totalTitles} TITLES</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/universes/${universe.slug || universe.id}`);
                      }}
                      className={`${variantTextClass(variant)} hover:translate-x-1 transition-transform flex items-center gap-1 font-bold text-sm`}
                    >
                      EXPLORE <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {canCreateUniverse ? (
            <Link href="/universes/create" className="group border-2 border-dashed border-outline-variant/30 rounded-3xl flex flex-col items-center justify-center p-12 hover:border-primary/50 transition-colors bg-surface-container-low/20">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-3xl text-primary">add</span>
              </div>
              <h3 className="text-xl font-bold font-headline mb-2">Forge New Realm</h3>
              <p className="text-on-surface-variant text-center text-sm font-body">Contribute a new universe to the archive and begin its legacy.</p>
            </Link>
          ) : null}

          {!loading && universes.length === 0 && !error && (
            <div className="col-span-full rounded-2xl border border-outline-variant/20 bg-surface-container p-8 text-center">
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
