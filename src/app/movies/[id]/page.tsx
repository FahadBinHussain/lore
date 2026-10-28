'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Clock, Calendar, Globe, Bookmark, 
  Users, Loader2, Play,
  Heart, Share2, Check, Film,
  ExternalLink, TrendingUp, Award, Building2,
  ChevronDown, ChevronUp,
  PlayCircle, Image as ImageIcon, Sparkles,
  Camera, ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommentsSection } from '@/components/media/comments-section';
import { GalleryLightbox } from '@/components/media/gallery-lightbox';
import {
  FacebookBrandIcon,
  InstagramBrandIcon,
  TwitterBrandIcon,
} from '@/components/icons/social-icons';
import { cn } from '@/lib/utils';
import { DetailPageSkeleton } from '@/components/ui/skeleton';

interface Genre {
  id: number;
  name: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

interface Video {
  key: string;
  name: string;
  type: string;
  site: string;
}

interface SimilarMovie {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
}

interface ExternalIds {
  imdb_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

interface SpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

interface BackdropImage {
  file_path: string;
  width: number;
  height: number;
}

interface MovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genres: Genre[];
  runtime: number;
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
  original_language: string;
  popularity: number;
  adult: boolean;
  homepage: string;
  imdb_id: string;
  spoken_languages: SpokenLanguage[];
  production_countries: ProductionCountry[];
  production_companies: ProductionCompany[];
  belongs_to_collection: object | null;
  origin_country: string[];
  release_dates: object | null;
  video: boolean;
  images: object | null;
  content_rating: string | null;
  external_ids: ExternalIds;
  videos: {
    trailers: Video[];
    teasers: Video[];
    clips: Video[];
  };
  similar: SimilarMovie[];
  recommendations: SimilarMovie[];
  backdrops: BackdropImage[];
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
}

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [updatingWatchLater, setUpdatingWatchLater] = useState(false);
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [showAllCast, setShowAllCast] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<Video | null>(null);

  const fetchMovieDetails = useCallback(async () => {
    try {
      const idParam = params.id as string;
      
      if (idParam.startsWith('tv-')) {
        router.push(`/tv/${idParam}`);
        return;
      }
      
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch(`/api/movies/${numericId}`);
      if (!response.ok) {
        throw new Error('Movie not found');
      }
      const data = await response.json();
      setMovie(data);
      
      // Don't auto-play trailers - user must click to play
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movie');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  const fetchWatchedStatus = useCallback(async () => {
    try {
      const idParam = params.id as string;
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      console.log('Fetching watched status for mediaId:', numericId, 'mediaType: movie');
      const response = await fetch(`/api/media/status?mediaId=${numericId}&mediaType=movie`, {
        cache: 'no-cache'
      });
      console.log('Status response:', response.status, response.statusText);
      if (response.ok) {
        const data = await response.json();
        console.log('Watched status data:', data);
        setIsWatched(Boolean(data.isWatched));
        setIsWatchLater(Boolean(data.isWatchLater || data.status === 'plan_to_watch'));
      } else {
        console.error('Failed to fetch status:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch watched status:', err);
    }
  }, [params.id]);

  const handleMarkAsWatched = async () => {
    if (!movie) return;
    
    setUpdatingWatched(true);
    try {
      const idParam = params.id as string;
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
        body: JSON.stringify({
          mediaId: numericId,
          mediaType: 'movie',
          isWatched: !isWatched,
          title: movie.title,
          posterPath: movie.poster_path,
          releaseDate: movie.release_date,
        }),
      });
      
      if (response.ok) {
        const nextWatched = !isWatched;
        setIsWatched(nextWatched);
        if (nextWatched) {
          setIsWatchLater(false);
        }
      }
    } catch (err) {
      console.error('Failed to update watched status:', err);
    } finally {
      setUpdatingWatched(false);
    }
  };

  const handleWatchLaterToggle = async () => {
    if (!movie) return;
    setUpdatingWatchLater(true);
    try {
      const idParam = params.id as string;
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      const nextWatchLater = !isWatchLater;

      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
        body: JSON.stringify({
          mediaId: numericId,
          mediaType: 'movie',
          isWatchLater: nextWatchLater,
          title: movie.title,
          posterPath: movie.poster_path,
          releaseDate: movie.release_date,
        }),
      });

