'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Clock,
  Play, Eye, EyeOff, Loader2,
  Zap, Check, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AnimeDetails {
  id: number;
  title: string;
  image: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
}

export default function AnimeSeasonPage() {
  const params = useParams();
  const router = useRouter();
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<number>>(new Set());
  const [animeIsWatched, setAnimeIsWatched] = useState(false);

  const getAllEpisodeNumbers = (totalEpisodes: number) =>
    new Set(Array.from({ length: totalEpisodes }, (_, i) => i + 1));

  useEffect(() => {
    const fetchAnimeWatchedStatus = async (animeData: AnimeDetails) => {
      try {
        const response = await fetch(`/api/media/status?mediaId=${params.id}&mediaType=anime`);
        if (response.ok) {
          const data = await response.json();
          const isSeasonWatched = Boolean(data.isWatched);
          setAnimeIsWatched(isSeasonWatched);

          if (Array.isArray(data.watchedEpisodes)) {
            setWatchedEpisodes(new Set(data.watchedEpisodes));
            return;
          }

          if (isSeasonWatched && animeData.episodes && animeData.episodes > 0) {
            setWatchedEpisodes(getAllEpisodeNumbers(animeData.episodes));
          } else {
            setWatchedEpisodes(new Set());
          }
        }
      } catch (err) {
        console.error('Failed to fetch anime watched status:', err);
      }
    };

    const fetchAnimeDetails = async () => {
      try {
        const response = await fetch(`/api/anime/${params.id}`);
        if (!response.ok) throw new Error('Anime not found');
        const data = await response.json();
        setAnime(data);
        // Fetch watched status after anime details are loaded
        await fetchAnimeWatchedStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load anime');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchAnimeDetails();
    }
  }, [params.id]);

  const toggleWatched = async (episodeNumber: number) => {
    if (!anime) return;

    const previousWatched = new Set(watchedEpisodes);
    const previousAnimeIsWatched = animeIsWatched;
    const newWatched = new Set(watchedEpisodes);
    const unwatching = newWatched.has(episodeNumber);
    if (unwatching) {
      newWatched.delete(episodeNumber);
    } else {
      newWatched.add(episodeNumber);
    }

    const totalEpisodes = anime.episodes || 0;
    const shouldBeWatched = newWatched.size === totalEpisodes && totalEpisodes > 0;

    setWatchedEpisodes(newWatched);
    setAnimeIsWatched(shouldBeWatched);

    try {
      // 1. Tell API to toggle this specific episode!
      await fetch(`/api/anime/${params.id}/season/${params.season_number}/episode/${episodeNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_watched: !unwatching,
          title: anime.title,
          posterPath: anime.image,
          releaseDate: anime.seasonYear ? `${anime.seasonYear}-01-01` : null,
          totalEpisodes: anime.episodes,
        }),
      });
      
      // 2. Ensure parent anime watched status matches all-episodes state
      if (shouldBeWatched !== previousAnimeIsWatched) {
        await fetch('/api/media/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId: params.id as string,
            mediaType: 'anime',
            isWatched: shouldBeWatched,
            title: anime.title,
            posterPath: anime.image,
            releaseDate: anime.seasonYear ? `${anime.seasonYear}-01-01` : null,
            totalEpisodes: anime.episodes,
          }),
        });
      }
    } catch (err) {
      console.error('Failed to update watched status:', err);
      // Rollback on fail
      setWatchedEpisodes(previousWatched);
      setAnimeIsWatched(previousAnimeIsWatched);
    }
  };

  const toggleSeasonWatched = async () => {
    if (!anime?.episodes) return;

    const previousWatched = new Set(watchedEpisodes);
    const previousAnimeIsWatched = animeIsWatched;
    const newIsWatched = !animeIsWatched;
    const newWatched = newIsWatched ? getAllEpisodeNumbers(anime.episodes) : new Set<number>();

    setWatchedEpisodes(newWatched);
    setAnimeIsWatched(newIsWatched);

    try {
      await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: params.id as string,
          mediaType: 'anime',
          isWatched: newIsWatched,
          title: anime.title,
          posterPath: anime.image,
          releaseDate: anime.seasonYear ? `${anime.seasonYear}-01-01` : null,
          totalEpisodes: anime.episodes,
        }),
      });
    } catch (err) {
      console.error('Failed to update anime status', err);
      setWatchedEpisodes(previousWatched);
      setAnimeIsWatched(previousAnimeIsWatched);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Error</h1>
          <p className="text-muted-foreground">{error || 'Failed to load anime'}</p>
        </div>
      </div>
    );
  }

  const episodes = Array.from({ length: anime.episodes || 0 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Hero Section with Backdrop */}
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-10 lg:pb-12">
        {/* Background Backdrop Layer - isolated overflow-hidden */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          {anime.image ? (
            <div
              className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
              style={{
                backgroundImage: `url(${anime.image})`
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
          <Link href={`/anime/${params.id}`}>
            <Button
              variant="ghost"
              className="group bg-background/65 backdrop-blur-xl border border-border hover:bg-background/80 text-foreground transition-all duration-300 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
              Back to {anime.title}
            </Button>
          </Link>
        </div>

        {/* Anime Info in normal document flow */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Poster */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-36 sm:w-44 md:w-52 lg:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-border/30 bg-muted">
                {anime.image ? (
                  <Image
                    src={anime.image}
                    alt={anime.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/70 to-secondary/70 flex items-center justify-center">
                    <Zap className="w-16 h-16 text-primary-foreground/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title and Season */}
              <div className="mb-3 sm:mb-4">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-xs sm:text-sm">
                    <Zap className="w-3 h-3 mr-1" />
                    Anime Season
                  </Badge>
                  {anime.season && anime.seasonYear && (
                    <Badge variant="outline" className="bg-secondary/15 text-secondary border-secondary/30 text-xs sm:text-sm">
                      {anime.season} {anime.seasonYear}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-3 sm:gap-4 mb-2">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
                    {anime.title}
                  </h1>
                  <Button
                    variant="ghost"
                    onClick={toggleSeasonWatched}
                    className={cn(
                      "group text-xs sm:text-sm transition-all duration-300 hover:scale-105",
                      animeIsWatched ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {animeIsWatched ? (
                      <><Check className="w-4 h-4 mr-1.5 transition-transform duration-300 group-hover:scale-125" /> Watched Season</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-1.5 transition-transform duration-300 group-hover:rotate-90" /> Mark Season Watched</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                {anime.episodes && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <span>{anime.episodes} Episodes</span>
                  </div>
                )}
                {anime.duration && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span>{anime.duration} min per episode</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes */}
      <div className="px-6 md:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Play className="w-5 h-5 text-primary-foreground" />
            </div>
            Episodes
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {episodes.map((episodeNumber) => (
              <Card
                key={episodeNumber}
                className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 transition-all duration-300 group cursor-pointer"
                onClick={() => router.push(`/anime/${params.id}/season/${params.season_number}/episode/${episodeNumber}`)}
              >
                <CardContent className="p-4 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Play className="w-6 h-6 text-muted-foreground" />
                    </div>
                    {watchedEpisodes.has(episodeNumber) && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Eye className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-foreground font-semibold mb-2">Episode {episodeNumber}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatched(episodeNumber);
                    }}
                    className={cn(
                      "text-xs",
                      watchedEpisodes.has(episodeNumber) ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {watchedEpisodes.has(episodeNumber) ? (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        Watched
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3 mr-1" />
                        Mark Watched
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
