'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Star, Clock, Calendar,
  Eye, EyeOff, Users,
  Loader2, PlayCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DetailPageSkeleton } from '@/components/ui/skeleton';
import { CommentsSection } from '@/components/media/comments-section';

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
  guest_stars: GuestStar[];
  crew: CrewMember[];
  is_watched: boolean;
}

interface GuestStar {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
  department: string;
}

interface SeasonBrief {
  name: string;
  seasons: Array<{ id: number; season_number: number; name: string }>;
  episodes: Array<{ episode_number: number }>;
}

interface ShowBrief {
  name: string;
  backdrop_path: string | null;
  seasons: Array<{ id: number; season_number: number }>;
}

export default function EpisodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [episode, setEpisode] = useState<EpisodeDetails | null>(null);
  const [show, setShow] = useState<ShowBrief | null>(null);
  const [season, setSeason] = useState<SeasonBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

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

    const currentIndex = season.episodes.findIndex((ep) => ep.episode_number === episode.episode_number);
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

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error || !episode || !show || !season) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Error</h1>
          <p className="text-muted-foreground">{error || 'Failed to load episode details'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Video Modal */}
      {/* Hero Section with Backdrop */}
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-10 lg:pb-12">
        {/* Background Backdrop Layer - isolated overflow-hidden */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          {episode.still_path ? (
            <div
              className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
              style={{
                backgroundImage: `url(https://image.tmdb.org/t/p/original${episode.still_path})`
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
          <Link href={`/tv/${params.id}/season/${params.season_number}`}>
            <Button
              variant="ghost"
              className="group bg-background/65 backdrop-blur-xl border border-border hover:bg-background/80 text-foreground transition-all duration-300 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
              Back to {season.name}
            </Button>
          </Link>
        </div>

        {/* Episode Info in normal document flow */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Episode Still */}
            <div className="flex-shrink-0 relative group w-fit">
              <div className="rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent p-[1.5px] shadow-[0_0_28px_-6px_var(--color-primary)] transition-shadow duration-500 group-hover:shadow-[0_0_36px_-4px_var(--color-primary)]">
                <div className="relative w-44 sm:w-52 md:w-60 lg:w-64 aspect-video rounded-[14px] overflow-hidden bg-black/40">
                  {episode.still_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w780${episode.still_path}`}
                      alt={episode.name}
                      fill
                      priority
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transform group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-primary-content/80" />
                    </div>
                  )}
                </div>
              </div>
              {episode.is_watched && (
                <div className="absolute -top-3 -right-3 bg-success text-success-content font-bold px-2.5 py-0.5 rounded-lg shadow-lg text-xs flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Watched
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title and Episode Number */}
              <div className="mb-3 sm:mb-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 tracking-tight">
                  {episode.name}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3 mb-3 sm:mb-4">
                  <Badge variant="secondary" className="bg-primary/20 text-primary text-xs sm:text-sm px-3 py-1 transition-transform duration-300 hover:scale-105">
                    S{episode.season_number}E{episode.episode_number.toString().padStart(2, '0')}
                  </Badge>
                  {episode.is_watched && (
                    <Badge variant="secondary" className="bg-success/20 text-success text-xs sm:text-sm px-3 py-1 transition-transform duration-300 hover:scale-105">
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Watched
                    </Badge>
                  )}
                </div>
                {episode.overview && (
                  <div className="max-w-2xl mx-auto sm:mx-0">
                    <p className={cn(
                      "text-sm sm:text-base leading-relaxed text-foreground/85",
                      !overviewExpanded && "line-clamp-3"
                    )}>
                      {episode.overview}
                    </p>
                    {episode.overview.length > 160 && (
                      <button
                        type="button"
                        onClick={() => setOverviewExpanded((v) => !v)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        {overviewExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                {episode.air_date && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span>{new Date(episode.air_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                )}
                {episode.runtime && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <span>{episode.runtime} minutes</span>
                  </div>
                )}
                {episode.vote_average > 0 && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-primary text-primary transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                    <span>{episode.vote_average.toFixed(1)} ({episode.vote_count} votes)</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
                <Button
                  onClick={toggleWatched}
                  disabled={updatingWatched}
                  className={cn(
                    "group px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105",
                    episode.is_watched && "btn-secondary shadow-secondary/25"
                  )}
                >
                  {updatingWatched ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : episode.is_watched ? (
                    <EyeOff className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                  )}
                  {episode.is_watched ? 'Mark as Unwatched' : 'Mark as Watched'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('prev')}
                  disabled={episode.episode_number === 1}
                  className="group border-border text-foreground hover:bg-accent px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm transition-all duration-300 hover:scale-105"
                >
                  <ChevronLeft className="w-4 h-4 mr-1 transition-transform duration-300 group-hover:-translate-x-1" />
                  Previous Episode
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateToEpisode('next')}
                  disabled={episode.episode_number === season.episodes.length}
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

      {/* Cast & Crew */}
      {(episode.guest_stars?.length > 0 || episode.crew?.length > 0) && (
        <div className="px-6 md:px-12 pb-12">
          <div className="max-w-7xl mx-auto">
            {episode.guest_stars && episode.guest_stars.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  Guest Stars
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {episode.guest_stars.slice(0, 12).map((star) => (
                    <div key={star.id} className="group">
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted mb-3 group-hover:scale-105 transition-transform duration-300">
                        {star.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w300${star.profile_path}`}
                            alt={star.name}
                            fill
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-base-200 flex items-center justify-center">
                            <Users className="w-8 h-8 text-muted-foreground/70" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="text-foreground font-semibold text-sm mb-1">{star.name}</h3>
                        <p className="text-muted-foreground text-xs">{star.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {episode.crew && episode.crew.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/15 border border-secondary/25 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  Crew
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {episode.crew.slice(0, 12).map((member) => (
                    <div key={`${member.id}-${member.job}`} className="group">
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted mb-3 group-hover:scale-105 transition-transform duration-300">
                        {member.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w300${member.profile_path}`}
                            alt={member.name}
                            fill
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-base-200 flex items-center justify-center">
                            <Users className="w-8 h-8 text-muted-foreground/70" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="text-foreground font-semibold text-sm mb-1">{member.name}</h3>
                        <p className="text-muted-foreground text-xs">{member.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {episode ? (
        <div className="px-6 md:px-12 pb-16">
          <div className="max-w-7xl mx-auto">
            <CommentsSection
              mediaId={(params.id as string).match(/(\d+)$/)?.[1] ?? (params.id as string)}
              mediaType="tv"
              episodeKey={`${(params.id as string).match(/(\d+)$/)?.[1] ?? (params.id as string)}-${params.season_number}-${params.episode_number}`}
              episodeSource="tmdb"
              title={episode.name}
              posterPath={episode.still_path ? `https://image.tmdb.org/t/p/w342${episode.still_path}` : null}
              releaseDate={episode.air_date ?? null}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}