      if (response.ok) {
        setIsWatchLater(nextWatchLater);
        if (nextWatchLater) {
          setIsWatched(false);
        }
      }
    } catch (err) {
      console.error('Failed to update watch later status:', err);
    } finally {
      setUpdatingWatchLater(false);
    }
  };

  useEffect(() => {
    fetchMovieDetails();
  }, [params.id, fetchMovieDetails]);

  useEffect(() => {
    if (movie) {
      fetchWatchedStatus();
    }
  }, [movie, fetchWatchedStatus]);

  const getDirector = () => {
    return movie?.credits?.crew.find(person => person.job === 'Director');
  };

  const getWriters = () => {
    return movie?.credits?.crew.filter(person => ['Writer', 'Screenplay'].includes(person.job)) || [];
  };

  const getProducers = () => {
    return movie?.credits?.crew.filter(person => 
      ['Producer', 'Executive Producer'].includes(person.job)
    ) || [];
  };

  const getCinematographer = () => {
    return movie?.credits?.crew.find(person => person.job === 'Cinematography');
  };

  const getComposer = () => {
    return movie?.credits?.crew.find(person => person.job === 'Original Music Composer');
  };

  const getCast = () => {
    return movie?.credits?.cast || [];
  };

  const getDisplayCast = () => {
    const cast = getCast();
    return showAllCast ? cast : cast.slice(0, 8);
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getYear = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).getFullYear();
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-error/30 to-warning/30 rounded-full blur-xl opacity-50" />
          <Film className="w-20 h-20 text-primary relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">{error || 'Movie not found'}</h1>
        <Link href="/movies">
          <Button variant="outline" className="border-border text-foreground hover:bg-accent">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Video Modal */}
      {selectedTrailer && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedTrailer(null)}
        >
          <div className="relative w-full max-w-5xl aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${selectedTrailer.key}`}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; encrypted-media"
              allowFullScreen
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-foreground hover:bg-background/80"
              onClick={() => setSelectedTrailer(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Backdrop */}
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-10 lg:pb-12">
        {/* Backdrop Image & Gradients (Background only - overflow-hidden strictly here) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          {movie.backdrop_path ? (
            <div 
              className="absolute inset-0 bg-cover bg-center scale-105"
              style={{ 
                backgroundImage: `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})` 
              }}
              suppressHydrationWarning
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/25" />
          )}
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/25 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
          
          {/* Animated Background Effects */}
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-secondary/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button */}
        <div className="relative z-20 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto mb-4 sm:mb-6">
          <Button 
            variant="ghost" 
            className="bg-background/70 backdrop-blur-xl border border-border/80 hover:bg-background/90 text-foreground transition-all duration-300 group"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
            Back
          </Button>
        </div>

        {/* Movie Info & Poster (Normal flow, never overflows outside!) */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Poster */}
            <div className="flex-shrink-0 relative group mx-auto sm:mx-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-36 sm:w-44 md:w-52 lg:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {movie.poster_path ? (
                  <Image 
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    className="object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Film className="w-16 h-16 text-primary-content/80" />
                  </div>
                )}
              </div>
              {movie.content_rating && (
                <div className="absolute -top-3 -right-3 bg-primary text-primary-content font-bold px-3 py-1 rounded-lg shadow-lg text-sm">
                  {movie.content_rating}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title and Tagline */}
              <div className="mb-3 sm:mb-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-headline text-foreground mb-1 sm:mb-2 tracking-tight break-words">
                  {movie.title}
                </h1>
                {movie.original_title && movie.original_title !== movie.title && (
                  <p className="text-sm sm:text-base lg:text-lg text-muted-foreground/80 mb-1 sm:mb-2">
                    Original: {movie.original_title}
                  </p>
                )}
                {movie.tagline && (
                  <p className="text-sm sm:text-base lg:text-lg text-muted-foreground italic font-light">
                    &quot;{movie.tagline}&quot;
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-4 sm:mb-6">
                {movie.release_date && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border group/meta">
                    <Calendar className="w-4 h-4 text-accent transition-transform duration-200 group-hover/meta:scale-110" />
                    <span className="text-foreground font-medium text-xs sm:text-sm">
                      {getYear(movie.release_date)}
                    </span>
                  </div>
                )}
                
                {movie.runtime > 0 && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border group/meta">
                    <Clock className="w-4 h-4 text-primary transition-transform duration-200 group-hover/meta:scale-110" />
                    <span className="text-foreground font-medium text-xs sm:text-sm">{formatRuntime(movie.runtime)}</span>
                  </div>
                )}

                {/* Rating */}
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary/25 group/meta">
                  <Star className="w-4 h-4 fill-primary text-primary transition-transform duration-200 group-hover/meta:scale-110" />
                  <span className="font-bold text-xs sm:text-sm">{movie.vote_average.toFixed(1)}</span>
                  <span className="text-muted-foreground/80 text-xs">({movie.vote_count.toLocaleString()})</span>
                </div>

                {/* Status Badge */}
                <Badge className={cn(
                  "font-semibold text-xs",
                  movie.status === 'Released' ? 'badge-success' :
                  movie.status === 'In Production' ? 'badge-info' :
                  'badge-ghost'
                )}>
                  {movie.status}
                </Badge>
              </div>

              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-5 sm:mb-6">
                  {movie.genres.map((genre) => (
                    <span 
                      key={genre.id} 
                      className="px-3.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium text-xs sm:text-sm hover:bg-primary/20 transition-all duration-300 cursor-pointer"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
                {selectedTrailer || movie.videos?.trailers?.length > 0 ? (
                  <Button 
                    className="shadow-lg shadow-primary/25 transition-all duration-300 text-xs sm:text-sm group/btn"
                    onClick={() => {
                      if (movie.videos?.trailers?.length > 0) {
                        setSelectedTrailer(movie.videos.trailers[0]);
                      }
                    }}
                  >
                    <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 transition-transform duration-200 group-hover/btn:scale-110" />
                    Watch Trailer
                  </Button>
                ) : (
                  <Button className="shadow-lg shadow-primary/25 transition-all duration-300 text-xs sm:text-sm group/btn">
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 transition-transform duration-200 group-hover/btn:scale-110" />
                    Watch Now
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsWatched}
                  disabled={updatingWatched}
                  className={cn(
                    "transition-all duration-300 text-xs sm:text-sm group/btn",
                    isWatched && "bg-primary/20 border-primary/50 text-primary"
                  )}
                >
                  {updatingWatched ? (
                    <Loader2 className="w-4 h-4 mr-1.5 sm:mr-2 animate-spin" />
                  ) : (
                    <Check className={cn("w-4 h-4 mr-1.5 sm:mr-2 transition-transform duration-200 group-hover/btn:scale-110", isWatched && "fill-primary")} />
                  )}
                  {isWatched ? 'Watched' : 'Mark as Watched'}
                </Button>

                <Button 
                  variant="outline" 
                  onClick={handleWatchLaterToggle}
                  disabled={updatingWatchLater}
                  className={cn(
                    "transition-all duration-300 text-xs sm:text-sm group/btn",
                    isWatchLater && "bg-secondary/20 border-secondary/50 text-secondary"
                  )}
                >
                  {updatingWatchLater ? (
                    <Loader2 className="w-4 h-4 mr-1.5 sm:mr-2 animate-spin" />
                  ) : (
                    <Bookmark className={cn("w-4 h-4 mr-1.5 sm:mr-2 transition-transform duration-200 group-hover/btn:scale-110", isWatchLater && "fill-secondary")} />
                  )}
                  {isWatchLater ? 'In Watchlist' : 'Watch Later'}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "transition-all duration-300 h-9 w-9 sm:h-10 sm:w-10 group/btn",
                    isFavorite && "bg-destructive/20 border-destructive/50 text-destructive"
                  )}
                >
                  <Heart className={cn("w-4 h-4 transition-transform duration-200 group-hover/btn:scale-125", isFavorite && "fill-destructive")} />
                </Button>
                
                <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 group/btn">
                  <Share2 className="w-4 h-4 transition-transform duration-200 group-hover/btn:scale-110" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Overview */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl blur-xl" />
              <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border/80 p-8">
                <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  Overview
                </h2>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {movie.overview || 'No overview available.'}
                </p>
              </div>
            </section>

            {/* Videos Section */}
            {(movie.videos?.trailers?.length > 0 || movie.videos?.teasers?.length > 0 || movie.videos?.clips?.length > 0) && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6 text-secondary" />
                  Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {movie.videos.trailers.map((video, idx) => (
                    <Card 
                      key={`trailer-${idx}`}
                      className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedTrailer(video)}
                    >
                      <div className="aspect-video relative bg-muted">
                        <Image 
                          src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                          alt={video.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-12 h-12 text-primary-foreground" />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-foreground text-sm font-medium truncate">{video.name}</p>
                        <p className="text-muted-foreground/80 text-xs">Trailer</p>
                      </CardContent>
                    </Card>
                  ))}
                  {movie.videos.teasers.slice(0, 3).map((video, idx) => (
                    <Card 
                      key={`teaser-${idx}`}
                      className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-secondary/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedTrailer(video)}
                    >
                      <div className="aspect-video relative bg-muted">
                        <Image 
                          src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                          alt={video.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-12 h-12 text-primary-foreground" />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-foreground text-sm font-medium truncate">{video.name}</p>
                        <p className="text-muted-foreground/80 text-xs">Teaser</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Cast Section */}
            {getCast().length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <Users className="w-6 h-6 text-accent" />
                    Cast
                  </h2>
                  {getCast().length > 8 && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowAllCast(!showAllCast)}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      {showAllCast ? (
                        <>Show Less <ChevronUp className="w-4 h-4 ml-2" /></>
                      ) : (
                        <>Show All ({getCast().length}) <ChevronDown className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {getDisplayCast().map((actor) => (
                    <Link key={actor.id} href={`/people/${actor.id}`} className="block">
                      <Card className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-square relative overflow-hidden bg-muted">
                          {actor.profile_path ? (
                            <Image 
                              src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                              alt={actor.name}
                              fill
                              sizes="(min-width: 1024px) 33vw, 50vw"
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                              <Users className="w-12 h-12 text-muted-foreground/70" />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-foreground truncate">{actor.name}</p>
                          <p className="text-xs text-muted-foreground/80 truncate">{actor.character}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Crew Section */}
            {(getDirector() || getWriters().length > 0 || getProducers().length > 0 || getCinematographer() || getComposer()) && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-primary" />
                  Key Crew
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {getDirector() && (
                    <Link href={`/people/${getDirector()!.id}`} className="block">
                      <Card className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 hover:scale-[1.02] transition-all duration-300">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <Film className="w-6 h-6 text-primary-content" />
                          </div>
                          <div>
                            <p className="text-foreground font-semibold">{getDirector()?.name}</p>
                            <p className="text-primary text-sm">Director</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )}
                  {getWriters().slice(0, 2).map((writer) => (
                    <Link key={writer.id} href={`/people/${writer.id}`} className="block">
                      <Card className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 hover:scale-[1.02] transition-all duration-300">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary-content" />
                          </div>
                          <div>
                            <p className="text-foreground font-semibold">{writer.name}</p>
                            <p className="text-primary text-sm">{writer.job}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {getCinematographer() && (
                    <Link href={`/people/${getCinematographer()!.id}`} className="block">
                      <Card className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-accent/50 hover:scale-[1.02] transition-all duration-300">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center">
                            <Camera className="w-6 h-6 text-accent-content" />
                          </div>
                          <div>
                            <p className="text-foreground font-semibold">{getCinematographer()?.name}</p>
                            <p className="text-accent text-sm">Cinematography</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )}
                  {getComposer() && (
                    <Link href={`/people/${getComposer()!.id}`} className="block">
                      <Card className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-secondary/50 hover:scale-[1.02] transition-all duration-300">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                            <Award className="w-6 h-6 text-secondary-content" />
                          </div>
                          <div>
                            <p className="text-foreground font-semibold">{getComposer()?.name}</p>
                            <p className="text-secondary text-sm">Original Music</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )}
                  {getProducers().slice(0, 2).map((producer) => (
                    <Link key={producer.id} href={`/people/${producer.id}`} className="block">
                      <Card className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 hover:scale-[1.02] transition-all duration-300">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-primary-content" />
                          </div>
                          <div>
                            <p className="text-foreground font-semibold">{producer.name}</p>
                            <p className="text-primary text-sm">{producer.job}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Backdrops Gallery */}
            {movie.backdrops && movie.backdrops.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-secondary" />
                  Gallery
                </h2>
                <GalleryLightbox
                  title={movie.title}
                  images={movie.backdrops.map((b) => ({
                    src: `https://image.tmdb.org/t/p/w780${b.file_path}`,
                    full: `https://image.tmdb.org/t/p/original${b.file_path}`,
                    width: b.width,
                    height: b.height,
                  }))}
                />
              </section>
            )}

            {/* Similar Movies */}
            {movie.similar && movie.similar.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <ThumbsUp className="w-6 h-6 text-primary" />
                  Similar Movies
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {movie.similar.map((similar) => (
                    <Link key={similar.id} href={`/movies/movie-${similar.id}`}>
                      <Card className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-primary/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {similar.poster_path ? (
                            <Image 
                              src={`https://image.tmdb.org/t/p/w300${similar.poster_path}`}
                              alt={similar.title}
                              fill
                              sizes="(min-width: 1024px) 33vw, 50vw"
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                              <Film className="w-10 h-10 text-muted-foreground/70" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-warning text-warning" />
                            <span className="text-foreground text-xs font-semibold">{similar.vote_average.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-foreground truncate">{similar.title}</p>
                          <p className="text-xs text-muted-foreground/80">{similar.release_date ? getYear(similar.release_date) : '—'}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {movie.recommendations && movie.recommendations.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-secondary" />
                  Recommendations
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {movie.recommendations.map((rec) => (
                    <Link key={rec.id} href={`/movies/movie-${rec.id}`}>
                      <Card className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-secondary/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {rec.poster_path ? (
                            <Image 
                              src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`}
                              alt={rec.title}
                              fill
                              sizes="(min-width: 1024px) 33vw, 50vw"
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/10 to-accent/10">
                              <Film className="w-10 h-10 text-muted-foreground/70" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-warning text-warning" />
                            <span className="text-foreground text-xs font-semibold">{rec.vote_average.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-foreground truncate">{rec.title}</p>
                          <p className="text-xs text-muted-foreground/80">{rec.release_date ? getYear(rec.release_date) : '—'}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* External Links */}
            <section>
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-primary" />
                External Links
              </h3>
              <div className="space-y-3">
                {movie.external_ids?.imdb_id && (
                  <a 
                    href={`https://www.imdb.com/title/${movie.external_ids.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-primary/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/30">
                      IMDb
                    </div>
                    <span className="text-foreground group-hover:text-primary transition-colors">View on IMDb</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-primary" />
                  </a>
                )}
                {movie.external_ids?.facebook_id && (
                  <a 
                    href={`https://www.facebook.com/${movie.external_ids.facebook_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-primary/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
                      <FacebookBrandIcon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-foreground group-hover:text-primary transition-colors">Facebook</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-primary" />
                  </a>
                )}
                {movie.external_ids?.instagram_id && (
                  <a 
                    href={`https://www.instagram.com/${movie.external_ids.instagram_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-secondary/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center border border-secondary/30">
                      <InstagramBrandIcon className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="text-foreground group-hover:text-secondary transition-colors">Instagram</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-secondary" />
                  </a>
                )}
                {movie.external_ids?.twitter_id && (
                  <a 
                    href={`https://twitter.com/${movie.external_ids.twitter_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-primary/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
                      <TwitterBrandIcon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-foreground group-hover:text-primary transition-colors">Twitter</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-primary" />
                  </a>
                )}
                {movie.homepage && (
                  <a 
                    href={movie.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-primary/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-foreground group-hover:text-primary transition-colors">Official Website</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-primary" />
                  </a>
                )}
              </div>
            </section>

            {/* Details Card */}
            <section className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/80 p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Details</h3>
              <div className="space-y-4">
                {movie.status && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Status</span>
                    <span className="text-foreground font-medium">{movie.status}</span>
                  </div>
                )}
                
                {movie.original_language && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Original Language</span>
                    <span className="text-foreground font-medium uppercase">{movie.original_language}</span>
                  </div>
                )}

                {movie.production_countries && movie.production_countries.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Production Countries</span>
                    <span className="text-foreground font-medium text-right">{movie.production_countries.map(c => c.name).join(', ')}</span>
                  </div>
                )}

                {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-sm block mb-2">Spoken Languages</span>
                    <div className="flex flex-wrap gap-2">
                      {movie.spoken_languages.map((lang) => (
                        <Badge key={lang.iso_639_1} variant="outline" className="border-border text-muted-foreground">
                          {lang.english_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Popularity</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-foreground font-medium">{movie.popularity.toFixed(0)}</span>
                  </div>
                </div>

                {movie.budget > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Budget</span>
                    <span className="text-foreground font-medium">{formatCurrency(movie.budget)}</span>
                  </div>
                )}

                {movie.revenue > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Revenue</span>
                    <span className="text-foreground font-medium">{formatCurrency(movie.revenue)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Production Companies */}
            {movie.production_companies && movie.production_companies.length > 0 && (
              <section className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/80 p-6">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-accent" />
                  Production Companies
                </h3>
                <div className="space-y-3">
                  {movie.production_companies.slice(0, 5).map((company) => (
                    <div key={company.id} className="flex items-center gap-3 p-3 bg-muted/70 rounded-xl border border-border">
                      {company.logo_path ? (
                        <Image 
                          src={`https://image.tmdb.org/t/p/w92${company.logo_path}`}
                          alt={company.name}
                          width={32}
                          height={32}
                          className="h-8 w-auto object-contain invert brightness-0 dark:invert-0 dark:brightness-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <span className="text-foreground font-medium text-sm block">{company.name}</span>
                        <span className="text-muted-foreground/80 text-xs">{company.origin_country}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {movie ? (
          <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
            <CommentsSection
              mediaId={String(movie.id)}
              mediaType="movie"
              title={movie.title}
              posterPath={movie.poster_path}
              releaseDate={movie.release_date ?? null}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}




