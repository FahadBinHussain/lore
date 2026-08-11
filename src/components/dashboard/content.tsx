'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Film, Tv, Gamepad2, BookOpen, BookCopy, Music, Podcast, MapPin,
  Zap, Upload, ArrowRight, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImportModal, type ImportItem, type TraktImportType } from './import-modal';
import { Skeleton } from '@/components/ui/skeleton';

interface AniListSearchResult {
  id: number;
  title?: string;
  englishTitle?: string | null;
  nativeTitle?: string | null;
  seasonYear?: number | null;
}

const CATEGORIES = [
  { name: 'Movies', href: '/dashboard/movies', icon: Film, key: 'movie' },
  { name: 'TV Shows', href: '/dashboard/tv', icon: Tv, key: 'tv' },
  { name: 'Anime', href: '/dashboard/anime', icon: Zap, key: 'anime' },
  { name: 'Manga', href: '/dashboard/manga', icon: BookCopy, key: 'manga' },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, key: 'game' },
  { name: 'Books', href: '/dashboard/books', icon: BookOpen, key: 'book' },
  { name: 'Comics', href: '/dashboard/comics', icon: BookOpen, key: 'comic' },
  { name: 'Board Games', href: '/dashboard/boardgames', icon: Gamepad2, key: 'boardgame' },
  { name: 'Soundtracks', href: '/dashboard/soundtracks', icon: Music, key: 'soundtrack' },
  { name: 'Podcasts', href: '/dashboard/podcasts', icon: Podcast, key: 'podcast' },
  { name: 'Theme Parks', href: '/dashboard/themeparks', icon: MapPin, key: 'themepark' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

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
      if (normalizedCandidate === normalizedQuery) score += 100;
      else if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) score += 40;
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

export function DashboardContent() {
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<TraktImportType>('watched-movies');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    const results: Record<string, number> = {};
    await Promise.all(
      CATEGORIES.map(async (cat) => {
        try {
          const resp = await fetch(`/api/media?type=${cat.key}`, { cache: 'no-cache' });
          if (resp.ok) {
            const data = await resp.json();
            const items = Array.isArray(data.items) ? data.items : [];
            results[cat.key] = items.filter((item: { status: string }) => item.status !== 'not_started').length;
          } else {
            results[cat.key] = 0;
          }
        } catch {
          results[cat.key] = 0;
        }
      })
    );
    return results;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results = await loadCounts();
      if (cancelled) return;
      setCounts(results);
      setCountsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCounts]);

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
        if (animeIdCache.has(cacheKey)) return animeIdCache.get(cacheKey) ?? null;
        try {
          const response = await fetch(`/api/search/anilist?q=${encodeURIComponent(queryTitle)}`);
          if (!response.ok) { animeIdCache.set(cacheKey, null); return null; }
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
          if (typeof seasonNumber !== 'number' || typeof episodeNumber !== 'number') continue;
          const shouldImportAsAnime = item.importTarget === 'anime' || item.isJapaneseAnimationEpisode;
          if (shouldImportAsAnime) {
            const animeId = await resolveAniListId(item);
            if (typeof animeId !== 'number') continue;
            await fetch(`/api/anime/${animeId}/season/${seasonNumber}/episode/${episodeNumber}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_watched: true, watched_at: item.watched_at, title: item.show?.title ?? item.tmdbData?.name, posterPath: item.tmdbData?.poster_path, releaseDate: item.tmdbData?.first_air_date, totalEpisodes: item.show?.aired_episodes }),
            });
            continue;
          }
          if (typeof showTmdbId !== 'number') continue;
          await fetch(`/api/tv/${showTmdbId}/season/${seasonNumber}/episode/${episodeNumber}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_watched: true, watched_at: item.watched_at }),
          });
          continue;
        }
        const tmdbId = item.movie?.ids.tmdb;
        if (typeof tmdbId !== 'number') continue;
        const externalId = tmdbId.toString();
        const normalizedTitle = item.tmdbData?.title ?? item.tmdbData?.name ?? item.movie?.title ?? 'Untitled';
        const normalizedReleaseDate = item.tmdbData?.release_date ?? item.tmdbData?.first_air_date;
        const ensureResponse = await fetch('/api/media/ensure', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ externalId, mediaType: 'movie', title: normalizedTitle, posterPath: item.tmdbData?.poster_path, backdropPath: item.tmdbData?.backdrop_path, releaseDate: normalizedReleaseDate, rating: item.tmdbData?.vote_average, description: item.tmdbData?.overview, genres: item.tmdbData?.genres?.map((g) => g.name) || [], runtime: item.tmdbData?.runtime, tagline: item.tmdbData?.tagline, popularity: item.tmdbData?.popularity, source: 'tmdb' }),
        });
        if (!ensureResponse.ok) continue;
        const { id: mediaItemId } = await ensureResponse.json();
        await fetch('/api/media', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaItemId, status: 'completed', currentProgress: 0, completedAt: item.watched_at }),
        });
      }
      setCounts(await loadCounts());
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import some items. Please try again.');
    }
  };

  const totalTracked = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="relative min-h-screen">
      <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto">

          {/* Greeting */}
          <div className="mb-10 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2 font-[family-name:var(--font-epilogue)]">
              {greeting}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Your media universe at a glance.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10">
            {[
              { label: 'Items tracked', value: countsLoading ? null : totalTracked, icon: Film },
              { label: 'Categories', value: CATEGORIES.length, icon: Tv },
              { label: 'Universes', value: 40, icon: BookOpen },
              { label: 'Media types', value: 10, icon: Music },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="p-4 sm:p-5 rounded-xl border border-border/40 bg-card/50">
                  <Icon className="w-4 h-4 mb-3 text-muted-foreground" />
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-epilogue)]">
                    {stat.value === null ? <Skeleton className="h-8 w-12" /> : stat.value}
                  </div>
                  <div className="text-xs mt-1 text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Import banner */}
          <div className="mb-10 sm:mb-12">
            <div className="relative overflow-hidden rounded-xl p-6 border border-primary/15 bg-primary/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20">
                    <Upload className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Import your library</h3>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Bring your watched movies and history from Trakt. Migrated in seconds.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" onClick={() => openImportModal('watched-movies')} className="gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Watched Movies
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openImportModal('watched-history')} className="gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Full History
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-1 font-[family-name:var(--font-epilogue)]">
              Browse categories
            </h2>
            <p className="text-sm text-muted-foreground">Select a media type to start tracking</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const count = counts[category.key];
              return (
                <Link key={category.href} href={category.href} className="block group">
                  <div className="rounded-xl p-4 border border-border/40 bg-card/50 transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h3 className="font-semibold text-sm mb-0.5">{category.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {countsLoading ? <Skeleton className="h-3 w-16" /> : `${count || 0} tracked`}
                    </p>
                  </div>
                </Link>
              );
            })}
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