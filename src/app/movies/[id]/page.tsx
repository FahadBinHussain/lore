'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Clock, Calendar, Globe, 
  Users, Loader2, Play, Plus, 
  Heart, Share2, Check, Film, Monitor,
  ExternalLink, TrendingUp, Award, Building2,
  Languages, MapPin, ChevronDown, ChevronUp,
  PlayCircle, Image as ImageIcon, Sparkles,
  MessageCircle, Camera, ThumbsUp, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  belongs_to_collection: any | null;
  origin_country: string[];
  release_dates: any | null;
  video: boolean;
  images: any | null;
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
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [showAllCast, setShowAllCast] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<Video | null>(null);

  const fetchMovieDetails = async () => {
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
  };

  const fetchWatchedStatus = async () => {
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
        setIsWatched(data.isWatched);
      } else {
        console.error('Failed to fetch status:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch watched status:', err);
    }
  };

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
        setIsWatched(!isWatched);
      }
    } catch (err) {
      console.error('Failed to update watched status:', err);
    } finally {
      setUpdatingWatched(false);
    }
  };

  useEffect(() => {
    fetchMovieDetails();
  }, [params.id]);

  useEffect(() => {
    if (movie) {
      fetchWatchedStatus();
    }
  }, [movie]);

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-xl opacity-50 animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin text-white relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-xl opacity-50" />
          <Film className="w-20 h-20 text-white relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-white">{error || 'Movie not found'}</h1>
        <Link href="/movies">
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setSelectedTrailer(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Backdrop */}
      <div className="relative h-[50vh] sm:h-[60vh] lg:h-[70vh] min-h-[400px] sm:min-h-[500px] lg:min-h-[600px] overflow-hidden">
        {movie.backdrop_path ? (
          <div 
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ 
              backgroundImage: `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})` 
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
          <Button 
            variant="ghost" 
            className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-white transition-all duration-300"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Movie Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 lg:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 relative group mx-auto sm:mx-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-32 sm:w-40 md:w-48 lg:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {movie.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                    <Film className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>
              {movie.content_rating && (
                <div className="absolute -top-3 -right-3 bg-amber-500 text-black font-bold px-3 py-1 rounded-lg shadow-lg text-sm">
                  {movie.content_rating}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title and Tagline */}
              <div className="mb-3 sm:mb-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold text-white mb-1 sm:mb-2 tracking-tight">
                  {movie.title}
                </h1>
                {movie.original_title && movie.original_title !== movie.title && (
                  <p className="text-sm sm:text-base lg:text-lg text-white/50 mb-1 sm:mb-2">
                    Original: {movie.original_title}
                  </p>
                )}
                {movie.tagline && (
                  <p className="text-base sm:text-lg lg:text-xl text-white/70 italic font-light">
                    "{movie.tagline}"
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                {movie.release_date && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span className="text-white font-medium">
                      {getYear(movie.release_date)}
                    </span>
                  </div>
                )}
                
                {movie.runtime > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <Clock className="w-4 h-4 text-violet-400" />
                    <span className="text-white font-medium">{formatRuntime(movie.runtime)}</span>
                  </div>
                )}

                {/* Rating */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-amber-400">{movie.vote_average.toFixed(1)}</span>
                  <span className="text-white/50 text-sm">({movie.vote_count.toLocaleString()})</span>
                </div>

                {/* Status Badge */}
                <Badge className={cn(
                  "font-semibold",
                  movie.status === 'Released' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  movie.status === 'In Production' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  'bg-slate-500/20 text-slate-400 border-slate-500/30'
                )}>
                  {movie.status}
                </Badge>
              </div>

              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {movie.genres.map((genre) => (
                    <span 
                      key={genre.id} 
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-violet-300 font-medium text-sm hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-all duration-300 cursor-pointer"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {selectedTrailer || movie.videos?.trailers?.length > 0 ? (
                  <Button 
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 transition-all duration-300"
                    onClick={() => {
                      if (movie.videos?.trailers?.length > 0) {
                        setSelectedTrailer(movie.videos.trailers[0]);
                      }
                    }}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Watch Trailer
                  </Button>
                ) : (
                  <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 transition-all duration-300">
                    <Play className="w-5 h-5 mr-2" />
                    Watch Now
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsWatched}
                  disabled={updatingWatched}
                  className={cn(
                    "border-white/20 text-white hover:bg-white/10 transition-all duration-300",
                    isWatched && "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  )}
                >
                  {updatingWatched ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className={cn("w-4 h-4 mr-2", isWatched && "fill-emerald-400")} />
                  )}
                  {isWatched ? 'Watched' : 'Mark as Watched'}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "border-white/20 text-white hover:bg-white/10 transition-all duration-300",
                    isFavorite && "bg-red-500/20 border-red-500/50 text-red-400"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isFavorite && "fill-red-400")} />
                </Button>
                
                <Button variant="outline" size="icon" className="border-white/20 text-white hover:bg-white/10">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Overview */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 rounded-3xl blur-xl" />
              <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-violet-400" />
                  Overview
                </h2>
                <p className="text-white/80 leading-relaxed text-lg">
                  {movie.overview || 'No overview available.'}
                </p>
              </div>
            </section>

            {/* Videos Section */}
            {(movie.videos?.trailers?.length > 0 || movie.videos?.teasers?.length > 0 || movie.videos?.clips?.length > 0) && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6 text-fuchsia-400" />
                  Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {movie.videos.trailers.map((video, idx) => (
                    <Card 
                      key={`trailer-${idx}`}
                      className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-violet-500/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedTrailer(video)}
                    >
                      <div className="aspect-video relative bg-slate-800">
                        <img 
                          src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-12 h-12 text-white" />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-white text-sm font-medium truncate">{video.name}</p>
                        <p className="text-white/50 text-xs">Trailer</p>
                      </CardContent>
                    </Card>
                  ))}
                  {movie.videos.teasers.slice(0, 3).map((video, idx) => (
                    <Card 
                      key={`teaser-${idx}`}
                      className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-fuchsia-500/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedTrailer(video)}
                    >
                      <div className="aspect-video relative bg-slate-800">
                        <img 
                          src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-12 h-12 text-white" />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-white text-sm font-medium truncate">{video.name}</p>
                        <p className="text-white/50 text-xs">Teaser</p>
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
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Users className="w-6 h-6 text-cyan-400" />
                    Cast
                  </h2>
                  {getCast().length > 8 && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowAllCast(!showAllCast)}
                      className="text-white/70 hover:text-white hover:bg-white/10"
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
                    <Card 
                      key={actor.id} 
                      className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:scale-105"
                    >
                      <div className="aspect-square relative overflow-hidden bg-slate-800">
                        {actor.profile_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                            <Users className="w-12 h-12 text-white/30" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm text-white truncate">{actor.name}</p>
                        <p className="text-xs text-white/50 truncate">{actor.character}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Crew Section */}
            {(getDirector() || getWriters().length > 0 || getProducers().length > 0 || getCinematographer() || getComposer()) && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-amber-400" />
                  Key Crew
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {getDirector() && (
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-amber-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                          <Film className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{getDirector()?.name}</p>
                          <p className="text-amber-400 text-sm">Director</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {getWriters().slice(0, 2).map((writer) => (
                    <Card key={writer.id} className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-violet-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{writer.name}</p>
                          <p className="text-violet-400 text-sm">{writer.job}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {getCinematographer() && (
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{getCinematographer()?.name}</p>
                          <p className="text-cyan-400 text-sm">Cinematography</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {getComposer() && (
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-pink-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                          <Award className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{getComposer()?.name}</p>
                          <p className="text-pink-400 text-sm">Original Music</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {getProducers().slice(0, 2).map((producer) => (
                    <Card key={producer.id} className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{producer.name}</p>
                          <p className="text-emerald-400 text-sm">{producer.job}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Backdrops Gallery */}
            {movie.backdrops && movie.backdrops.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-pink-400" />
                  Gallery
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {movie.backdrops.map((backdrop, idx) => (
                    <div 
                      key={idx}
                      className="aspect-video rounded-lg overflow-hidden bg-slate-800 hover:scale-105 transition-transform duration-300 cursor-pointer group"
                    >
                      <img 
                        src={`https://image.tmdb.org/t/p/w780${backdrop.file_path}`}
                        alt={`${movie.title} backdrop ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Similar Movies */}
            {movie.similar && movie.similar.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <ThumbsUp className="w-6 h-6 text-emerald-400" />
                  Similar Movies
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {movie.similar.map((similar) => (
                    <Link key={similar.id} href={`/movies/movie-${similar.id}`}>
                      <Card className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[2/3] relative overflow-hidden bg-slate-800">
                          {similar.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w300${similar.poster_path}`}
                              alt={similar.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                              <Film className="w-10 h-10 text-white/30" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-white text-xs font-semibold">{similar.vote_average.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-white truncate">{similar.title}</p>
                          <p className="text-xs text-white/50">{similar.release_date ? getYear(similar.release_date) : '—'}</p>
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
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-fuchsia-400" />
                  Recommendations
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {movie.recommendations.map((rec) => (
                    <Link key={rec.id} href={`/movies/movie-${rec.id}`}>
                      <Card className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-fuchsia-500/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[2/3] relative overflow-hidden bg-slate-800">
                          {rec.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`}
                              alt={rec.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20">
                              <Film className="w-10 h-10 text-white/30" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-white text-xs font-semibold">{rec.vote_average.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-white truncate">{rec.title}</p>
                          <p className="text-xs text-white/50">{rec.release_date ? getYear(rec.release_date) : '—'}</p>
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
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-violet-400" />
                External Links
              </h3>
              <div className="space-y-3">
                {movie.external_ids?.imdb_id && (
                  <a 
                    href={`https://www.imdb.com/title/${movie.external_ids.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-amber-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-white font-bold text-sm">
                      IMDb
                    </div>
                    <span className="text-white group-hover:text-amber-400 transition-colors">View on IMDb</span>
                    <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-amber-400" />
                  </a>
                )}
                {movie.external_ids?.facebook_id && (
                  <a 
                    href={`https://www.facebook.com/${movie.external_ids.facebook_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-blue-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white group-hover:text-blue-400 transition-colors">Facebook</span>
                    <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-blue-400" />
                  </a>
                )}
                {movie.external_ids?.instagram_id && (
                  <a 
                    href={`https://www.instagram.com/${movie.external_ids.instagram_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-pink-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white group-hover:text-pink-400 transition-colors">Instagram</span>
                    <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-pink-400" />
                  </a>
                )}
                {movie.external_ids?.twitter_id && (
                  <a 
                    href={`https://twitter.com/${movie.external_ids.twitter_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-sky-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white group-hover:text-sky-400 transition-colors">Twitter</span>
                    <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-sky-400" />
                  </a>
                )}
                {movie.homepage && (
                  <a 
                    href={movie.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-green-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white group-hover:text-green-400 transition-colors">Official Website</span>
                    <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-green-400" />
                  </a>
                )}
              </div>
            </section>

            {/* Details Card */}
            <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Details</h3>
              <div className="space-y-4">
                {movie.status && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Status</span>
                    <span className="text-white font-medium">{movie.status}</span>
                  </div>
                )}
                
                {movie.original_language && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Original Language</span>
                    <span className="text-white font-medium uppercase">{movie.original_language}</span>
                  </div>
                )}

                {movie.production_countries && movie.production_countries.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Production Countries</span>
                    <span className="text-white font-medium text-right">{movie.production_countries.map(c => c.name).join(', ')}</span>
                  </div>
                )}

                {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                  <div>
                    <span className="text-white/60 text-sm block mb-2">Spoken Languages</span>
                    <div className="flex flex-wrap gap-2">
                      {movie.spoken_languages.map((lang) => (
                        <Badge key={lang.iso_639_1} variant="outline" className="border-white/20 text-white/80">
                          {lang.english_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">Popularity</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{movie.popularity.toFixed(0)}</span>
                  </div>
                </div>

                {movie.budget > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Budget</span>
                    <span className="text-white font-medium">{formatCurrency(movie.budget)}</span>
                  </div>
                )}

                {movie.revenue > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Revenue</span>
                    <span className="text-white font-medium">{formatCurrency(movie.revenue)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Production Companies */}
            {movie.production_companies && movie.production_companies.length > 0 && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  Production Companies
                </h3>
                <div className="space-y-3">
                  {movie.production_companies.slice(0, 5).map((company) => (
                    <div key={company.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      {company.logo_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${company.logo_path}`}
                          alt={company.name}
                          className="h-8 w-auto object-contain invert brightness-0 dark:invert-0 dark:brightness-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <span className="text-white font-medium text-sm block">{company.name}</span>
                        <span className="text-white/50 text-xs">{company.origin_country}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}