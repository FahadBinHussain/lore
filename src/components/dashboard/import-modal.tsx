'use client';

import { useState, useCallback } from 'react';
import { X, Upload, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTMDBImageUrl } from '@/lib/api/tmdb';

export type TraktImportType = 'watched-movies' | 'watched-history';

interface TraktMovie {
  title: string;
  year: number;
  ids: {
    trakt?: number;
    slug?: string;
    imdb?: string;
    tmdb: number;
  };
}

interface TraktItem {
  id: number;
  watched_at: string;
  action: string;
  type: 'movie' | 'episode';
  movie?: TraktMovie;
  episode?: {
    season: number;
    number: number;
    title: string;
    ids: {
      trakt: number;
      tvdb?: number;
      imdb?: string;
      tmdb: number;
      tvrage?: number;
    };
  };
  show?: {
    title: string;
    year: number;
    ids: {
      trakt: number;
      slug: string;
      tvdb?: number;
      imdb?: string;
      tmdb: number;
      tvrage?: number;
    };
    aired_episodes: number;
  };
}

interface TraktWatchedMoviesExportItem {
  last_watched_at?: string;
  last_updated_at?: string;
  movie?: TraktMovie;
}

interface TMDBMedia {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  backdrop_path?: string | null;
  genres: Array<{ id: number; name: string }>;
  runtime?: number;
  tagline?: string;
  popularity?: number;
  origin_country?: string[];
}

interface AniListSearchResult {
  id: number;
  title?: string;
  englishTitle?: string | null;
  nativeTitle?: string | null;
  seasonYear?: number | null;
}

type ImportTarget = 'movie' | 'tv' | 'anime';

export interface ImportItem extends TraktItem {
  tmdbData?: TMDBMedia;
  selected: boolean;
  alreadyWatched: boolean;
  isJapaneseAnimationEpisode: boolean;
  importTarget: ImportTarget;
  animeId?: number;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importType: TraktImportType;
  onImport: (selectedItems: ImportItem[]) => Promise<void>;
}

const IMPORT_COPY: Record<TraktImportType, { title: string; description: string; expectedFile: string }> = {
  'watched-movies': {
    title: 'Import Trakt Watched Movies',
    description: 'Upload your Trakt watched-movies export (JSON file).',
    expectedFile: 'watched-movies.json',
  },
  'watched-history': {
    title: 'Import Trakt Watched History',
    description: 'Upload your Trakt watched-history export (JSON file).',
    expectedFile: 'watched-history.json',
  },
};

function normalizeWatchedMoviesExport(data: unknown): TraktItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid JSON format: expected an array of watched movies.');
  }

  return data
    .map((entry, index): TraktItem | null => {
      const watchedMovie = entry as TraktWatchedMoviesExportItem;
      const movie = watchedMovie.movie;
      const watchedAt = watchedMovie.last_watched_at ?? watchedMovie.last_updated_at;
      const tmdbId = movie?.ids?.tmdb;

      if (!movie || typeof watchedAt !== 'string' || typeof tmdbId !== 'number') {
        return null;
      }

      return {
        id: typeof movie.ids.trakt === 'number' ? movie.ids.trakt : -(index + 1),
        watched_at: watchedAt,
        action: 'watch',
        type: 'movie' as const,
        movie,
      };
    })
    .filter((item): item is TraktItem => item !== null);
}

function normalizeWatchedHistoryExport(data: unknown): TraktItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid JSON format: expected an array of watched history items.');
  }

  const validItems = data
    .map((entry): TraktItem | null => {
      const item = entry as TraktItem;
      const hasId = typeof item.id === 'number';
      const hasWatchedAt = typeof item.watched_at === 'string';
      const validMovie = item.type === 'movie' && typeof item.movie?.ids?.tmdb === 'number';
      const validEpisode = item.type === 'episode' && typeof item.show?.ids?.tmdb === 'number';

      if (!hasId || !hasWatchedAt || (!validMovie && !validEpisode)) {
        return null;
      }

      return item;
    })
    .filter((item): item is TraktItem => item !== null);

  const latestByMedia = new Map<string, TraktItem>();

  for (const item of validItems) {
    const key =
      item.type === 'movie'
        ? (() => {
            const tmdbId = item.movie?.ids.tmdb;
            return typeof tmdbId === 'number' ? `movie:${tmdbId}` : null;
          })()
        : (() => {
            const showTmdbId = item.show?.ids.tmdb;
            const season = item.episode?.season;
            const episode = item.episode?.number;

            return typeof showTmdbId === 'number' && typeof season === 'number' && typeof episode === 'number'
              ? `episode:${showTmdbId}:${season}:${episode}`
              : null;
          })();

    if (!key) continue;

    const existing = latestByMedia.get(key);

    if (!existing || item.watched_at > existing.watched_at) {
      latestByMedia.set(key, item);
    }
  }

  return Array.from(latestByMedia.values()).sort((a, b) => b.watched_at.localeCompare(a.watched_at));
}

