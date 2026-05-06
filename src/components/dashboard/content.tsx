'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Music,
  Podcast,
  MapPin,
  Zap,
  Upload,
  ArrowRight,
  TrendingUp,
  Clock,
  Star,
  Activity,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImportModal, type ImportItem, type TraktImportType } from './import-modal';

const ThreeBackground = dynamic(
  () => import('./three-background').then((mod) => ({ default: mod.ThreeBackground })),
  { ssr: false }
);

interface AniListSearchResult {
  id: number;
  title?: string;
  englishTitle?: string | null;
  nativeTitle?: string | null;
  seasonYear?: number | null;
}

const categories = [
  { name: 'Movies', href: '/dashboard/movies', icon: Film, accent: '#8b5cf6', description: 'Track your favorite films', gradient: 'from-violet-600/20 to-violet-900/10' },
  { name: 'TV Shows', href: '/dashboard/tv', icon: Tv, accent: '#06b6d4', description: 'Follow your series', gradient: 'from-cyan-600/20 to-cyan-900/10' },
  { name: 'Anime', href: '/dashboard/anime', icon: Zap, accent: '#ec4899', description: 'Discover anime', gradient: 'from-pink-600/20 to-pink-900/10' },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, accent: '#f59e0b', description: 'Track your games', gradient: 'from-amber-600/20 to-amber-900/10' },
  { name: 'Books', href: '/dashboard/books', icon: BookOpen, accent: '#10b981', description: 'Track your reading', gradient: 'from-emerald-600/20 to-emerald-900/10' },
  { name: 'Comics', href: '/dashboard/comics', icon: Sparkles, accent: '#a855f7', description: 'Follow your comics', gradient: 'from-purple-600/20 to-purple-900/10' },
  { name: 'Board Games', href: '/dashboard/boardgames', icon: Gamepad2, accent: '#f97316', description: 'Track tabletop games', gradient: 'from-orange-600/20 to-orange-900/10' },
  { name: 'Soundtracks', href: '/dashboard/soundtracks', icon: Music, accent: '#14b8a6', description: 'Discover music', gradient: 'from-teal-600/20 to-teal-900/10' },
  { name: 'Podcasts', href: '/dashboard/podcasts', icon: Podcast, accent: '#ef4444', description: 'Follow podcasts', gradient: 'from-red-600/20 to-red-900/10' },
  { name: 'Theme Parks', href: '/dashboard/themeparks', icon: MapPin, accent: '#84cc16', description: 'Plan your visits', gradient: 'from-lime-600/20 to-lime-900/10' },
];

