'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImportModal, type ImportItem, type TraktImportType } from './import-modal';

interface AniListSearchResult {
  id: number;
  title?: string;
  englishTitle?: string | null;
  nativeTitle?: string | null;
  seasonYear?: number | null;
}

const categories = [
  { name: 'Movies', href: '/dashboard/movies', icon: Film, color: 'text-violet-500', description: 'Track your favorite films' },
  { name: 'TV Shows', href: '/dashboard/tv', icon: Tv, color: 'text-cyan-500', description: 'Follow your series' },
  { name: 'Anime', href: '/dashboard/anime', icon: Zap, color: 'text-pink-500', description: 'Discover anime' },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, color: 'text-amber-500', description: 'Track your games' },
  { name: 'Books', href: '/dashboard/books', icon: BookOpen, color: 'text-emerald-500', description: 'Track your reading' },
  { name: 'Comics', href: '/dashboard/comics', icon: Sparkles, color: 'text-purple-500', description: 'Follow your comics' },
  { name: 'Board Games', href: '/dashboard/boardgames', icon: Gamepad2, color: 'text-orange-500', description: 'Track tabletop games' },
  { name: 'Soundtracks', href: '/dashboard/soundtracks', icon: Music, color: 'text-teal-500', description: 'Discover music' },
  { name: 'Podcasts', href: '/dashboard/podcasts', icon: Podcast, color: 'text-red-500', description: 'Follow podcasts' },
  { name: 'Theme Parks', href: '/dashboard/themeparks', icon: MapPin, color: 'text-lime-500', description: 'Plan your visits' },
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

export function DashboardContent() {
  const [greeting, setGreeting] = useState('Hello');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<TraktImportType>('watched-movies');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">{greeting}!</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Welcome to your media tracking dashboard. Select a category below to get started.
            </p>
          </div>

          <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-secondary/5 rounded-lg p-4 border border-primary/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-lg">Import Your Media</h3>
                <p className="text-sm text-muted-foreground">
                  Import your Trakt watched movies or full watched history exports.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => openImportModal('watched-movies')} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import Watched Movies
                </Button>
                <Button variant="outline" onClick={() => openImportModal('watched-history')} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import Watched History
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Media Categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Link key={category.href} href={category.href}>
                    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer h-full">
                      <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                        <div
                          className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ${category.color}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{category.name}</h3>
                          <p className="text-xs text-muted-foreground">{category.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
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