function normalizeTraktImport(data: unknown, importType: TraktImportType): TraktItem[] {
  const normalized =
    importType === 'watched-movies'
      ? normalizeWatchedMoviesExport(data)
      : normalizeWatchedHistoryExport(data);

  if (normalized.length === 0) {
    throw new Error(`No valid entries found for ${IMPORT_COPY[importType].expectedFile}.`);
  }

  return normalized;
}

function isJapaneseAnimationTMDBEntry(tmdbData?: TMDBMedia): boolean {
  if (!tmdbData) return false;

  const hasAnimationGenre = Array.isArray(tmdbData.genres) && tmdbData.genres.some((genre) => genre.name === 'Animation');
  const hasJapanOrigin = Array.isArray(tmdbData.origin_country) && tmdbData.origin_country.includes('JP');

  return hasAnimationGenre && hasJapanOrigin;
}

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

export function ImportModal({ isOpen, onClose, importType, onImport }: ImportModalProps) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatuses, setIsCheckingStatuses] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setIsCheckingStatuses(true);
      setError(null);
      setItems([]);

      try {
        const text = await file.text();
        const parsedData = JSON.parse(text) as unknown;
        const traktData = normalizeTraktImport(parsedData, importType);
        const statusCache = new Map<string, Promise<boolean>>();
        const episodeStatusCache = new Map<string, Promise<boolean>>();
        const detailsCache = new Map<string, Promise<TMDBMedia | null>>();
        const animeIdCache = new Map<string, Promise<number | null>>();

        const getAlreadyWatched = (tmdbId: number, mediaType: 'movie' | 'tv') => {
          const key = `${mediaType}:${tmdbId}`;
          if (!statusCache.has(key)) {
            statusCache.set(
              key,
              (async () => {
                const statusResponse = await fetch(`/api/media/status?mediaId=${tmdbId}&mediaType=${mediaType}`, {
                  cache: 'no-cache',
                });

                if (!statusResponse.ok) return false;
                const statusData = await statusResponse.json();
                return Boolean(statusData.isWatched);
              })()
            );
          }

          return statusCache.get(key) as Promise<boolean>;
        };

        const getEpisodeAlreadyWatched = (
          mediaId: number,
          mediaType: 'tv' | 'anime',
          season: number,
          episode: number
        ) => {
          const key = `${mediaType}:${mediaId}:${season}:${episode}`;
          if (!episodeStatusCache.has(key)) {
            episodeStatusCache.set(
              key,
              (async () => {
                const response = await fetch(
                  `/api/media/status?mediaId=${mediaId}&mediaType=${mediaType}&seasonNumber=${season}&episodeNumber=${episode}`,
                  {
                    cache: 'no-cache',
                  }
                );

                if (!response.ok) return false;
                const data = await response.json();
                return Boolean(data?.isWatched);
              })()
            );
          }

          return episodeStatusCache.get(key) as Promise<boolean>;
        };

        const getTMDBData = (tmdbId: number, mediaType: 'movie' | 'tv') => {
          const key = `${mediaType}:${tmdbId}`;
          if (!detailsCache.has(key)) {
            const apiEndpoint = mediaType === 'movie' ? '/api/movies' : '/api/tv';
            detailsCache.set(
              key,
              (async () => {
                const response = await fetch(`${apiEndpoint}/${tmdbId}`);
                if (!response.ok) return null;
                return (await response.json()) as TMDBMedia;
              })()
            );
          }

          return detailsCache.get(key) as Promise<TMDBMedia | null>;
        };

        const getAniListIdForShow = (item: TraktItem, tmdbData?: TMDBMedia) => {
          const fallbackTitle = item.show?.title ?? tmdbData?.name ?? '';
          const firstAirYear = Number.parseInt((tmdbData?.first_air_date ?? '').slice(0, 4), 10);
          const fallbackYear = item.show?.year ?? (Number.isNaN(firstAirYear) ? undefined : firstAirYear);
          const showTmdbId = item.show?.ids.tmdb;
          const cacheKey = `${showTmdbId ?? fallbackTitle}:${fallbackYear ?? ''}`;

          if (!animeIdCache.has(cacheKey)) {
            animeIdCache.set(
              cacheKey,
              (async () => {
                if (!fallbackTitle) return null;

                const response = await fetch(`/api/search/anilist?q=${encodeURIComponent(fallbackTitle)}`, {
                  cache: 'no-cache',
                });
                if (!response.ok) return null;

                const data = (await response.json()) as { results?: AniListSearchResult[] };
                const results = Array.isArray(data.results) ? data.results : [];
                const best = pickBestAniListMatch(results, fallbackTitle, fallbackYear);
                return best?.id ?? null;
              })()
            );
          }

          return animeIdCache.get(cacheKey) as Promise<number | null>;
        };

        const itemsWithTMDB: ImportItem[] = await Promise.all(
          traktData.map(async (item) => {
            try {
              const tmdbId = item.type === 'movie' ? item.movie?.ids.tmdb : item.show?.ids.tmdb;
              const mediaType: 'movie' | 'tv' = item.type === 'movie' ? 'movie' : 'tv';

              let alreadyWatched = false;
              let tmdbData: TMDBMedia | undefined;
              let isJapaneseAnimationEpisode = false;
              let importTarget: ImportTarget = item.type === 'movie' ? 'movie' : 'tv';
              let animeId: number | undefined;

              if (typeof tmdbId === 'number') {
                const season = item.episode?.season;
                const episode = item.episode?.number;
                tmdbData = (await getTMDBData(tmdbId, mediaType).then((data) => data ?? undefined)) ?? undefined;

                if (item.type === 'episode') {
                  isJapaneseAnimationEpisode = isJapaneseAnimationTMDBEntry(tmdbData);

                  if (isJapaneseAnimationEpisode && typeof season === 'number' && typeof episode === 'number') {
                    importTarget = 'anime';
                    const resolvedAnimeId = await getAniListIdForShow(item, tmdbData);
                    animeId = typeof resolvedAnimeId === 'number' ? resolvedAnimeId : undefined;

                    if (typeof animeId === 'number') {
                      alreadyWatched = await getEpisodeAlreadyWatched(animeId, 'anime', season, episode);
                    }
                  } else if (typeof season === 'number' && typeof episode === 'number') {
                    alreadyWatched = await getEpisodeAlreadyWatched(tmdbId, 'tv', season, episode);
                  } else {
                    alreadyWatched = await getAlreadyWatched(tmdbId, mediaType);
                  }
                } else {
                  alreadyWatched = await getAlreadyWatched(tmdbId, mediaType);
                }
              }

              return {
                ...item,
                tmdbData,
                selected: !alreadyWatched,
                alreadyWatched,
                isJapaneseAnimationEpisode,
                importTarget,
                animeId,
              };
            } catch {
              return {
                ...item,
                selected: true,
                alreadyWatched: false,
                isJapaneseAnimationEpisode: false,
                importTarget: item.type === 'movie' ? 'movie' : 'tv',
              };
            }
          })
        );

        setItems(itemsWithTMDB);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to parse ${IMPORT_COPY[importType].expectedFile} or fetch media data.`;
        setError(message);
        console.error(err);
      } finally {
        setIsLoading(false);
        setIsCheckingStatuses(false);
      }
    },
    [importType]
  );

  const toggleItemSelection = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index && !item.alreadyWatched ? { ...item, selected: !item.selected } : item))
    );
  };

  const selectAll = () => {
    setItems((prev) => prev.map((item) => (item.alreadyWatched ? item : { ...item, selected: true })));
  };

  const deselectAll = () => {
    setItems((prev) => prev.map((item) => (item.alreadyWatched ? item : { ...item, selected: false })));
  };

  const handleImport = async () => {
    const selectedItems = items.filter((item) => item.selected && !item.alreadyWatched);
    if (selectedItems.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(selectedItems);
      onClose();
      setItems([]);
    } catch (err) {
      setError('Failed to import items');
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const importableItems = items.filter((item) => !item.alreadyWatched);
  const japaneseAnimationEpisodeItems = importableItems.filter(
    (item) => item.type === 'episode' && item.importTarget === 'anime'
  );
  const unresolvedAnimeItems = japaneseAnimationEpisodeItems.filter((item) => typeof item.animeId !== 'number');
  const alreadyWatchedItems = items.filter((item) => item.alreadyWatched);
  const selectedCount = importableItems.filter((item) => item.selected).length;

  if (!isOpen) return null;

  const copy = IMPORT_COPY[importType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{copy.title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {items.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">{copy.description}</p>
              <label className="cursor-pointer inline-block bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors">
                Choose File
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>
                {isCheckingStatuses
                  ? 'Loading, fetching item details, and checking your DB watched status...'
                  : 'Loading and fetching item details...'}
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} of {importableItems.length} importable selected
                  </span>
                  {alreadyWatchedItems.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {alreadyWatchedItems.length} already watched in DB
                    </Badge>
                  )}
                  {japaneseAnimationEpisodeItems.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-600">
                      {japaneseAnimationEpisodeItems.length} JP animation episode(s) import to Anime
                    </Badge>
                  )}
                  {unresolvedAnimeItems.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                      {unresolvedAnimeItems.length} AniList match pending
                    </Badge>
                  )}
                </div>
                <Button onClick={handleImport} disabled={selectedCount === 0 || isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Import Selected ({selectedCount})
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {importableItems.map((item) => {
                  const title = item.type === 'movie' ? item.movie?.title : item.show?.title;
                  const year = item.type === 'movie' ? item.movie?.year : item.show?.year;
                  const itemIndex = items.findIndex(
                    (candidate) => candidate.id === item.id && candidate.watched_at === item.watched_at
                  );
                  const posterUrl = item.tmdbData?.poster_path ? getTMDBImageUrl(item.tmdbData.poster_path) : null;
                  const typeLabel =
                    item.type === 'movie'
                      ? 'Movie'
                      : item.episode
                        ? `${item.importTarget === 'anime' ? 'Anime' : 'TV'} Episode S${item.episode.season}E${item.episode.number}`
                        : 'TV Show';

                  return (
                    <div key={`${item.id}-${item.watched_at}`} className="flex items-center gap-3 p-3 border rounded-lg">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItemSelection(itemIndex)}
                        className="w-4 h-4"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        {posterUrl && (
                          <img src={posterUrl} alt={title ?? 'Poster'} className="w-12 h-16 object-cover rounded" />
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold">{title}</h4>
                            {item.importTarget === 'anime' && (
                              <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-600">
                                Import to Anime
                              </Badge>
                            )}
                            {item.importTarget === 'anime' && typeof item.animeId === 'number' && (
                              <Badge variant="secondary" className="text-xs">
                                AniList #{item.animeId}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {year} - {typeLabel}
                            {item.tmdbData?.vote_average && <> - {item.tmdbData.vote_average.toFixed(1)}</>}
                          </p>
                          {item.tmdbData?.genres && (
                            <div className="flex gap-1 mt-1">
                              {item.tmdbData.genres.slice(0, 3).map((genre) => (
                                <Badge key={genre.id} variant="secondary" className="text-xs">
                                  {genre.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {alreadyWatchedItems.length > 0 && (
                  <>
                    <div className="pt-4 mt-4 border-t">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Already watched in your DB (excluded from import)
                      </h4>
                    </div>

                    {alreadyWatchedItems.map((item) => {
                      const title = item.type === 'movie' ? item.movie?.title : item.show?.title;
                      const year = item.type === 'movie' ? item.movie?.year : item.show?.year;
                      const posterUrl = item.tmdbData?.poster_path ? getTMDBImageUrl(item.tmdbData.poster_path) : null;
                      const typeLabel =
                        item.type === 'movie'
                          ? 'Movie'
                          : item.episode
                            ? `${item.importTarget === 'anime' ? 'Anime' : 'TV'} Episode S${item.episode.season}E${item.episode.number}`
                            : 'TV Show';

                      return (
                        <div
                          key={`already-${item.id}-${item.watched_at}`}
                          className="flex items-center gap-3 p-3 border rounded-lg opacity-70 bg-muted/30"
                        >
                          <input type="checkbox" checked={false} disabled className="w-4 h-4" />
                          <div className="flex items-center gap-3 flex-1">
                            {posterUrl && (
                              <img src={posterUrl} alt={title ?? 'Poster'} className="w-12 h-16 object-cover rounded" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{title}</h4>
                                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                                  Already Watched
                                </Badge>
                                {item.importTarget === 'anime' && (
                                  <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-600">
                                    Anime
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {year} - {typeLabel}
                                {item.tmdbData?.vote_average && <> - {item.tmdbData.vote_average.toFixed(1)}</>}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
