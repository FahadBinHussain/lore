'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Trash2,
  Film,
  Tv,
  Clapperboard,
  Gamepad2,
  BookOpen,
  Library,
  BookA,
  Mic,
  Music,
  Dices,
  FerrisWheel,
  LayoutGrid,
  PenLine,
  ArrowRight,
  ArrowDown,
  User,
  Plus,
  Lock,
  Search,
  X,
  Sparkles,
  Globe2,
  Layers,
} from 'lucide-react';
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
  return <Icon className={`${className || ''} transition-transform duration-300 group-hover:scale-110`} />;
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
  const [sortBy, setSortBy] = useState<'most-titles' | 'progress' | 'alphabetical'>('most-titles');

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

  const filteredUniverses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = universes.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.description && u.description.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'progress') {
        return (b.progress || 0) - (a.progress || 0);
      }
      return (b.totalItems || b.items.length) - (a.totalItems || a.items.length);
    });

    return list;
  }, [universes, searchQuery, sortBy]);

  return (
    <div className="bg-base-100 text-base-content font-body selection:bg-primary/30 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-32">
        {/* DaisyUI Hero Component */}
        <section className="hero bg-base-200/60 rounded-3xl border border-base-200/80 p-6 sm:p-10 lg:p-12 mb-10 shadow-sm">
          <div className="hero-content flex-col lg:flex-row justify-between items-start lg:items-center w-full max-w-none p-0 gap-8">
            {/* Hero Left: title, badge, subtitle, actions */}
            <div className="max-w-2xl">
              <div className="badge badge-primary badge-soft mb-3.5 gap-1.5 font-bold uppercase tracking-wider text-xs px-3 py-2.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" /> Curated Universes & Canons
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-headline font-black tracking-tight text-base-content mb-4 leading-tight">
                The Multiverse
              </h1>
              <p className="text-base-content/70 text-base sm:text-lg max-w-xl leading-relaxed mb-6 font-normal">
                Track every legend across interconnected worlds — movies, games, anime, books, and lore.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToGrid}
                  className="btn btn-primary rounded-full px-6 text-sm shadow-md gap-2 group"
                >
                  Browse Universes
                  <ArrowDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-1" />
                </button>
                {canCreateUniverse && (
                  <Link
                    href="/universes/create"
                    className="btn btn-outline btn-primary rounded-full px-6 text-sm gap-2 group"
                  >
                    <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
                    Forge Realm
                  </Link>
                )}
              </div>
            </div>

            {/* Hero Right: DaisyUI Stats Component */}
            <div className="stats stats-vertical sm:stats-horizontal shadow-md bg-base-100 border border-base-200 rounded-2xl w-full sm:w-auto">
              <div className="stat py-4 px-6 sm:px-8 group">
                <div className="stat-figure text-primary">
                  <Globe2 className="w-8 h-8 opacity-80 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
                </div>
                <div className="stat-title text-xs font-bold uppercase tracking-wider text-base-content/70">
                  Universes
                </div>
                <div className="stat-value text-primary font-headline text-3xl sm:text-4xl">
                  {totalUniverses}
                </div>
                <div className="stat-desc text-base-content/60">Curated sagas</div>
              </div>

              <div className="stat py-4 px-6 sm:px-8 group">
                <div className="stat-figure text-secondary">
                  <Layers className="w-8 h-8 opacity-80 transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110" />
                </div>
                <div className="stat-title text-xs font-bold uppercase tracking-wider text-base-content/70">
                  Total Titles
                </div>
                <div className="stat-value text-secondary font-headline text-3xl sm:text-4xl">
                  {totalTitles.toLocaleString()}
                </div>
                <div className="stat-desc text-base-content/60">Across all media</div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Universe Grid Controls & Cards */}
        <section id="universe-grid">
          {error && (
            <div className="alert alert-error mb-6 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* DaisyUI Search + Filter + Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
            <label className="input input-bordered flex items-center gap-2.5 max-w-md w-full bg-base-100 rounded-xl shadow-sm group/search">
              <Search className="w-4 h-4 text-base-content/50 shrink-0 transition-transform duration-300 group-focus-within/search:scale-110 group-focus-within/search:text-primary" />
              <input
                type="text"
                className="grow text-sm placeholder:text-base-content/40"
                placeholder="Search universes by title, franchise..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content group/clear"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5 transition-transform duration-300 group-hover/clear:rotate-90" />
                </button>
              )}
            </label>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'most-titles' | 'progress' | 'alphabetical')}
                className="select select-bordered select-sm rounded-lg bg-base-100 font-medium text-xs text-base-content/80 shadow-sm"
              >
                <option value="most-titles">Sort: Most Titles</option>
                <option value="progress">Sort: Highest Progress</option>
                <option value="alphabetical">Sort: Alphabetical</option>
              </select>
              <span className="badge badge-neutral badge-soft text-xs font-bold px-3 py-2 rounded-lg">
                {filteredUniverses.length} shown
              </span>
            </div>
          </div>

          {/* Loading Skeletons */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card card-border bg-base-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="skeleton aspect-[16/9] w-full rounded-none" />
                  <div className="card-body p-5 space-y-3">
                    <div className="skeleton h-6 w-3/4" />
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-2 w-full mt-4" />
                    <div className="card-actions justify-between pt-3 border-t border-base-200 mt-auto">
                      <div className="skeleton h-5 w-24 rounded-full" />
                      <div className="skeleton h-5 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Universe Cards Grid */}
          {!loading && filteredUniverses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUniverses.map((universe) => {
                const progress = universe.progress || 0;
                const image = getUniverseHeroImage(universe, 'w780');
                const trackableTotal = universe.itemsTotal || 0;
                const totalTitlesCount = universe.totalItems || universe.items.length;
                const untrackableCount = universe.untrackableCount || 0;
                const isDeleting = deletingUniverseId === universe.id;
                const typeBreakdown = getMediaTypeBreakdown(universe.items);
                const creatorName = universe.creator?.name || 'Curator';
                const creatorImage = universe.creator?.image;

                return (
                  <div
                    key={universe.id}
                    className="card card-border bg-base-100 shadow-sm hover:shadow-2xl hover:border-primary/50 transition-all duration-300 cursor-pointer overflow-hidden group flex flex-col h-full"
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
                    {/* Figure with Cover Image */}
                    <figure className="relative aspect-[16/9] w-full overflow-hidden bg-base-300 shrink-0">
                      {image ? (
                        <Image
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          alt={universe.name}
                          src={image}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-base-200 to-secondary/20 flex items-center justify-center">
                          <MediaTypeIcon type="other" className="w-12 h-12 text-base-content/30 transition-transform duration-500 group-hover:scale-110" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-base-100/70 via-transparent to-black/40" />

                      {/* Top Badges */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                        <span className="badge badge-neutral badge-soft bg-base-100/90 text-base-content backdrop-blur-md shadow-sm text-xs font-bold gap-1">
                          <Layers className="w-3 h-3 transition-transform duration-300 group-hover:scale-110" />
                          {totalTitlesCount} titles
                        </span>

                        <div className="flex items-center gap-1.5">
                          {universe.visibility && universe.visibility !== 'public' ? (
                            <span className="badge badge-warning badge-soft gap-1 text-xs font-bold shadow-sm">
                              <Lock className="w-3 h-3 transition-transform duration-300 group-hover:scale-110" />
                              Private
                            </span>
                          ) : null}

                          {universe.canDelete && (
                            <button
                              type="button"
                              className="btn btn-circle btn-xs btn-error btn-soft shadow group/trash"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteUniverse(universe);
                              }}
                              disabled={isDeleting}
                              aria-label={`Delete ${universe.name}`}
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover/trash:scale-125 group-hover/trash:rotate-6" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bottom-right on image: Progress badge */}
                      <div className="absolute bottom-3 right-3">
                        <span
                          className={`badge ${
                            progress > 0 ? 'badge-primary' : 'badge-neutral'
                          } badge-soft bg-base-100/90 text-base-content backdrop-blur-md font-bold text-xs shadow-sm`}
                        >
                          {progress}% done
                        </span>
                      </div>
                    </figure>

                    {/* DaisyUI Card Body */}
                    <div className="card-body p-5 flex flex-col justify-between flex-1 gap-4">
                      <div>
                        <h2 className="card-title text-xl font-bold font-headline leading-tight text-base-content group-hover:text-primary transition-colors">
                          {universe.name}
                        </h2>
                        <p className="text-base-content/70 text-sm line-clamp-2 mt-1.5 leading-relaxed">
                          {universe.description || 'Interconnected franchise and media canon timeline.'}
                        </p>
                      </div>

                      {/* Media Breakdown Badges using DaisyUI badge-soft */}
                      {typeBreakdown.size > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(typeBreakdown.entries()).slice(0, 4).map(([type, count]) => (
                            <span
                              key={type}
                              className="badge badge-soft badge-neutral badge-sm gap-1 py-1 font-medium"
                            >
                              <MediaTypeIcon type={type} className="w-3 h-3" />
                              {count} {mediaTypeLabel(type)}
                            </span>
                          ))}
                          {typeBreakdown.size > 4 && (
                            <span className="badge badge-soft badge-neutral badge-sm py-1 font-medium">
                              +{typeBreakdown.size - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* DaisyUI Progress Component */}
                      <div className="w-full space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-medium text-base-content/70">
                          <span>Progress</span>
                          <span className="font-semibold text-base-content/90">
                            {trackableTotal > 0
                              ? `${universe.itemsCompleted || 0} / ${trackableTotal} done`
                              : `${totalTitlesCount} curated`}
                          </span>
                        </div>
                        <progress
                          className="progress progress-primary w-full h-2"
                          value={progress}
                          max="100"
                        />
                        {untrackableCount > 0 && (
                          <p className="text-[11px] text-base-content/60">
                            +{untrackableCount} curated title{untrackableCount === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>

                      {/* DaisyUI Card Actions: Creator + Explore Button */}
                      <div className="card-actions justify-between items-center border-t border-base-200 pt-3 mt-auto">
                        <div className="flex items-center gap-2">
                          {creatorImage ? (
                            <div className="avatar">
                              <div className="w-6 rounded-full ring-1 ring-base-content/20">
                                <Image
                                  src={creatorImage}
                                  alt={creatorName}
                                  width={24}
                                  height={24}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="avatar avatar-placeholder">
                              <div className="w-6 rounded-full bg-base-300 text-base-content/70 flex items-center justify-center text-xs">
                                <User className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
                              </div>
                            </div>
                          )}
                          <span className="text-xs font-medium text-base-content/70 truncate max-w-[130px]">
                            {creatorName}
                          </span>
                        </div>

                        <span className="btn btn-ghost btn-xs btn-primary gap-1 font-bold">
                          Explore <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* DaisyUI Forge New Realm Card */}
              {canCreateUniverse && (
                <Link
                  href="/universes/create"
                  className="card card-dash bg-base-200/50 hover:bg-base-200 hover:border-primary transition-all duration-300 flex flex-col items-center justify-center p-8 text-center min-h-[380px] group border-2"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all text-primary">
                    <Plus className="w-8 h-8 transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110" />
                  </div>
                  <h3 className="card-title text-xl font-bold font-headline mb-2 text-base-content group-hover:text-primary transition-colors">
                    Forge New Realm
                  </h3>
                  <p className="text-base-content/70 text-sm max-w-xs mb-5">
                    Contribute a new universe to the archive and begin its interconnected legacy.
                  </p>
                  <span className="btn btn-primary btn-sm rounded-full px-5 shadow-sm">
                    Create Universe
                  </span>
                </Link>
              )}
            </div>
          )}

          {/* Empty Search Result / Empty State */}
          {!loading && filteredUniverses.length === 0 && !error && (
            <div className="card card-border bg-base-200/40 p-12 text-center max-w-md mx-auto my-12">
              <div className="card-body items-center text-center p-0">
                <Layers className="w-12 h-12 text-base-content/30 mb-2 transition-transform duration-700 animate-pulse" />
                <h3 className="card-title text-lg font-bold">No universes found</h3>
                <p className="text-sm text-base-content/70">
                  {searchQuery
                    ? `No universes matched "${searchQuery}". Try a different keyword.`
                    : 'No universes have been forged yet.'}
                </p>
                {searchQuery && (
                  <div className="card-actions mt-4">
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="btn btn-sm btn-outline rounded-full"
                    >
                      Clear Search
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
