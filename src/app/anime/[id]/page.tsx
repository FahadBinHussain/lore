'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Star, Clock, Calendar,
  Loader2, Play, Plus, Check,
  Zap, PlayCircle, Monitor, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AnimeCharacter {
  id: number;
  name: string;
  role: string;
  image: string | null;
}

interface RelatedAnime {
  id: number;
  title: string;
  type: string;
  format: string;
  status: string;
  relationType: string;
  coverImage: string | null;
}

interface AnimeDetails {
  id: number;
  title: string;
  image: string | null;
  year: string;
  rating: number | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  format: string;
  formatBadge: string;
  status: string;
  statusBadge: string;
  genres: string[];
  studios: string[];
  banner: string | null;
  trailer: {
    id: string;
    site: string;
    thumbnail: string | null;
  } | null;
  season: string | null;
  seasonYear: number | null;
  popularity: number | null;
  favourites: number | null;
  nextEpisode: {
    airingAt: number;
    episode: number;
    timeUntilAiring: number;
  } | null;
  characters: AnimeCharacter[];
  relations: RelatedAnime[];
  recommendations: {
    id: number;
    title: string;
    coverImage: string | null;
  }[];
}

export default function AnimeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [updatingWatched, setUpdatingWatched] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<{ id: string; site: string } | null>(null);

  useEffect(() => {
    fetchAnimeDetails();
  }, [params.id]);

  useEffect(() => {
    if (anime) {
      fetchWatchedStatus();
    }
  }, [anime]);

  // Debug: Log trailer data whenever anime changes
  useEffect(() => {
    if (anime) {
      console.log('=== ANIME TRAILER DEBUG ===');
      console.log('anime.trailer:', anime.trailer);
      console.log('anime.trailer?.site:', anime.trailer?.site);
      console.log('Condition result (trailer?.site === "youtube"):', anime.trailer?.site === 'youtube');
      console.log('=========================');
    }
  }, [anime]);

  const fetchAnimeDetails = async () => {
    try {
      const response = await fetch(`/api/anime/${params.id}`);
      if (!response.ok) {
        throw new Error('Anime not found');
      }
      const data = await response.json();
      setAnime(data);
      
      console.log('Anime detail data received:', {
        title: data.name || data.title,
        hasTrailer: !!data.trailer,
        trailerData: data.trailer,
        trailerSite: data.trailer?.site,
      });
      
      // Don't auto-play trailers - user must click to play
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load anime');
    } finally {
      setLoading(false);
    }
  };

  const fetchWatchedStatus = async () => {
    try {
      const response = await fetch(`/api/media/status?mediaId=${params.id}&mediaType=anime`);
      // If not authenticated, silently skip (user can still browse)
      if (response.status === 401) {
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setIsWatched(data.isWatched);
      }
    } catch (err) {
      // Silently fail - user can still browse without tracking
      console.log('Not logged in, skipping watched status');
    }
  };

  const handleMarkAsWatched = async () => {
    if (!anime) return;
    
    setUpdatingWatched(true);
    try {
      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache',
        body: JSON.stringify({
          mediaId: params.id as string,
          mediaType: 'anime',
          isWatched: !isWatched,
          title: anime.title,
          posterPath: anime.image,
          releaseDate: anime.seasonYear ? `${anime.seasonYear}-01-01` : null,
          totalEpisodes: anime.episodes,
        }),
      });
      
      // If not authenticated, redirect to sign in
      if (response.status === 401) {
        window.location.href = '/auth/signin';
        setUpdatingWatched(false);
        return;
      }
      
      if (response.ok) {
        setIsWatched(!isWatched);
      }
    } catch (err) {
      console.error('Failed to update watched status:', err);
    } finally {
      setUpdatingWatched(false);
    }
  };

  const getYouTubeId = (trailer: { id: string; site: string } | null) => {
    if (!trailer || trailer.site !== 'youtube') return null;
    return trailer.id;
  };

  const formatNextEpisode = (nextEpisode: { airingAt: number; episode: number; timeUntilAiring: number } | null) => {
    if (!nextEpisode) return null;
    const days = Math.floor(nextEpisode.timeUntilAiring / 86400);
    const hours = Math.floor((nextEpisode.timeUntilAiring % 86400) / 3600);
    if (days > 0) return `Episode ${nextEpisode.episode} in ${days}d ${hours}h`;
    return `Episode ${nextEpisode.episode} in ${hours}h`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-xl opacity-50 animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin text-primary relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-xl opacity-50" />
          <Zap className="w-20 h-20 text-primary relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">{error || 'Anime not found'}</h1>
        <Button onClick={() => router.push('/anime')} variant="outline" className="border-border text-foreground hover:bg-accent">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Anime
        </Button>
      </div>
    );
  }

  const youtubeId = getYouTubeId(selectedTrailer);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Video Modal */}
      {youtubeId && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedTrailer(null)}
        >
          <div className="relative w-full max-w-5xl aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; encrypted-media"
              allowFullScreen
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-foreground bg-background/60 border border-border hover:bg-background/80"
              onClick={() => setSelectedTrailer(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Backdrop */}
      <div className="relative h-[70vh] min-h-[600px] overflow-hidden">
        {anime.banner || anime.image ? (
          <div 
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ 
              backgroundImage: `url(${anime.banner || anime.image})` 
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
              {/* Title and Tagline */}
              <div className="mb-4">
                <Badge variant="outline" className="mb-2 bg-primary/15 text-primary border-primary/30">
                  <Zap className="w-3 h-3 mr-1" />
                  Anime
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-2 tracking-tight">
                  {anime.title}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-secondary/15 text-secondary border-secondary/30">
                    {anime.formatBadge}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    "border",
                    anime.statusBadge === 'Airing' ? 'bg-primary/15 text-primary border-primary/30' :
                    anime.statusBadge === 'Finished' ? 'bg-muted text-muted-foreground border-border' :
                    'bg-secondary/15 text-secondary border-secondary/30'
                  )}>
                    {anime.statusBadge}
                  </Badge>
                </div>
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {anime.seasonYear && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-foreground font-medium">{anime.seasonYear}</span>
                  </div>
                )}
                
                {anime.episodes && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                    <Play className="w-4 h-4 text-secondary" />
                    <span className="text-foreground font-medium">{anime.episodes} Episodes</span>
                  </div>
                )}
                
                {anime.duration && (
                  <div className="flex items-center gap-2 bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                    <Clock className="w-4 h-4 text-accent" />
                    <span className="text-foreground font-medium">{anime.duration} min</span>
                  </div>
                )}

                {/* Rating - API returns 0-100, divide by 10 for display */}
                {anime.rating && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                    <Star className="w-5 h-5 fill-amber-400 text-primary" />
                    <span className="font-bold text-primary">{anime.rating / 10}</span>
                  </div>
                )}

                {/* Next Episode */}
                {anime.nextEpisode && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-primary/20 to-secondary/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary/30">
                    <Monitor className="w-4 h-4 text-primary" />
                    <span className="text-foreground font-medium text-sm">
                      {formatNextEpisode(anime.nextEpisode)}
                    </span>
                  </div>
                )}
              </div>

              {/* Studios */}
              {anime.studios.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-muted-foreground text-sm">Studio:</span>
                  {anime.studios.map((studio, i) => (
                    <span key={i} className="text-foreground font-medium">{studio}</span>
                  ))}
                </div>
              )}

              {/* Genres */}
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {anime.genres.map((genre) => (
                    <span 
                      key={genre} 
                      className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium text-sm hover:bg-primary/20 transition-all duration-300 cursor-pointer"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {anime.trailer?.site === 'youtube' && (
                  <Button 
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300"
                    onClick={() => setSelectedTrailer(anime.trailer)}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Watch Trailer
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={handleMarkAsWatched}
                  disabled={updatingWatched}
                  className={cn(
                    "border-2 transition-all duration-300",
                    isWatched 
                      ? "bg-primary/20 border-primary/50 text-primary hover:bg-primary/30" 
                      : "bg-background/70 border-border text-foreground hover:bg-accent"
                  )}
                >
                  {isWatched ? (
                    <>
                      <Check className="w-5 h-5 mr-2 fill-current" />
                      Watched
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Mark as Watched
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Description */}
        {anime.description && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Synopsis</h2>
            {/* Description from AniList may contain HTML like <br>, <i> */}
            <p 
              className="text-lg text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: anime.description }}
            />
          </div>
        )}

        {/* Characters */}
        {anime.characters && anime.characters.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Characters & Voice Actors</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {anime.characters.map((char) => (
                <Card key={char.id} className="overflow-hidden bg-card/80 border-border/70">
                  {char.image ? (
                    <img 
                      src={char.image}
                      alt={char.name}
                      className="w-full aspect-[3/4] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                      <Users className="w-8 h-8 text-muted-foreground/70" />
                    </div>
                  )}
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm truncate">{char.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{char.role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Episodes/Seasons */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Play className="w-5 h-5 text-primary-foreground" />
            </div>
            Episodes & Seasons
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Season Episodes */}
            {anime.episodes && anime.episodes > 1 && (
              <Card className="bg-card/80 backdrop-blur-xl border border-border/80">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Current Season</h3>
                  <p className="text-muted-foreground mb-4">
                    {anime.title} has {anime.episodes} episodes in this season.
                  </p>
                  <Link href={`/anime/${anime.id}/season/1`}>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                      <Play className="w-4 h-4 mr-2" />
                      View Episodes
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Related Seasons */}
            {anime.relations && anime.relations.filter(rel => rel.relationType === 'SEQUEL' || rel.relationType === 'PREQUEL').length > 0 && (
              <Card className="bg-card/80 backdrop-blur-xl border border-border/80">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Other Seasons</h3>
                  <p className="text-muted-foreground mb-4">
                    This anime has related seasons available.
                  </p>
                  <div className="space-y-2">
                    {anime.relations
                      .filter(rel => rel.relationType === 'SEQUEL' || rel.relationType === 'PREQUEL')
                      .slice(0, 3)
                      .map((rel) => (
                        <Link key={rel.id} href={`/anime/${rel.id}`}>
                          <Button variant="outline" className="w-full justify-start border-border text-foreground hover:bg-accent">
                            <Monitor className="w-4 h-4 mr-2" />
                            {rel.title} ({rel.relationType.toLowerCase()})
                          </Button>
                        </Link>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Related Anime */}
        {anime.relations && anime.relations.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Related Anime</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {anime.relations.slice(0, 10).map((rel) => (
                <Link key={rel.id} href={`/anime/${rel.id}`}>
                  <Card className="overflow-hidden bg-card/80 border-border/70 hover:border-primary/50 transition-all">
                    {rel.coverImage ? (
                      <img 
                        src={rel.coverImage}
                        alt={rel.title}
                        className="w-full aspect-[2/3] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-muted-foreground/70" />
                      </div>
                    )}
                    <CardContent className="p-3">
                      <p className="text-xs text-primary mb-1">{rel.relationType.replace(/_/g, ' ')}</p>
                      <h3 className="font-semibold text-sm truncate">{rel.title}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {anime.recommendations && anime.recommendations.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">You Might Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {anime.recommendations.slice(0, 10).map((rec) => (
                <Link key={rec.id} href={`/anime/${rec.id}`}>
                  <Card className="overflow-hidden bg-card/80 border-border/70 hover:border-primary/50 transition-all">
                    {rec.coverImage ? (
                      <img 
                        src={rec.coverImage}
                        alt={rec.title}
                        className="w-full aspect-[2/3] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-muted-foreground/70" />
                      </div>
                    )}
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm truncate">{rec.title}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Data provided by AniList. &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

