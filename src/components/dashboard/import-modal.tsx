'use client';

import { useState, useCallback } from 'react';
import { X, Upload, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTMDBImageUrl } from '@/lib/api/tmdb';

interface TraktItem {
  id: number;
  watched_at: string;
  action: string;
  type: 'movie' | 'episode';
  movie?: {
    title: string;
    year: number;
    ids: {
      trakt: number;
      slug: string;
      imdb?: string;
      tmdb: number;
    };
  };
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

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
  genres: Array<{ id: number; name: string }>;
}

interface ImportItem extends TraktItem {
  tmdbData?: TMDBMovie;
  selected: boolean;
  alreadyWatched: boolean;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (selectedItems: ImportItem[]) => Promise<void>;
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatuses, setIsCheckingStatuses] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
  setIsCheckingStatuses(true);
    setError(null);

    try {
      const text = await file.text();
      const traktData: TraktItem[] = JSON.parse(text);

      // Fetch TMDB data for each item
      const itemsWithTMDB: ImportItem[] = await Promise.all(
        traktData.map(async (item) => {
          try {
            const tmdbId = item.type === 'movie' ? item.movie?.ids.tmdb : item.show?.ids.tmdb;
            const apiEndpoint = item.type === 'movie' ? '/api/movies' : '/api/tv';
            const mediaType = item.type === 'movie' ? 'movie' : 'tv';

            let alreadyWatched = false;

            if (tmdbId) {
              const statusResponse = await fetch(`/api/media/status?mediaId=${tmdbId}&mediaType=${mediaType}`, {
                cache: 'no-cache',
              });

              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                alreadyWatched = Boolean(statusData.isWatched);
              }
            }

            if (tmdbId) {
              const response = await fetch(`${apiEndpoint}/${tmdbId}`);
              if (response.ok) {
                const tmdbData = await response.json();
                return { ...item, tmdbData, selected: !alreadyWatched, alreadyWatched };
              }
            }
            return { ...item, selected: !alreadyWatched, alreadyWatched };
          } catch {
            return { ...item, selected: true, alreadyWatched: false };
          }
        })
      );

      setItems(itemsWithTMDB);
    } catch (err) {
      setError('Failed to parse JSON file or fetch movie data');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsCheckingStatuses(false);
    }
  }, []);

  const toggleItemSelection = (index: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index && !item.alreadyWatched ? { ...item, selected: !item.selected } : item
    ));
  };

  const selectAll = () => {
    setItems(prev => prev.map(item => item.alreadyWatched ? item : { ...item, selected: true }));
  };

  const deselectAll = () => {
    setItems(prev => prev.map(item => item.alreadyWatched ? item : { ...item, selected: false }));
  };

  const handleImport = async () => {
    const selectedItems = items.filter(item => item.selected && !item.alreadyWatched);
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

  const importableItems = items.filter(item => !item.alreadyWatched);
  const alreadyWatchedItems = items.filter(item => item.alreadyWatched);
  const selectedCount = importableItems.filter(item => item.selected).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Import Trakt Movies</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {items.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Upload your Trakt watched history export (JSON file)
              </p>
              <label className="cursor-pointer inline-block bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors">
                Choose File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
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
                  const itemIndex = items.findIndex((candidate) => candidate.id === item.id);
                  const posterUrl = item.tmdbData?.poster_path
                    ? getTMDBImageUrl(item.tmdbData.poster_path)
                    : null;

                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItemSelection(itemIndex)}
                        className="w-4 h-4"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        {posterUrl && (
                          <img
                            src={posterUrl}
                            alt={title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold">{title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {year} • {item.type === 'movie' ? 'Movie' : 'TV Show'}
                            {item.tmdbData?.vote_average && (
                              <> • ⭐ {item.tmdbData.vote_average.toFixed(1)}</>
                            )}
                          </p>
                          {item.tmdbData?.genres && (
                            <div className="flex gap-1 mt-1">
                              {item.tmdbData.genres.slice(0, 3).map(genre => (
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
                      const posterUrl = item.tmdbData?.poster_path
                        ? getTMDBImageUrl(item.tmdbData.poster_path)
                        : null;

                      return (
                        <div key={`already-${item.id}`} className="flex items-center gap-3 p-3 border rounded-lg opacity-70 bg-muted/30">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled
                            className="w-4 h-4"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            {posterUrl && (
                              <img
                                src={posterUrl}
                                alt={title}
                                className="w-12 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{title}</h4>
                                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                                  Already Watched
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {year} • {item.type === 'movie' ? 'Movie' : 'TV Show'}
                                {item.tmdbData?.vote_average && (
                                  <> • ⭐ {item.tmdbData.vote_average.toFixed(1)}</>
                                )}
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