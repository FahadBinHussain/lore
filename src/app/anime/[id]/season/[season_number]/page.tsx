'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Star, Clock, Calendar,
  Play, Eye, EyeOff, Loader2,
  Monitor, Zap, Check, Plus
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
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        {anime.image ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{
              backgroundImage: `url(${anime.image})`
            }}
            suppressHydrationWarning
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/25" />
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-transparent to-background/45" />

        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-secondary/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-20">
          <Link href={`/anime/${params.id}`}>
            <Button
              variant="ghost"
              className="bg-background/65 backdrop-blur-xl border border-border hover:bg-background/80 text-foreground transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {anime.title}
            </Button>
          </Link>
        </div>

        {/* Anime Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {anime.image ? (
                  <img
                    src={anime.image}
                    alt={anime.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/70 to-secondary/70 flex items-center justify-center">
                    <Zap className="w-16 h-16 text-primary-foreground/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title and Season */}
              <div className="mb-4">
                <Badge variant="outline" className="mb-2 bg-primary/15 text-primary border-primary/30">
                  <Zap className="w-3 h-3 mr-1" />
                  Anime Season
                </Badge>
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight">
                    {anime.title}
                  </h1>
                  <Button
                    variant="ghost"
                    onClick={toggleSeasonWatched}
                    className={cn(
                      "mt-2",
                      animeIsWatched ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {animeIsWatched ? (
                      <><Check className="w-6 h-6 mr-2" /> Watched Season</>
                    ) : (
                      <><Plus className="w-6 h-6 mr-2" /> Mark Season Watched</>
                    )}
                  </Button>
                </div>
                {anime.season && anime.seasonYear && (
                  <Badge variant="outline" className="bg-secondary/15 text-secondary border-secondary/30">
                    {anime.season} {anime.seasonYear}
                  </Badge>
                )}
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-6 mb-8">
                {anime.episodes && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Play className="w-5 h-5" />
                    <span className="text-lg">{anime.episodes} Episodes</span>
                  </div>
                )}
                {anime.duration && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-5 h-5" />
                    <span className="text-lg">{anime.duration} min per episode</span>
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