function normalizeTitleForMatch(value?: string | null): string {
  if (!value) return '';
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function pickBestAniListMatch(
  results: AniListSearchResult[],
  queryTitle: string,
  queryYear?: number
): AniListSearchResult | null {
  if (results.length === 0) return null;

  const normalizedQuery = normalizeTitleForMatch(queryTitle);

  const scored = results.map((result) => {
    const candidateTitles = [result.title, result.englishTitle, result.nativeTitle].filter(
      (title): title is string => typeof title === 'string' && title.length > 0
    );

    let score = 0;
    for (const title of candidateTitles) {
      const normalizedCandidate = normalizeTitleForMatch(title);
      if (!normalizedQuery || !normalizedCandidate) continue;

      if (normalizedCandidate === normalizedQuery) {
        score += 100;
      } else if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
        score += 40;
      }
    }

    if (typeof queryYear === 'number' && typeof result.seasonYear === 'number') {
      const yearDiff = Math.abs(result.seasonYear - queryYear);
      if (yearDiff === 0) score += 20;
      else if (yearDiff === 1) score += 10;
    }

    return { result, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.result ?? results[0] ?? null;
}

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span ref={ref}>{count}</span>;
}

export function DashboardContent() {
  const [greeting, setGreeting] = useState('Hello');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<TraktImportType>('watched-movies');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    setMounted(true);
  }, []);

  const openImportModal = (type: TraktImportType) => {
    setImportType(type);
    setImportModalOpen(true);
  };

  const handleImport = async (selectedItems: ImportItem[]) => {
    try {
      const animeIdCache = new Map<string, number | null>();

      const resolveAniListId = async (item: ImportItem): Promise<number | null> => {
        if (typeof item.animeId === 'number') return item.animeId;

        const queryTitle = item.show?.title ?? item.tmdbData?.name;
        if (!queryTitle) return null;

        const firstAirYear = Number.parseInt((item.tmdbData?.first_air_date ?? '').slice(0, 4), 10);
        const queryYear = item.show?.year ?? (Number.isNaN(firstAirYear) ? undefined : firstAirYear);
        const cacheKey = `${queryTitle}:${queryYear ?? ''}`;

        if (animeIdCache.has(cacheKey)) {
          return animeIdCache.get(cacheKey) ?? null;
        }

        try {
          const response = await fetch(`/api/search/anilist?q=${encodeURIComponent(queryTitle)}`);
          if (!response.ok) {
            animeIdCache.set(cacheKey, null);
            return null;
          }

          const data = (await response.json()) as { results?: AniListSearchResult[] };
          const results = Array.isArray(data.results) ? data.results : [];
          const best = pickBestAniListMatch(results, queryTitle, queryYear);
          const resolvedId = best?.id ?? null;
          animeIdCache.set(cacheKey, resolvedId);
          return resolvedId;
        } catch {
          animeIdCache.set(cacheKey, null);
          return null;
        }
      };

      for (const item of selectedItems) {
        if (item.type === 'episode') {
          const showTmdbId = item.show?.ids.tmdb;
          const seasonNumber = item.episode?.season;
          const episodeNumber = item.episode?.number;

          if (typeof seasonNumber !== 'number' || typeof episodeNumber !== 'number') {
            continue;
          }

          const shouldImportAsAnime = item.importTarget === 'anime' || item.isJapaneseAnimationEpisode;

          if (shouldImportAsAnime) {
            const animeId = await resolveAniListId(item);
            if (typeof animeId !== 'number') {
              console.error(
                'Failed to resolve AniList ID for JP animation episode:',
                item.show?.title,
                `S${seasonNumber}E${episodeNumber}`
              );
              continue;
            }

            const animeEpisodeResponse = await fetch(
              `/api/anime/${animeId}/season/${seasonNumber}/episode/${episodeNumber}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  is_watched: true,
                  watched_at: item.watched_at,
                  title: item.show?.title ?? item.tmdbData?.name,
                  posterPath: item.tmdbData?.poster_path,
                  releaseDate: item.tmdbData?.first_air_date,
                  totalEpisodes: item.show?.aired_episodes,
                }),
              }
            );

            if (!animeEpisodeResponse.ok) {
              console.error(
                'Failed to add anime episode progress for',
                item.show?.title,
                `S${seasonNumber}E${episodeNumber}`
              );
            }

            continue;
          }

          if (typeof showTmdbId !== 'number') {
            continue;
          }

          const tvEpisodeResponse = await fetch(
            `/api/tv/${showTmdbId}/season/${seasonNumber}/episode/${episodeNumber}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                is_watched: true,
                watched_at: item.watched_at,
              }),
            }
          );

          if (!tvEpisodeResponse.ok) {
            console.error('Failed to add episode progress for', item.show?.title, `S${seasonNumber}E${episodeNumber}`);
          }

          continue;
        }

        const tmdbId = item.movie?.ids.tmdb;
        if (typeof tmdbId !== 'number') continue;

        const externalId = tmdbId.toString();
        const normalizedTitle = item.tmdbData?.title ?? item.tmdbData?.name ?? item.movie?.title ?? 'Untitled';
        const normalizedReleaseDate = item.tmdbData?.release_date ?? item.tmdbData?.first_air_date;

        const ensureResponse = await fetch('/api/media/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalId,
            mediaType: 'movie',
            title: normalizedTitle,
            posterPath: item.tmdbData?.poster_path,
            backdropPath: item.tmdbData?.backdrop_path,
            releaseDate: normalizedReleaseDate,
            rating: item.tmdbData?.vote_average,
            description: item.tmdbData?.overview,
            genres: item.tmdbData?.genres?.map((g) => g.name) || [],
            runtime: item.tmdbData?.runtime,
            tagline: item.tmdbData?.tagline,
            popularity: item.tmdbData?.popularity,
            source: 'tmdb',
          }),
        });

        if (!ensureResponse.ok) {
          console.error('Failed to ensure media item for', normalizedTitle);
          continue;
        }

        const { id: mediaItemId } = await ensureResponse.json();

        const progressResponse = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaItemId,
            status: 'completed',
            currentProgress: 0,
            completedAt: item.watched_at,
          }),
        });

        if (!progressResponse.ok) {
          console.error('Failed to add progress for', normalizedTitle);
        }
      }

      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import some items. Please try again.');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#06060a' }}>
      <ThreeBackground />

      {/* Radial glow overlays */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/[0.03] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-900/[0.03] rounded-full blur-[140px]" />
      </div>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">

          {/* Hero Greeting Section */}
          <div
            className="mb-12 sm:mb-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-violet-500/40" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-violet-400/60 font-medium font-[var(--font-manrope)]">
                Command Center
              </span>
              <div className="h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-violet-500/40" />
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-3"
              style={{ fontFamily: 'var(--font-epilogue), Epilogue, sans-serif', color: '#f0eef5' }}
            >
              {greeting}
              <span className="text-violet-400">.</span>
            </h1>

            <p
              className="text-base sm:text-lg max-w-xl"
              style={{ color: '#7a7880', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}
            >
              Your media universe at a glance. Track, discover, and organize everything you love.
            </p>
          </div>

          {/* Stats Row */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-12 sm:mb-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
            }}
          >
            {[
              { label: 'Categories', value: 10, icon: Layers, color: '#8b5cf6' },
              { label: 'Integrations', value: 4, icon: Activity, color: '#06b6d4' },
              { label: 'Import Sources', value: 2, icon: TrendingUp, color: '#f59e0b' },
              { label: 'AI Powered', value: 1, icon: Star, color: '#ec4899', suffix: '' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl p-4 sm:p-5"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${stat.color}08, transparent 70%)`,
                  }}
                />
                <div className="relative">
                  <stat.icon className="w-4 h-4 mb-3" style={{ color: stat.color }} />
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: '#f0eef5', fontFamily: 'var(--font-epilogue), Epilogue, sans-serif' }}>
                    <AnimatedCounter target={stat.value} />
                    {stat.suffix ?? ''}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#5a5860', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Import Banner */}
          <div
            className="mb-12 sm:mb-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            <div
              className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(99, 102, 241, 0.04) 50%, rgba(139, 92, 246, 0.02) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
              }}
            >
              {/* Decorative corner accent */}
              <div
                className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20"
                style={{
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15), transparent 70%)',
                }}
              />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.15)' }}
                  >
                    <Upload className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: '#f0eef5', fontFamily: 'var(--font-epilogue), Epilogue, sans-serif' }}>
                      Import Your Library
                    </h3>
                    <p className="text-sm mt-1 max-w-md" style={{ color: '#6a6870', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>
                      Bring your watched movies and full history from Trakt. Your entire catalog, migrated in seconds.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    onClick={() => openImportModal('watched-movies')}
                    className="gap-2 rounded-xl text-sm font-medium"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(139, 92, 246, 0.25)',
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    Watched Movies
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openImportModal('watched-history')}
                    className="gap-2 rounded-xl text-sm font-medium"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#a0a0a8',
                    }}
                  >
                    <Clock className="w-4 h-4" />
                    Full History
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div
            className="flex items-center gap-4 mb-8"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
            }}
          >
            <div>
              <h2
                className="text-xl sm:text-2xl font-bold tracking-tight"
                style={{ color: '#f0eef5', fontFamily: 'var(--font-epilogue), Epilogue, sans-serif' }}
              >
                Browse Categories
              </h2>
              <p className="text-sm mt-1" style={{ color: '#5a5860', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>
                Select a media type to start tracking
              </p>
            </div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.06), transparent)' }} />
          </div>

          {/* Category Grid */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
            }}
          >
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <Link key={category.href} href={category.href} className="block group">
                  <div
                    className="relative overflow-hidden rounded-2xl p-5 sm:p-6 h-full transition-all duration-500 ease-out cursor-pointer"
                    style={{
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      animationDelay: `${index * 50}ms`,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'rgba(255, 255, 255, 0.035)';
                      el.style.borderColor = `${category.accent}30`;
                      el.style.transform = 'translateY(-4px)';
                      el.style.boxShadow = `0 20px 40px ${category.accent}10, 0 0 0 1px ${category.accent}15`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'rgba(255, 255, 255, 0.015)';
                      el.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow = 'none';
                    }}
                  >
                    {/* Hover glow */}
                    <div
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${category.accent}15, transparent 70%)`,
                      }}
                    />

                    <div className="relative">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-500"
                        style={{
                          background: `${category.accent}10`,
                          border: `1px solid ${category.accent}18`,
                        }}
                      >
                        <Icon className="w-5 h-5 transition-transform duration-500 group-hover:scale-110" style={{ color: category.accent }} />
                      </div>

                      <h3
                        className="font-semibold text-sm mb-1"
                        style={{ color: '#e0dee5', fontFamily: 'var(--font-epilogue), Epilogue, sans-serif' }}
                      >
                        {category.name}
                      </h3>

                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: '#5a5860', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}
                      >
                        {category.description}
                      </p>

                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-0 group-hover:translate-x-1">
                        <span className="text-[11px] font-medium" style={{ color: category.accent }}>
                          Explore
                        </span>
                        <ArrowRight className="w-3 h-3" style={{ color: category.accent }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Bottom decorative element */}
          <div
            className="mt-16 sm:mt-20 flex items-center justify-center gap-4"
            style={{
              opacity: mounted ? 0.3 : 0,
              transition: 'opacity 1.5s ease 1s',
            }}
          >
            <div className="h-px w-16" style={{ background: 'linear-gradient(to right, transparent, rgba(139, 92, 246, 0.2))' }} />
            <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#3a3840', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}>
              Lore Media Tracker
            </span>
            <div className="h-px w-16" style={{ background: 'linear-gradient(to left, transparent, rgba(139, 92, 246, 0.2))' }} />
          </div>

        </div>
      </div>

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        importType={importType}
        onImport={handleImport}
      />
    </div>
  );
}
