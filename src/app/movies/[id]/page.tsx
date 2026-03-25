'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Clock, Calendar, Globe, 
  DollarSign, Users, Loader2, Play, Plus, 
  Heart, Share2, Check, Film
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
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchMovieDetails();
  }, [params.id]);

  const fetchMovieDetails = async () => {
    try {
      // Extract numeric ID from prefixed format (e.g., "movie-764079" or "tv-764079" -> "764079")
      const idParam = params.id as string;
      
      // Redirect to correct route if wrong media type
      if (idParam.startsWith('tv-')) {
        router.push(`/tv/${idParam}`);
        return;
      }
      
      // Use regex to extract the numeric ID from the end of the string
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch(`/api/movies/${numericId}`);
      if (!response.ok) {
        throw new Error('Movie not found');
      }
      const data = await response.json();
      setMovie(data);

      // Check if user has already marked this movie as watched
      await checkWatchStatus(data.id.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movie');
    } finally {
      setLoading(false);
    }
  };

  const checkWatchStatus = async (externalId: string) => {
    try {
      const response = await fetch(`/api/media/status?externalId=${externalId}&mediaType=movie`);
      if (response.ok) {
        const data = await response.json();
        setIsWatched(data.status === 'completed');
      }
    } catch (error) {
      console.error('Failed to check watch status:', error);
    }
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

  const getDirector = () => {
    return movie?.credits?.crew.find(person => person.job === 'Director');
  };

  const getTopCast = () => {
    return movie?.credits?.cast.slice(0, 8) || [];
  };

  const handleMarkAsWatched = async () => {
    if (!movie) return;

    setIsLoading(true);
    try {
      // First, ensure the media item exists in our database
      const mediaResponse = await fetch('/api/media/ensure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalId: movie.id.toString(),
          mediaType: 'movie',
          title: movie.title,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          releaseDate: movie.release_date,
          rating: movie.vote_average,
          description: movie.overview,
          genres: movie.genres?.map(g => g.name) || [],
          runtime: movie.runtime,
        }),
      });

      if (!mediaResponse.ok) {
        throw new Error('Failed to ensure media item exists');
      }

      const mediaData = await mediaResponse.json();
      const mediaItemId = mediaData.id;

      // Now update the user's progress
      const progressResponse = await fetch('/api/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaItemId,
          status: isWatched ? 'not_started' : 'completed',
        }),
      });

      if (!progressResponse.ok) {
        throw new Error('Failed to update watch status');
      }

      setIsWatched(!isWatched);
    } catch (error) {
      console.error('Failed to mark as watched:', error);
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center gap-4">
        <Film className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{error || 'Movie not found'}</h1>
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section with Backdrop */}
      <div className="relative h-[60vh] min-h-[500px]">
        {movie.backdrop_path ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})` 
            }}
            suppressHydrationWarning
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        
        {/* Back Button */}
        <div className="absolute top-6 left-6 z-10">
          <Link href="/">
            <Button variant="ghost" className="bg-background/50 backdrop-blur-sm hover:bg-background/80">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Movie Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="w-full flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0">
              <div className="w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border-4 border-background/50">
                {movie.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Film className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-lg text-muted-foreground italic mb-4">
                  {movie.tagline}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {movie.release_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(movie.release_date).getFullYear()}</span>
                  </div>
                )}
                {movie.runtime > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{formatRuntime(movie.runtime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{movie.vote_average.toFixed(1)}</span>
                  <span className="text-muted-foreground">({movie.vote_count.toLocaleString()} votes)</span>
                </div>
              </div>

              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {movie.genres.map((genre) => (
                    <Badge key={genre.id} variant="secondary" className="bg-primary/10 text-primary">
                      {genre.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button className="bg-gradient-to-r from-primary to-primary/90">
                  <Play className="w-4 h-4 mr-2" />
                  Watch Now
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsWatched}
                  disabled={isLoading}
                  className={cn(isWatched && "bg-green-500/10 border-green-500 text-green-500")}
                >
                  <Check className={cn("w-4 h-4 mr-2", isWatched && "fill-green-500")} />
                  {isWatched ? 'Watched' : 'Mark as Watched'}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(isFavorite && "bg-red-500/10 border-red-500 text-red-500")}
                >
                  <Heart className={cn("w-4 h-4", isFavorite && "fill-red-500")} />
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="w-full px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Overview */}
            <section>
              <h2 className="text-2xl font-bold mb-4">Overview</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {movie.overview || 'No overview available.'}
              </p>
            </section>

            {/* Cast */}
            {getTopCast().length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Top Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {getTopCast().map((actor) => (
                    <Card key={actor.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square relative overflow-hidden bg-muted">
                        {actor.profile_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Users className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm truncate">{actor.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{actor.character}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Director */}
            {getDirector() && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-muted-foreground mb-2">Director</h3>
                  <p className="text-lg font-bold">{getDirector()?.name}</p>
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Details</h3>
                
                {movie.status && (
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{movie.status}</p>
                  </div>
                )}

                {movie.original_language && (
                  <div>
                    <p className="text-sm text-muted-foreground">Original Language</p>
                    <p className="font-medium uppercase">{movie.original_language}</p>
                  </div>
                )}

                {movie.budget > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="font-medium">{formatCurrency(movie.budget)}</p>
                  </div>
                )}

                {movie.revenue > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="font-medium">{formatCurrency(movie.revenue)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Production Companies */}
            {/* ... */}
          </div>
        </div>
      </div>
    </div>
  );
}