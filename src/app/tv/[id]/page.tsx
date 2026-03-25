'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Clock, Calendar, Globe, 
  Users, Loader2, Play, Plus, 
  Heart, Share2, Bookmark, Tv, Monitor
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
  networks: Network[];
  seasons: Season[];
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
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    fetchTVShowDetails();
  }, [params.id]);

  const fetchTVShowDetails = async () => {
    try {
      // Extract numeric ID from prefixed format (e.g., "tv-764079" or "movie-764079" -> "764079")
      const idParam = params.id as string;
      
      // Redirect to correct route if wrong media type
      if (idParam.startsWith('movie-')) {
        router.push(`/movies/${idParam}`);
        return;
      }
      
      // Use regex to extract the numeric ID from the end of the string
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch(`/api/tv/${numericId}`);
      if (!response.ok) {
        throw new Error('TV show not found');
      }
      const data = await response.json();
      setShow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TV show');
    } finally {
      setLoading(false);
    }
  };

  const getCreator = () => {
    return show?.credits?.crew.find(person => person.job === 'Creator');
  };

  const getTopCast = () => {
    return show?.credits?.cast.slice(0, 8) || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center gap-4">
        <Tv className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{error || 'TV show not found'}</h1>
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
      <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
        {show.backdrop_path ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(https://image.tmdb.org/t/p/original${show.backdrop_path})` 
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

        {/* Show Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="w-full flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0">
              <div className="w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border-4 border-background/50">
                {show.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
                    alt={show.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Tv className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                {show.name}
              </h1>
              {show.tagline && (
                <p className="text-lg text-muted-foreground italic mb-4">
                  {show.tagline}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {show.first_air_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(show.first_air_date).getFullYear()}</span>
                    {show.last_air_date && show.status === 'Ended' && (
                      <span>- {new Date(show.last_air_date).getFullYear()}</span>
                    )}
                  </div>
                )}
                {show.number_of_seasons > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Monitor className="w-4 h-4" />
                    <span>{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {show.number_of_episodes > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{show.number_of_episodes} Episodes</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{show.vote_average.toFixed(1)}</span>
                  <span className="text-muted-foreground">({show.vote_count.toLocaleString()} votes)</span>
                </div>
              </div>

              {/* Genres */}
              {show.genres && show.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {show.genres.map((genre) => (
                    <Badge key={genre.id} variant="secondary" className="bg-primary/10 text-primary">
                      {genre.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Status */}
              {show.status && (
                <div className="mb-6">
                  <Badge variant={show.status === 'Returning Series' ? 'default' : 'secondary'}>
                    {show.status}
                  </Badge>
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
                  onClick={() => setIsInWatchlist(!isInWatchlist)}
                  className={cn(isInWatchlist && "bg-primary/10 border-primary")}
                >
                  <Bookmark className={cn("w-4 h-4 mr-2", isInWatchlist && "fill-primary")} />
                  {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
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
                {show.overview || 'No overview available.'}
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

            {/* Seasons */}
            {show.seasons && show.seasons.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Seasons</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {show.seasons.map((season) => (
                    <Card key={season.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                        {season.poster_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w300${season.poster_path}`}
                            alt={season.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Monitor className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold">{season.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {season.episode_count} Episode{season.episode_count !== 1 ? 's' : ''}
                        </p>
                        {season.air_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(season.air_date).getFullYear()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Creator */}
            {getCreator() && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-muted-foreground mb-2">Creator</h3>
                  <p className="text-lg font-bold">{getCreator()?.name}</p>
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Details</h3>
                
                {show.status && (
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{show.status}</p>
                  </div>
                )}

                {show.type && (
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{show.type}</p>
                  </div>
                )}

                {show.original_language && (
                  <div>
                    <p className="text-sm text-muted-foreground">Original Language</p>
                    <p className="font-medium uppercase">{show.original_language}</p>
                  </div>
                )}

                {show.networks && show.networks.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Networks</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {show.networks.map((network) => (
                        <Badge key={network.id} variant="outline">
                          {network.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}