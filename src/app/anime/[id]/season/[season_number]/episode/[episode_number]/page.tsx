'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Play, Eye,
  Loader2, Check, Clock, Zap,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnimeDetails {
  id: number;
  title: string;
  image: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
}

export default function AnimeEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [, setAnimeIsWatched] = useState(false);

  const currentEpisodeNumber = parseInt(params.episode_number as string);

  useEffect(() => {
    const fetchAnimeDetails = async () => {
      try {
        const response = await fetch(`/api/anime/${params.id}`);
        if (!response.ok) throw new Error('Anime not found');
        const data = await response.json();
        setAnime(data);

        // Fetch parent watched status after anime details are loaded
        const statusResponse = await fetch(`/api/media/status?mediaId=${params.id}&mediaType=anime`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setAnimeIsWatched(Boolean(statusData.isWatched));

          const watchedEpisodes = Array.isArray(statusData.watchedEpisodes)
            ? statusData.watchedEpisodes
            : [];
          setIsWatched(watchedEpisodes.includes(currentEpisodeNumber));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load anime');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchAnimeDetails();
    }
  }, [params.id, currentEpisodeNumber]);

  const toggleWatched = async () => {
    if (!anime) return;

    const nextIsWatched = !isWatched;

    setIsWatched(nextIsWatched);

    setUpdatingWatched(true);
    try {
      await fetch(`/api/anime/${params.id}/season/${params.season_number}/episode/${currentEpisodeNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_watched: nextIsWatched,
          title: anime.title,
          posterPath: anime.image,
          releaseDate: anime.seasonYear ? `${anime.seasonYear}-01-01` : null,
          totalEpisodes: anime.episodes,
        }),
      });

      const statusResponse = await fetch(`/api/media/status?mediaId=${params.id}&mediaType=anime`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setAnimeIsWatched(Boolean(statusData.isWatched));

        const watchedEpisodes = Array.isArray(statusData.watchedEpisodes)
          ? statusData.watchedEpisodes
          : [];
        setIsWatched(watchedEpisodes.includes(currentEpisodeNumber));
      }
    } catch (err) {
      console.error('Failed to update anime episode watched status:', err);
      setIsWatched(!nextIsWatched);
    } finally {
      setUpdatingWatched(false);
    }
  };

  const navigateToEpisode = (direction: 'prev' | 'next') => {
    if (!anime) return;

    const currentEpisode = parseInt(params.episode_number as string);
    let targetEpisode;

    if (direction === 'prev') {
      targetEpisode = currentEpisode - 1;
    } else {
      targetEpisode = currentEpisode + 1;
    }

    if (targetEpisode >= 1 && targetEpisode <= (anime.episodes || 0)) {
      router.push(`/anime/${params.id}/season/${params.season_number}/episode/${targetEpisode}`);
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

  const currentEpisode = currentEpisodeNumber;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Hero Section */}
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
          <Link href={`/anime/${params.id}/season/${params.season_number}`}>
            <Button
              variant="ghost"
              className="group bg-background/65 backdrop-blur-xl border border-border hover:bg-background/80 text-foreground transition-all duration-300 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
              Back to Season
            </Button>
          </Link>
        </div>

        {/* Episode Info in normal document flow */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Episode Thumbnail Placeholder */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-44 sm:w-52 md:w-60 lg:w-64 aspect-video rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center border border-border/30">
                <Play className="w-12 sm:w-16 h-12 sm:h-16 text-muted-foreground/60 transition-transform duration-300 group-hover:scale-110" />
                {isWatched && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Eye className="w-10 sm:w-12 h-10 sm:h-12 text-primary" />
                  </div>
                )}
              </div>
              {isWatched && (
                <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground font-bold px-2.5 py-0.5 rounded-lg shadow-lg text-xs flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Watched
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title and Episode */}
              <div className="mb-3 sm:mb-4">
                <Badge variant="outline" className="mb-2 bg-primary/15 text-primary border-primary/30 text-xs sm:text-sm">
                  <Zap className="w-3 h-3 mr-1" />
                  Anime Episode
                </Badge>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 tracking-tight">
                  {anime.title}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3 mb-2 sm:mb-3">
                  <Badge variant="secondary" className="bg-secondary/15 text-secondary text-xs sm:text-sm px-3 py-1 transition-transform duration-300 hover:scale-105">
                    Episode {currentEpisode}
                  </Badge>
                  {anime.season && anime.seasonYear && (
                    <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-xs sm:text-sm">
                      {anime.season} {anime.seasonYear}
                    </Badge>
                  )}
                </div>
                <p className="text-sm sm:text-base text-muted-foreground italic font-light">
                  Episode {currentEpisode} of {anime.title}
                </p>
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                {anime.duration && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span>{anime.duration} minutes</span>
                  </div>
                )}
                <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                  <span>Episode {currentEpisode} of {anime.episodes}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
                <Button
                  onClick={toggleWatched}
                  disabled={updatingWatched}
                  className="group bg-primary text-primary-foreground hover:bg-primary/90 px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105"
                >
                  {updatingWatched ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-125" />
                  )}
                  {isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('prev')}
                  disabled={currentEpisode === 1}
                  className="group border-border text-foreground hover:bg-accent px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm transition-all duration-300 hover:scale-105"
                >
                  <ChevronLeft className="w-4 h-4 mr-1 transition-transform duration-300 group-hover:-translate-x-1" />
                  Previous Episode
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('next')}
                  disabled={currentEpisode === anime.episodes}
                  className="group border-border text-foreground hover:bg-accent px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm transition-all duration-300 hover:scale-105"
                >
                  Next Episode
                  <ChevronRight className="w-4 h-4 ml-1 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode Notes */}
      <div className="px-6 md:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-card/80 backdrop-blur-xl border border-border/80">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-foreground mb-4">Episode {currentEpisode}</h3>
              <p className="text-muted-foreground leading-relaxed">
                This is episode {currentEpisode} of {anime.title}. Since AniList doesn&apos;t provide detailed episode information,
                you can use this page to track your watching progress. More detailed episode information may be added in the future
                if additional APIs are integrated.
              </p>

              <div className="mt-6 p-4 bg-muted/70 rounded-lg border border-border">
                <h4 className="text-foreground font-semibold mb-2">Progress</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Episode {currentEpisode} of {anime.episodes}</span>
                  <span>•</span>
                  <span>{isWatched ? 'Completed' : 'Not watched'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
