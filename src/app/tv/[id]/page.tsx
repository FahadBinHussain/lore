'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Clock, Calendar, Globe, 
  Users, Loader2, Play, Plus, 
  Heart, Share2, Check, Tv, Monitor,
  ExternalLink, TrendingUp, Award, Building2,
  Languages, MapPin, Film, ChevronDown, ChevronUp,
  PlayCircle, Image as ImageIcon, Sparkles,
  MessageCircle, Camera, ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

interface Season {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string;
}

interface Network {
  id: number;
  name: string;
  logo_path: string | null;
}

interface Video {
  key: string;
  name: string;
  type: string;
  site: string;
}

interface SimilarShow {
  id: number;
  name: string;
  poster_path: string | null;
  vote_average: number;
  first_air_date: string;
}

interface ExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
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

interface TVShowDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  vote_average: number;
  vote_count: number;
  genres: Genre[];
  number_of_episodes: number;
  number_of_seasons: number;
  tagline: string;
  status: string;
  type: string;
  original_language: string;
  popularity: number;
  in_production: boolean;
  homepage: string;
  spoken_languages: SpokenLanguage[];
  origin_country: string[];
  production_companies: ProductionCompany[];
  networks: Network[];
  seasons: Season[];
  content_rating: string | null;
  external_ids: ExternalIds;
  videos: {
    trailers: Video[];
    teasers: Video[];
    clips: Video[];
  };
  similar: SimilarShow[];
  recommendations: SimilarShow[];
  backdrops: BackdropImage[];
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
}

