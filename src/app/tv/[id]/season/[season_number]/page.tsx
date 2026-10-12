'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Star, Calendar,
  Eye, EyeOff,
  Monitor, PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DetailPageSkeleton } from '@/components/ui/skeleton';

interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  air_date: string;
  runtime: number;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

interface SeasonDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string;
  episodes: Array<Episode & { watched?: boolean }>;
}

interface ShowBrief {
  id: number;
  name: string;
  backdrop_path: string | null;
}

export default function SeasonDetailPage() {
  const params = useParams();
  const [season, setSeason] = useState<SeasonDetails | null>(null);
  const [show, setShow] = useState<ShowBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const showIdParam = params.id as string;
        const seasonNumber = params.season_number as string;

        // Extract numeric ID from prefixed ID (e.g., "tv-70523" -> "70523")
        const numericIdMatch = showIdParam.match(/(\d+)$/);
        const numericShowId = numericIdMatch ? numericIdMatch[1] : showIdParam;

        // Fetch show details
        const showResponse = await fetch(`/api/tv/${numericShowId}`);
        if (!showResponse.ok) throw new Error('Failed to fetch show details');
        const showData = (await showResponse.json()) as ShowBrief;
        setShow(showData);

        // Fetch season details
        const seasonResponse = await fetch(`/api/tv/${numericShowId}/season/${seasonNumber}`);
        if (!seasonResponse.ok) throw new Error('Failed to fetch season details');
        const seasonData = (await seasonResponse.json()) as SeasonDetails;
        setSeason(seasonData);

        // Initialize watched episodes from API response
        const watchedSet = new Set<number>();
        seasonData.episodes?.forEach((episode) => {
          if (episode.watched) {
            watchedSet.add(episode.episode_number);
          }
        });
        setWatchedEpisodes(watchedSet);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (params.id && params.season_number) {
      fetchData();
    }
  }, [params.id, params.season_number]);

  const toggleWatched = async (episodeNumber: number) => {
    try {
      const response = await fetch(
        `/api/tv/${params.id}/season/${params.season_number}/episode/${episodeNumber}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_watched: !watchedEpisodes.has(episodeNumber) }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const newWatched = new Set(watchedEpisodes);
        if (result.is_watched) {
          newWatched.add(episodeNumber);
        } else {
          newWatched.delete(episodeNumber);
        }
        setWatchedEpisodes(newWatched);
      }
    } catch (err) {
      console.error('Error updating watch status:', err);
    }
  };

  const getYear = (dateString: string) => {
    return new Date(dateString).getFullYear();
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error || !season || !show) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Error</h1>
          <p className="text-muted-foreground">{error || 'Failed to load season details'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Hero Section with Backdrop */}
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-10 lg:pb-12">
        {/* Background Backdrop Layer - isolated overflow-hidden */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          {season.poster_path ? (
            <div
              className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
              style={{
                backgroundImage: `url(https://image.tmdb.org/t/p/original${season.poster_path})`
              }}
              suppressHydrationWarning
            />
          ) : show.backdrop_path ? (
            <div
              className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
              style={{
                backgroundImage: `url(https://image.tmdb.org/t/p/original${show.backdrop_path})`
              }}
              suppressHydrationWarning
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/25" />
          )}

          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/25 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 sm:via-transparent to-background/50" />

          {/* Animated Background Effects */}
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-secondary/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button - in normal flow */}
        <div className="relative z-20 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto mb-4 sm:mb-6">
          <Link href={`/tv/${params.id}`}>
            <Button
              variant="ghost"
              className="group bg-background/65 backdrop-blur-xl border border-border hover:bg-background/80 text-foreground transition-all duration-300 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
              Back to {show.name}
            </Button>
          </Link>
        </div>

        {/* Season Info in normal document flow */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Poster */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-36 sm:w-44 md:w-52 lg:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-border/30 bg-muted">
                {season.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w500${season.poster_path}`}
                    alt={season.name}
                    fill
                    priority
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Monitor className="w-16 h-16 text-primary-content/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title and Season Number */}
              <div className="mb-3 sm:mb-4">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-2 tracking-tight">
                  {season.name}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <Badge variant="secondary" className="bg-primary/20 text-primary text-sm sm:text-base px-3 sm:px-4 py-1 sm:py-1.5 transition-transform duration-300 hover:scale-105">
                    Season {season.season_number}
                  </Badge>
                </div>
                {season.overview && (
                  <p className="text-sm sm:text-base md:text-lg text-muted-foreground italic font-light max-w-2xl mx-auto sm:mx-0">
                    {season.overview}
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                {season.air_date && (
                  <div className="group flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span>{getYear(season.air_date)}</span>
                  </div>
                )}
                <div className="group flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                  <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                  <span>{season.episode_count} Episodes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes */}
      <div className="px-6 md:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-primary" />
            </div>
            Episodes
          </h2>

          <div className="space-y-6">
            {season.episodes.map((episode) => (
              <Card
                key={episode.id}
                className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Episode Still */}
                    <div className="flex-shrink-0 w-48">
                      <Link href={`/tv/${params.id}/season/${params.season_number}/episode/${episode.episode_number}`}>
                        {episode.still_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                            alt={episode.name}
                            width={800}
                            height={450}
                            className="w-full aspect-video rounded-lg object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-base-200 flex items-center justify-center hover:scale-105 transition-transform duration-300">
                            <PlayCircle className="w-8 h-8 text-muted-foreground/70" />
                          </div>
                        )}
                      </Link>
                    </div>

                    {/* Episode Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <Link
                          href={`/tv/${params.id}/season/${params.season_number}/episode/${episode.episode_number}`}
                          className="flex-1 hover:opacity-80 transition-opacity"
                        >
                          <div>
                            <h3 className="text-xl font-semibold text-foreground">
                              {episode.episode_number}. {episode.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              {episode.air_date && (
                                <span>{new Date(episode.air_date).toLocaleDateString()}</span>
                              )}
                              {episode.runtime && (
                                <span>{episode.runtime} min</span>
                              )}
                              {episode.vote_average > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-primary" />
                                  <span>{episode.vote_average.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {episode.overview && (
                            <p className="text-muted-foreground leading-relaxed mt-2 line-clamp-2">
                              {episode.overview}
                            </p>
                          )}
                        </Link>

                        {/* Watch Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleWatched(episode.episode_number);
                          }}
                          className={cn(
                            "text-foreground hover:bg-accent ml-4",
                            watchedEpisodes.has(episode.episode_number) && "text-primary"
                          )}
                        >
                          {watchedEpisodes.has(episode.episode_number) ? (
                            <Eye className="w-4 h-4 mr-2" />
                          ) : (
                            <EyeOff className="w-4 h-4 mr-2" />
                          )}
                          {watchedEpisodes.has(episode.episode_number) ? 'Watched' : 'Mark as Watched'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



