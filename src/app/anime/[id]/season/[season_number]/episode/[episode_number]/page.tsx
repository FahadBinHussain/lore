'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Play, Eye, EyeOff,
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
  const [animeIsWatched, setAnimeIsWatched] = useState(false);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-white/60">{error || 'Failed to load anime'}</p>
        </div>
      </div>
    );
  }

  const currentEpisode = currentEpisodeNumber;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
        {anime.image ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{
              backgroundImage: `url(${anime.image})`
            }}
            suppressHydrationWarning
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600/30 via-purple-600/20 to-fuchsia-600/30" />
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />

        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-pink-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-20">
          <Link href={`/anime/${params.id}/season/${params.season_number}`}>
            <Button
              variant="ghost"
              className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-white transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Season
            </Button>
          </Link>
        </div>

        {/* Episode Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Episode Thumbnail Placeholder */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-fuchsia-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-video rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                <Play className="w-16 h-16 text-white/70" />
                {isWatched && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Eye className="w-12 h-12 text-green-400" />
                  </div>
                )}
              </div>
              {isWatched && (
                <div className="absolute -top-3 -right-3 bg-green-500 text-white font-bold px-3 py-1 rounded-lg shadow-lg text-sm flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Watched
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title and Episode */}
              <div className="mb-4">
                <Badge variant="outline" className="mb-2 bg-pink-500/20 text-pink-400 border-pink-500/30">
                  <Zap className="w-3 h-3 mr-1" />
                  Anime Episode
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-tight">
                  {anime.title}
                </h1>
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 text-lg px-4 py-2">
                    Episode {currentEpisode}
                  </Badge>
                  {anime.season && anime.seasonYear && (
                    <Badge variant="outline" className="bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30">
                      {anime.season} {anime.seasonYear}
                    </Badge>
                  )}
                </div>
                <p className="text-xl text-white/70 italic font-light">
                  Episode {currentEpisode} of {anime.title}
                </p>
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-6 mb-8">
                {anime.duration && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Clock className="w-5 h-5" />
                    <span className="text-lg">{anime.duration} minutes</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-white/80">
                  <Play className="w-5 h-5" />
                  <span className="text-lg">Episode {currentEpisode} of {anime.episodes}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={toggleWatched}
                  disabled={updatingWatched}
                  className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-8 py-3 text-lg"
                >
                  {updatingWatched ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 mr-2" />
                  )}
                  {isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('prev')}
                  disabled={currentEpisode === 1}
                  className="border-white/20 text-white hover:bg-white/10 px-6 py-3 text-lg"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Previous Episode
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('next')}
                  disabled={currentEpisode === anime.episodes}
                  className="border-white/20 text-white hover:bg-white/10 px-6 py-3 text-lg"
                >
                  Next Episode
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode Notes */}
      <div className="px-6 md:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">Episode {currentEpisode}</h3>
              <p className="text-white/70 leading-relaxed">
                This is episode {currentEpisode} of {anime.title}. Since AniList doesn't provide detailed episode information,
                you can use this page to track your watching progress. More detailed episode information may be added in the future
                if additional APIs are integrated.
              </p>

              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <h4 className="text-white font-semibold mb-2">Progress</h4>
                <div className="flex items-center gap-4 text-sm text-white/60">
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