export default function TVShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [show, setShow] = useState<TVShowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [showAllCast, setShowAllCast] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<Video | null>(null);
  const [anilistLink, setAnilistLink] = useState<string | null>(null);
  const [anilistLoading, setAnilistLoading] = useState(false);

  useEffect(() => {
    if (!updatingWatched) {
      setSyncProgress(0);
      return;
    }

    setSyncProgress(8);
    const startedAt = Date.now();
    const estimatedDurationMs = Math.max(4000, (show?.number_of_episodes || 1) * 120);

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / estimatedDurationMs, 0.92);
      setSyncProgress(Math.max(8, Math.round(ratio * 100)));
    }, 180);

    return () => clearInterval(timer);
  }, [updatingWatched, show?.number_of_episodes]);

  const fetchTVShowDetails = async () => {
    try {
      const idParam = params.id as string;
      
      if (idParam.startsWith('movie-')) {
        router.push(`/movies/${idParam}`);
        return;
      }
      
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch(`/api/tv/${numericId}`);
      if (!response.ok) {
        throw new Error('TV show not found');
      }
      const data = await response.json();
      setShow(data);
      
      // Don't auto-play trailers - user must click to play
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TV show');
    } finally {
      setLoading(false);
    }
  };

  const fetchWatchedStatus = async () => {
    try {
      const idParam = params.id as string;
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch(`/api/media/status?mediaId=${numericId}&mediaType=tv`);
      if (response.ok) {
        const data = await response.json();
        setIsWatched(data.isWatched);
      }
    } catch (err) {
      console.error('Failed to fetch watched status:', err);
    }
  };

  const handleMarkAsWatched = async () => {
    if (!show) return;
    
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
        body: JSON.stringify({
          mediaId: numericId,
          mediaType: 'tv',
          isWatched: !isWatched,
          title: show.name,
          posterPath: show.poster_path,
          releaseDate: show.first_air_date,
          totalEpisodes: show.number_of_episodes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update watched status');
      }
      
      setSyncProgress(100);
      setIsWatched(!isWatched);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      console.error('Failed to update watched status:', err);
    } finally {
      setUpdatingWatched(false);
    }
  };

  // Search AniList for matching anime to redirect to site anime page
  const searchAniList = async () => {
    if (!show) return;
    
    setAnilistLoading(true);
    try {
      const searchQuery = show.name.split('(')[0].trim(); // Remove parenthetical info
      const response = await fetch(`/api/search/anilist?q=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          // Use the first result as the best match - use site URL for redirect
          setAnilistLink(data.results[0].siteUrl);
        }
      }
    } catch (err) {
      console.error('Failed to search AniList:', err);
    } finally {
      setAnilistLoading(false);
    }
  };

  useEffect(() => {
    fetchTVShowDetails();
  }, [params.id]);

  useEffect(() => {
    if (show) {
      fetchWatchedStatus();
      
      // Search AniList if this is Japanese animation
      if (isJapaneseAnimation) {
        searchAniList();
      }
    }
  }, [show]);

  const getCreator = () => {
    return show?.credits?.crew.find(person => person.job === 'Creator');
  };

  const getDirectors = () => {
    return show?.credits?.crew.filter(person => person.job === 'Director') || [];
  };

  const getWriters = () => {
    return show?.credits?.crew.filter(person => ['Writer', 'Screenplay'].includes(person.job)) || [];
  };

  const getProducers = () => {
    return show?.credits?.crew.filter(person => 
      ['Executive Producer', 'Producer'].includes(person.job)
    ) || [];
  };

  const getCast = () => {
    return show?.credits?.cast || [];
  };

  const getDisplayCast = () => {
    const cast = getCast();
    return showAllCast ? cast : cast.slice(0, 8);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getYear = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).getFullYear();
  };

  // Check if this is Japanese animation - should redirect to anime tab
  const isJapaneseAnimation = show?.genres?.some(g => g.name === 'Animation') && 
    show?.origin_country?.some(c => c === 'JP');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-xl opacity-50 animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin text-foreground relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-xl opacity-50" />
          <Tv className="w-20 h-20 text-primary relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">{error || 'TV show not found'}</h1>
        <Link href="/tv">
          <Button variant="outline" className="border-border text-foreground hover:bg-accent">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </Link>
      </div>
    );
  }

  // Show overlay for Japanese animation - redirect to anime tab
  if (isJapaneseAnimation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex flex-col items-center justify-center gap-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-md">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-6">
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">Japanese Animation</h1>
          <p className="text-muted-foreground mb-6">
            This title is categorized as Japanese animation. Please use the Anime section for the full experience.
          </p>
          <div className="flex flex-col gap-4">
            {anilistLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finding anime...</span>
              </div>
            ) : anilistLink ? (
              <Button 
                onClick={() => router.push(anilistLink)}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-primary-foreground"
              >
                <Tv className="w-4 h-4 mr-2" />
                View on Anime Page
              </Button>
            ) : (
              <Link href="/anime">
                <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-primary-foreground">
                  <Tv className="w-4 h-4 mr-2" />
                  Go to Anime
                </Button>
              </Link>
            )}
            <Link href="/tv">
              <Button variant="outline" className="border-border text-foreground hover:bg-accent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </Link>
          </div>
        </div>
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
      <div className="relative h-[70vh] min-h-[600px] overflow-hidden">
        {show.backdrop_path ? (
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-transparent to-background/45" />
        
        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-fuchsia-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-20">
          <Button 
            variant="ghost" 
            className="bg-background/65 backdrop-blur-xl border border-border hover:bg-background/80 text-foreground transition-all duration-300"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Show Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {show.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
                    alt={show.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                    <Tv className="w-16 h-16 text-primary-foreground/80" />
                  </div>
                )}
              </div>
              {show.content_rating && (
                <div className="absolute -top-3 -right-3 bg-amber-500 text-foreground font-bold px-3 py-1 rounded-lg shadow-lg text-sm">
                  {show.content_rating}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title and Tagline */}
              <div className="mb-4">
                <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-2 tracking-tight">
                  {show.name}
                </h1>
                {show.original_name && show.original_name !== show.name && (
                  <p className="text-lg text-muted-foreground/80 mb-2">
                    Original: {show.original_name}
                  </p>
                )}
                {show.tagline && (
                  <p className="text-xl text-muted-foreground italic font-light">
                    "{show.tagline}"
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {show.first_air_date && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span className="text-foreground font-medium">
                      {getYear(show.first_air_date)}
                      {show.last_air_date && show.status === 'Ended' && ` - ${getYear(show.last_air_date)}`}
                    </span>
                  </div>
                )}
                
                {show.number_of_seasons > 0 && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                    <Monitor className="w-4 h-4 text-primary" />
                    <span className="text-foreground font-medium">
                      {show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {show.number_of_episodes > 0 && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                    <Clock className="w-4 h-4 text-secondary" />
                    <span className="text-foreground font-medium">{show.number_of_episodes} Episodes</span>
                  </div>
                )}

                {/* Rating */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                  <Star className="w-5 h-5 fill-amber-400 text-primary" />
                  <span className="font-bold text-primary">{show.vote_average.toFixed(1)}</span>
                  <span className="text-muted-foreground/80 text-sm">({show.vote_count.toLocaleString()})</span>
                </div>

                {/* Status Badge */}
                <Badge className={cn(
                  "font-semibold",
                  show.status === 'Returning Series' ? 'bg-emerald-500/20 text-primary border-emerald-500/30' :
                  show.status === 'Ended' ? 'bg-slate-500/20 text-muted-foreground border-slate-500/30' :
                  show.status === 'Canceled' ? 'bg-red-500/20 text-destructive border-red-500/30' :
                  'bg-blue-500/20 text-secondary border-blue-500/30'
                )}>
                  {show.status}
                </Badge>
              </div>

              {/* Genres */}
              {show.genres && show.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {show.genres.map((genre) => (
                    <span 
                      key={genre.id} 
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-primary font-medium text-sm hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-all duration-300 cursor-pointer"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {selectedTrailer || show.videos?.trailers?.length > 0 ? (
                  <Button 
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-primary-foreground shadow-lg shadow-violet-500/25 transition-all duration-300"
                    onClick={() => {
                      if (show.videos?.trailers?.length > 0) {
                        setSelectedTrailer(show.videos.trailers[0]);
                      }
                    }}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Watch Trailer
                  </Button>
                ) : (
                  <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-primary-foreground shadow-lg shadow-violet-500/25 transition-all duration-300">
                    <Play className="w-5 h-5 mr-2" />
                    Watch Now
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsWatched}
                  disabled={updatingWatched}
                  className={cn(
                    "border-border text-foreground hover:bg-accent transition-all duration-300",
                    isWatched && "bg-emerald-500/20 border-emerald-500/50 text-primary"
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
                    "border-border text-foreground hover:bg-accent transition-all duration-300",
                    isFavorite && "bg-red-500/20 border-red-500/50 text-destructive"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isFavorite && "fill-red-400")} />
                </Button>
                
                <Button variant="outline" size="icon" className="border-border text-foreground hover:bg-accent">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {updatingWatched && (
                <div className="mt-4 w-full max-w-md rounded-xl border border-border/70 bg-background/70 p-3 backdrop-blur-sm">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {isWatched
                        ? 'Removing watched flag from episodes...'
                        : `Marking ${show.number_of_episodes || 0} episodes as watched...`}
                    </span>
                    <span>{syncProgress}%</span>
                  </div>
                  <Progress value={syncProgress} className="h-2 bg-muted" />
                </div>
              )}
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
              <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border/80 p-8">
                <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  Overview
                </h2>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {show.overview || 'No overview available.'}
                </p>
              </div>
            </section>

            {/* Videos Section */}
            {(show.videos?.trailers?.length > 0 || show.videos?.teasers?.length > 0 || show.videos?.clips?.length > 0) && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6 text-secondary" />
                  Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {show.videos.trailers.map((video, idx) => (
                    <Card 
                      key={`trailer-${idx}`}
                      className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-violet-500/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedTrailer(video)}
                    >
                      <div className="aspect-video relative bg-muted">
                        <img 
                          src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                          alt={video.name}
                          className="w-full h-full object-cover"
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
                  {show.videos.teasers.slice(0, 3).map((video, idx) => (
                    <Card 
                      key={`teaser-${idx}`}
                      className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-fuchsia-500/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedTrailer(video)}
                    >
                      <div className="aspect-video relative bg-muted">
                        <img 
                          src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                          alt={video.name}
                          className="w-full h-full object-cover"
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
                    <Card 
                      key={actor.id} 
                      className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:scale-105"
                    >
                      <div className="aspect-square relative overflow-hidden bg-muted">
                        {actor.profile_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                            <Users className="w-12 h-12 text-muted-foreground/70" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm text-foreground truncate">{actor.name}</p>
                        <p className="text-xs text-muted-foreground/80 truncate">{actor.character}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Crew Section */}
            {(getCreator() || getDirectors().length > 0 || getWriters().length > 0 || getProducers().length > 0) && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-primary" />
                  Key Crew
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {getCreator() && (
                    <Card className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-amber-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-foreground font-semibold">{getCreator()?.name}</p>
                          <p className="text-primary text-sm">Creator</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {getDirectors().slice(0, 3).map((director) => (
                    <Card key={director.id} className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-violet-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <Film className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-foreground font-semibold">{director.name}</p>
                          <p className="text-primary text-sm">{director.job}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {getWriters().slice(0, 3).map((writer) => (
                    <Card key={writer.id} className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-cyan-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-foreground font-semibold">{writer.name}</p>
                          <p className="text-accent text-sm">{writer.job}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {getProducers().slice(0, 2).map((producer) => (
                    <Card key={producer.id} className="bg-card/80 backdrop-blur-xl border border-border/80 hover:border-emerald-500/30 transition-all duration-300">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-foreground font-semibold">{producer.name}</p>
                          <p className="text-primary text-sm">{producer.job}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Seasons Section */}
            {show.seasons && show.seasons.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Monitor className="w-6 h-6 text-primary" />
                  Seasons
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {show.seasons.map((season) => (
                    <Link key={season.id} href={`/tv/${params.id}/season/${season.season_number}`}>
                      <Card
                        className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-violet-500/50 transition-all duration-300 hover:transform hover:scale-105 cursor-pointer"
                      >
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {season.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w300${season.poster_path}`}
                              alt={season.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                              <Monitor className="w-12 h-12 text-muted-foreground/70" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-foreground">{season.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {season.episode_count} Episode{season.episode_count !== 1 ? 's' : ''}
                          </p>
                          {season.air_date && (
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {getYear(season.air_date)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Backdrops Gallery */}
            {show.backdrops && show.backdrops.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-secondary" />
                  Gallery
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {show.backdrops.map((backdrop, idx) => (
                    <div 
                      key={idx}
                      className="aspect-video rounded-lg overflow-hidden bg-muted hover:scale-105 transition-transform duration-300 cursor-pointer group"
                    >
                      <img 
                        src={`https://image.tmdb.org/t/p/w780${backdrop.file_path}`}
                        alt={`${show.name} backdrop ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Similar Shows */}
            {show.similar && show.similar.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <ThumbsUp className="w-6 h-6 text-primary" />
                  Similar Shows
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {show.similar.map((similar) => (
                    <Link key={similar.id} href={`/tv/tv-${similar.id}`}>
                      <Card className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-emerald-500/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {similar.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w300${similar.poster_path}`}
                              alt={similar.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                              <Tv className="w-10 h-10 text-muted-foreground/70" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-primary" />
                            <span className="text-foreground text-xs font-semibold">{similar.vote_average.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-foreground truncate">{similar.name}</p>
                          <p className="text-xs text-muted-foreground/80">{similar.first_air_date ? getYear(similar.first_air_date) : '—'}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {show.recommendations && show.recommendations.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-secondary" />
                  Recommendations
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {show.recommendations.map((rec) => (
                    <Link key={rec.id} href={`/tv/tv-${rec.id}`}>
                      <Card className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-fuchsia-500/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {rec.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`}
                              alt={rec.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20">
                              <Tv className="w-10 h-10 text-muted-foreground/70" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-primary" />
                            <span className="text-foreground text-xs font-semibold">{rec.vote_average.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-foreground truncate">{rec.name}</p>
                          <p className="text-xs text-muted-foreground/80">{rec.first_air_date ? getYear(rec.first_air_date) : '—'}</p>
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
                {show.external_ids?.imdb_id && (
                  <a 
                    href={`https://www.imdb.com/title/${show.external_ids.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-amber-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-foreground font-bold text-sm">
                      IMDb
                    </div>
                    <span className="text-foreground group-hover:text-primary transition-colors">View on IMDb</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-primary" />
                  </a>
                )}
                {show.external_ids?.facebook_id && (
                  <a 
                    href={`https://www.facebook.com/${show.external_ids.facebook_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-blue-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-foreground group-hover:text-secondary transition-colors">Facebook</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-secondary" />
                  </a>
                )}
                {show.external_ids?.instagram_id && (
                  <a 
                    href={`https://www.instagram.com/${show.external_ids.instagram_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-pink-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-foreground group-hover:text-secondary transition-colors">Instagram</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-secondary" />
                  </a>
                )}
                {show.external_ids?.twitter_id && (
                  <a 
                    href={`https://twitter.com/${show.external_ids.twitter_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-sky-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-foreground group-hover:text-secondary transition-colors">Twitter</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground/80 ml-auto group-hover:text-secondary" />
                  </a>
                )}
                {show.homepage && (
                  <a 
                    href={show.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/80 hover:border-green-500/50 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-primary-foreground" />
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
                {show.type && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Type</span>
                    <span className="text-foreground font-medium">{show.type}</span>
                  </div>
                )}
                
                {show.original_language && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Original Language</span>
                    <span className="text-foreground font-medium uppercase">{show.original_language}</span>
                  </div>
                )}

                {show.origin_country && show.origin_country.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Origin Country</span>
                    <span className="text-foreground font-medium">{show.origin_country.join(', ')}</span>
                  </div>
                )}

                {show.spoken_languages && show.spoken_languages.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-sm block mb-2">Spoken Languages</span>
                    <div className="flex flex-wrap gap-2">
                      {show.spoken_languages.map((lang) => (
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
                    <span className="text-foreground font-medium">{show.popularity.toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">In Production</span>
                  <Badge className={show.in_production ? 'bg-emerald-500/20 text-primary' : 'bg-slate-500/20 text-muted-foreground'}>
                    {show.in_production ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </section>

            {/* Networks */}
            {show.networks && show.networks.length > 0 && (
              <section className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/80 p-6">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-secondary" />
                  Networks
                </h3>
                <div className="space-y-3">
                  {show.networks.map((network) => (
                    <div key={network.id} className="flex items-center gap-3 p-3 bg-muted/70 rounded-xl border border-border">
                      {network.logo_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${network.logo_path}`}
                          alt={network.name}
                          className="h-8 w-auto object-contain invert brightness-0 dark:invert-0 dark:brightness-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center">
                          <Tv className="w-5 h-5 text-primary-foreground" />
                        </div>
                      )}
                      <span className="text-foreground font-medium text-sm">{network.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Production Companies */}
            {show.production_companies && show.production_companies.length > 0 && (
              <section className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/80 p-6">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-accent" />
                  Production Companies
                </h3>
                <div className="space-y-3">
                  {show.production_companies.slice(0, 5).map((company) => (
                    <div key={company.id} className="flex items-center gap-3 p-3 bg-muted/70 rounded-xl border border-border">
                      {company.logo_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${company.logo_path}`}
                          alt={company.name}
                          className="h-8 w-auto object-contain invert brightness-0 dark:invert-0 dark:brightness-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary-foreground" />
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
      </div>
    </div>
  );
}




