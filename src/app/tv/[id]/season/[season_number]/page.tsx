'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Star, Clock, Calendar,
  Check, Play, Eye, EyeOff,
  Loader2, Monitor, PlayCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  episodes: Episode[];
}

export default function SeasonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [season, setSeason] = useState<SeasonDetails | null>(null);
  const [show, setShow] = useState<any>(null);
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
        const showData = await showResponse.json();
        setShow(showData);

        // Fetch season details
        const seasonResponse = await fetch(`/api/tv/${numericShowId}/season/${seasonNumber}`);
        if (!seasonResponse.ok) throw new Error('Failed to fetch season details');
        const seasonData = await seasonResponse.json();
        setSeason(seasonData);

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

  const toggleWatched = async (episodeId: number) => {
    // For now, just toggle locally
    // TODO: Implement API call to mark episode as watched/unwatched
    const newWatched = new Set(watchedEpisodes);
    if (newWatched.has(episodeId)) {
      newWatched.delete(episodeId);
    } else {
      newWatched.add(episodeId);
    }
    setWatchedEpisodes(newWatched);
  };

  const getYear = (dateString: string) => {
    return new Date(dateString).getFullYear();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (error || !season || !show) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-white/60">{error || 'Failed to load season details'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section with Backdrop */}
      <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
        {season.poster_path ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{
              backgroundImage: `url(https://image.tmdb.org/t/p/original${season.poster_path})`
            }}
            suppressHydrationWarning
          />
        ) : show.backdrop_path ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{
              backgroundImage: `url(https://image.tmdb.org/t/p/original${show.backdrop_path})`
            }}
            suppressHydrationWarning
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-cyan-600/30" />
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />

        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-fuchsia-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-20">
          <Link href={`/tv/${params.id}`}>
            <Button
              variant="ghost"
              className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-white transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {show.name}
            </Button>
          </Link>
        </div>

        {/* Season Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {season.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${season.poster_path}`}
                    alt={season.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                    <Monitor className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title and Season Number */}
              <div className="mb-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-tight">
                  {season.name}
                </h1>
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="secondary" className="bg-violet-500/20 text-violet-300 text-lg px-4 py-2">
                    Season {season.season_number}
                  </Badge>
                </div>
                {season.overview && (
                  <p className="text-xl text-white/70 italic font-light max-w-2xl">
                    {season.overview}
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-6 mb-8">
                {season.air_date && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Calendar className="w-5 h-5" />
                    <span className="text-lg">{getYear(season.air_date)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-white/80">
                  <PlayCircle className="w-5 h-5" />
                  <span className="text-lg">{season.episode_count} Episodes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes */}
      <div className="px-6 md:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-white" />
            </div>
            Episodes
          </h2>

          <div className="space-y-6">
            {season.episodes.map((episode) => (
              <Card
                key={episode.id}
                className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-violet-500/50 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Episode Still */}
                    <div className="flex-shrink-0 w-48">
                      <Link href={`/tv/${params.id}/season/${params.season_number}/episode/${episode.episode_number}`}>
                        {episode.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                            alt={episode.name}
                            className="w-full aspect-video rounded-lg object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center hover:scale-105 transition-transform duration-300">
                            <PlayCircle className="w-8 h-8 text-white/30" />
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
                            <h3 className="text-xl font-semibold text-white">
                              {episode.episode_number}. {episode.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-white/60">
                              {episode.air_date && (
                                <span>{new Date(episode.air_date).toLocaleDateString()}</span>
                              )}
                              {episode.runtime && (
                                <span>{episode.runtime} min</span>
                              )}
                              {episode.vote_average > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-400" />
                                  <span>{episode.vote_average.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {episode.overview && (
                            <p className="text-white/70 leading-relaxed mt-2 line-clamp-2">
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
                            toggleWatched(episode.id);
                          }}
                          className={cn(
                            "text-white hover:bg-white/10 ml-4",
                            watchedEpisodes.has(episode.id) && "text-green-400"
                          )}
                        >
                          {watchedEpisodes.has(episode.id) ? (
                            <Eye className="w-4 h-4 mr-2" />
                          ) : (
                            <EyeOff className="w-4 h-4 mr-2" />
                          )}
                          {watchedEpisodes.has(episode.id) ? 'Watched' : 'Mark as Watched'}
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