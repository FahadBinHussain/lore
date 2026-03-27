'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Star, Clock, Calendar,
  Check, Play, Eye, EyeOff, Users,
  Loader2, PlayCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EpisodeDetails {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
  guest_stars: any[];
  crew: any[];
  is_watched: boolean;
}

export default function EpisodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [episode, setEpisode] = useState<EpisodeDetails | null>(null);
  const [show, setShow] = useState<any>(null);
  const [season, setSeason] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const showIdParam = params.id as string;
        const seasonNumber = params.season_number as string;
        const episodeNumber = params.episode_number as string;

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

        // Fetch episode details
        const episodeResponse = await fetch(`/api/tv/${numericShowId}/season/${seasonNumber}/episode/${episodeNumber}`);
        if (!episodeResponse.ok) throw new Error('Failed to fetch episode details');
        const episodeData = await episodeResponse.json();
        setEpisode(episodeData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (params.id && params.season_number && params.episode_number) {
      fetchData();
    }
  }, [params.id, params.season_number, params.episode_number]);

  const toggleWatched = async () => {
    if (!episode) return;

    setUpdatingWatched(true);
    try {
      const showIdParam = params.id as string;
      const numericIdMatch = showIdParam.match(/(\d+)$/);
      const numericShowId = numericIdMatch ? numericIdMatch[1] : showIdParam;

      const response = await fetch(
        `/api/tv/${numericShowId}/season/${params.season_number}/episode/${params.episode_number}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_watched: !episode.is_watched }),
        }
      );

      if (!response.ok) throw new Error('Failed to update watch status');

      const result = await response.json();
      setEpisode(prev => prev ? { ...prev, is_watched: result.is_watched } : null);
    } catch (err) {
      console.error('Error updating watch status:', err);
    } finally {
      setUpdatingWatched(false);
    }
  };

  const navigateToEpisode = (direction: 'prev' | 'next') => {
    if (!season || !episode) return;

    const currentIndex = season.episodes.findIndex((ep: any) => ep.episode_number === episode.episode_number);
    if (currentIndex === -1) return;

    let targetIndex;
    if (direction === 'prev') {
      targetIndex = currentIndex - 1;
    } else {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex >= 0 && targetIndex < season.episodes.length) {
      const targetEpisode = season.episodes[targetIndex];
      router.push(`/tv/${params.id}/season/${params.season_number}/episode/${targetEpisode.episode_number}`);
    }
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

  if (error || !episode || !show || !season) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-white/60">{error || 'Failed to load episode details'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Video Modal */}
      {/* Hero Section with Backdrop */}
      <div className="relative h-[70vh] min-h-[600px] overflow-hidden">
        {episode.still_path ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{
              backgroundImage: `url(https://image.tmdb.org/t/p/original${episode.still_path})`
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
          <Link href={`/tv/${params.id}/season/${params.season_number}`}>
            <Button
              variant="ghost"
              className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-white transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {season.name}
            </Button>
          </Link>
        </div>

        {/* Episode Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Episode Still */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-video rounded-xl overflow-hidden shadow-2xl">
                {episode.still_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w780${episode.still_path}`}
                    alt={episode.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                    <PlayCircle className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>
              {episode.is_watched && (
                <div className="absolute -top-3 -right-3 bg-green-500 text-white font-bold px-3 py-1 rounded-lg shadow-lg text-sm flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Watched
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title and Episode Number */}
              <div className="mb-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-tight">
                  {episode.name}
                </h1>
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="secondary" className="bg-violet-500/20 text-violet-300 text-lg px-4 py-2">
                    S{episode.season_number}E{episode.episode_number.toString().padStart(2, '0')}
                  </Badge>
                  {episode.is_watched && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                      <Eye className="w-4 h-4 mr-1" />
                      Watched
                    </Badge>
                  )}
                </div>
                {episode.overview && (
                  <p className="text-xl text-white/70 italic font-light max-w-2xl">
                    {episode.overview}
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-6 mb-8">
                {episode.air_date && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Calendar className="w-5 h-5" />
                    <span className="text-lg">{new Date(episode.air_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                )}
                {episode.runtime && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Clock className="w-5 h-5" />
                    <span className="text-lg">{episode.runtime} minutes</span>
                  </div>
                )}
                {episode.vote_average > 0 && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <span className="text-lg">{episode.vote_average.toFixed(1)} ({episode.vote_count} votes)</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={toggleWatched}
                  disabled={updatingWatched}
                  className={cn(
                    "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-8 py-3 text-lg",
                    episode.is_watched && "from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                  )}
                >
                  {updatingWatched ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : episode.is_watched ? (
                    <EyeOff className="w-5 h-5 mr-2" />
                  ) : (
                    <Eye className="w-5 h-5 mr-2" />
                  )}
                  {episode.is_watched ? 'Mark as Unwatched' : 'Mark as Watched'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('prev')}
                  disabled={episode.episode_number === 1}
                  className="border-white/20 text-white hover:bg-white/10 px-6 py-3 text-lg"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Previous Episode
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('next')}
                  disabled={episode.episode_number === season.episodes.length}
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

      {/* Cast & Crew */}
      {(episode.guest_stars?.length > 0 || episode.crew?.length > 0) && (
        <div className="px-6 md:px-12 pb-12">
          <div className="max-w-7xl mx-auto">
            {/* Guest Stars */}
            {episode.guest_stars && episode.guest_stars.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  Guest Stars
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {episode.guest_stars.slice(0, 12).map((star: any) => (
                    <div key={star.id} className="group">
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 mb-3 group-hover:scale-105 transition-transform duration-300">
                        {star.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${star.profile_path}`}
                            alt={star.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                            <Users className="w-8 h-8 text-white/30" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="text-white font-semibold text-sm mb-1">{star.name}</h3>
                        <p className="text-white/60 text-xs">{star.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Crew */}
            {episode.crew && episode.crew.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  Crew
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {episode.crew.slice(0, 12).map((member: any) => (
                    <div key={`${member.id}-${member.job}`} className="group">
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 mb-3 group-hover:scale-105 transition-transform duration-300">
                        {member.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${member.profile_path}`}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                            <Users className="w-8 h-8 text-white/30" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="text-white font-semibold text-sm mb-1">{member.name}</h3>
                        <p className="text-white/60 text-xs">{member.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}