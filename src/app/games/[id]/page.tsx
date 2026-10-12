'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Calendar, Globe, 
  Users, Loader2,
  Heart, Share2, Check, Gamepad2, Monitor,
  ExternalLink, TrendingUp, Award, Building2,
  ChevronDown, ChevronUp,
  PlayCircle, Image as ImageIcon, Sparkles,
  ThumbsUp, Zap, 
  Video, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FacebookBrandIcon,
  InstagramBrandIcon,
  RedditBrandIcon,
  TwitchBrandIcon,
  TwitterBrandIcon,
  YouTubeBrandIcon,
} from '@/components/icons/social-icons';
import { cn } from '@/lib/utils';
import { CommentsSection } from '@/components/media/comments-section';
import { GalleryLightbox } from '@/components/media/gallery-lightbox';

interface Platform {
  id: number;
  name: string;
  logo_url: string | null;
}

interface Developer {
  id: number;
  name: string;
  logo_url: string | null;
}

interface Publisher {
  id: number;
  name: string;
  logo_url: string | null;
}

interface Screenshot {
  url: string;
}

interface Artwork {
  url: string;
}

interface Video {
  video_id: string;
  name: string;
}

interface Website {
  url: string;
  category: number;
}

interface SimilarGame {
  id: number;
  name: string;
  cover_url: string | null;
  rating: number;
  first_release_date: number;
}

interface Dlc {
  id: number;
  name: string;
}

interface Expansion {
  id: number;
  name: string;
}

interface AgeRating {
  rating: number;
  category: string;
  content_descriptions: string[];
}

interface ReleaseDate {
  date: number;
  region: number;
  platform: string;
  status: string;
}

interface ExternalGame {
  name: string;
  url: string;
  category: string;
}

interface GameDetails {
  id: number;
  name: string;
  slug?: string;
  url?: string;
  summary: string;
  storyline: string;
  cover_url: string | null;
  first_release_date: number;
  rating: number;
  rating_count?: number;
  aggregated_rating: number;
  aggregated_rating_count?: number;
  total_rating: number;
  total_rating_count: number;
  hypes?: number;
  follows?: number;
  created_at: number;
  updated_at: number;
  checksum?: string;
  game_type?: number;
  genres: Array<{ id: number; name: string }>;
  themes: Array<{ id: number; name: string }>;
  game_modes: Array<{ id: number; name: string }>;
  player_perspectives: Array<{ id: number; name: string }>;
  platforms: Platform[];
  developers: Developer[];
  publishers: Publisher[];
  game_engines?: Array<{ id: number; name: string; logo_url?: string | null }>;
  screenshots: Screenshot[];
  artworks: Artwork[];
  videos: Video[];
  websites: Website[];
  similar_games: SimilarGame[];
  dlcs: Dlc[];
  expansions: Expansion[];
  bundles?: Array<{ id: number; name: string }>;
  collections?: Array<{ id: number; name: string }>;
  age_ratings: AgeRating[];
  release_dates: ReleaseDate[];
  external_games: ExternalGame[];
  keywords: Array<{ id: number; name: string }>;
  tags?: number[];
  multiplayer_modes?: Array<{
    id: number;
    campaigncoop?: boolean;
    dropin?: boolean;
    lancoop?: boolean;
    offlinecoop?: boolean;
    offlinecoopmax?: number;
    offlinemax?: number;
    onlinecoop?: boolean;
    onlinecoopmax?: number;
    onlinemax?: number;
    platform?: string;
    splitscreen?: boolean;
    splitscreenonline?: boolean;
  }>;
  language_supports: Array<{
    id: number;
    language?: {
      name: string;
    };
    language_support_type?: {
      name: string;
    };
  }>;
  game_localizations?: Array<{
    id: number;
    name: string;
    region?: string;
  }>;
  alternative_names: Array<{ id: number; name: string }>;
}

export default function GameDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const [game, setGame] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlayed, setIsPlayed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [updatingPlayed, setUpdatingPlayed] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const gameRef = useRef<GameDetails | null>(null);

  const rawId = params?.id;
  const idParam = Array.isArray(rawId) ? rawId[0] : rawId;
  const gameId =
    typeof idParam === 'string' && idParam.length > 0
      ? (idParam.match(/(\d+)$/)?.[1] ?? idParam)
      : null;

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const handleMarkAsPlayed = async () => {
    if (!game || !gameId) return;
    
    setUpdatingPlayed(true);
    try {
      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: gameId,
          mediaType: 'game',
          isWatched: !isPlayed,
          title: game.name,
          posterPath: game.cover_url,
          releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null,
        }),
      });
      
      if (response.ok) {
        setIsPlayed(!isPlayed);
      }
    } catch (err) {
      console.error('Failed to update played status:', err);
    } finally {
      setUpdatingPlayed(false);
    }
  };

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      if (!gameRef.current) {
        setError('Game not found');
      }
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    const hasGameForThisId = gameRef.current && String(gameRef.current.id) === gameId;
    setLoading(!hasGameForThisId);
    setError(null);

    const fetchGameDetails = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`, { signal: controller.signal });
        if (!response.ok) {
          let message = response.status === 404 ? 'Game not found' : 'Failed to load game';
          try {
            const payload = await response.json();
            if (payload?.error) {
              message = payload.error;
            }
          } catch {
            // ignore JSON parse failure and keep fallback message
          }
          throw new Error(message);
        }

        const data = await response.json();
        setGame(data);
        setError(null);
      } catch (err) {
        if (!isActive) {
          return;
        }

        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const stillHasGameForThisId = gameRef.current && String(gameRef.current.id) === gameId;
        if (stillHasGameForThisId) {
          console.warn(`[games/${gameId}] transient fetch error after data load`, err);
          setError(null);
          return;
        }

        setGame(null);
        setError(err instanceof Error ? err.message : 'Failed to load game');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchGameDetails();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [gameId]);

  useEffect(() => {
    if (!game || !gameId) return;

    const fetchPlayedStatus = async () => {
      try {
        const response = await fetch(`/api/media/status?mediaId=${gameId}&mediaType=game`);
        if (response.ok) {
          const data = await response.json();
          setIsPlayed(data.isWatched);
        }
      } catch (err) {
        console.error('Failed to fetch played status:', err);
      }
    };

    fetchPlayedStatus();
  }, [game, gameId]);

  const getYear = (timestamp: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).getFullYear();
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDisplayPlatforms = () => {
    const platforms = game?.platforms || [];
    return showAllPlatforms ? platforms : platforms.slice(0, 8);
  };

  const getWebsiteCategory = (category: number) => {
    const categories: { [key: number]: string } = {
      1: 'Official',
      2: 'Wikia',
      3: 'Wikipedia',
      4: 'Facebook',
      5: 'Twitter',
      6: 'Twitch',
      8: 'Instagram',
      9: 'YouTube',
      10: 'iPhone',
      11: 'iPad',
      12: 'Android',
      13: 'Steam',
      14: 'Reddit',
      15: 'Itch',
      16: 'Epic Games',
      17: 'GOG',
    };
    return categories[category] || 'Website';
  };

  const getWebsiteIcon = (category: number) => {
    switch (category) {
      case 4:
        return FacebookBrandIcon;
      case 5:
        return TwitterBrandIcon;
      case 6:
        return TwitchBrandIcon;
      case 8:
        return InstagramBrandIcon;
      case 9:
        return YouTubeBrandIcon;
      case 14:
        return RedditBrandIcon;
      default:
        return ExternalLink;
    }
  };

  const getExternalGameIcon = (category?: string | number) => {
    const normalized = String(category || '').toLowerCase();
    if (normalized.includes('facebook')) return FacebookBrandIcon;
    if (normalized.includes('instagram')) return InstagramBrandIcon;
    if (normalized.includes('twitter')) return TwitterBrandIcon;
    if (normalized.includes('youtube')) return YouTubeBrandIcon;
    if (normalized.includes('twitch')) return TwitchBrandIcon;
    if (normalized.includes('reddit')) return RedditBrandIcon;
    return ExternalLink;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 text-base-content flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-full blur-xl opacity-50 animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin text-base-content relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-base-100 text-base-content flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-error/30 to-warning/30 rounded-full blur-xl opacity-50" />
          <Gamepad2 className="w-20 h-20 text-base-content relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-base-content">{error || 'Game not found'}</h1>
        <Button onClick={() => router.back()} variant="outline" className="border-base-content/20 text-base-content hover:bg-base-200">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      {/* Video Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div className="relative w-full max-w-5xl aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${selectedVideo.video_id}`}
              className="w-full h-full rounded-xl"
              allow="encrypted-media"
              allowFullScreen
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-base-content hover:bg-base-200"
              onClick={() => setSelectedVideo(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Backdrop */}
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-10 lg:pb-12">
        {/* Background Backdrop Layer - isolated overflow-hidden so outer page flow is never clipped */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          {game.screenshots && game.screenshots.length > 0 ? (
            <div 
              className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
              style={{ 
                backgroundImage: `url(${game.screenshots[0].url})` 
              }}
              suppressHydrationWarning
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/25" />
          )}
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/75 to-base-100/25 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-base-100 via-base-100/60 sm:via-transparent to-base-100/50" />
          
          {/* Animated Background Effects */}
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-secondary/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button - in normal flow above hero content */}
        <div className="relative z-20 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto mb-4 sm:mb-6">
          <Button 
            variant="ghost" 
            className="group bg-base-100/70 backdrop-blur-xl border border-base-content/20 hover:bg-base-200 text-base-content transition-all duration-300 shadow-sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
            Back
          </Button>
        </div>

        {/* Game Info & Poster in normal document flow */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Cover */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-36 sm:w-44 md:w-52 lg:w-64 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border border-base-content/10 bg-base-300">
                {game.cover_url ? (
                  <Image 
                    src={game.cover_url}
                    alt={game.name}
                    fill
                    priority
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Gamepad2 className="w-16 h-16 text-primary-content/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title */}
              <div className="mb-3 sm:mb-4">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-base-content mb-2 tracking-tight">
                  {game.name}
                </h1>
                {game.alternative_names && game.alternative_names.length > 0 && (
                  <p className="text-sm sm:text-base text-base-content/60 mb-2">
                    Also known as: {game.alternative_names.slice(0, 3).map(an => an.name).join(', ')}
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                {game.first_release_date && (
                  <div className="group flex items-center gap-2 bg-base-200/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-base-content/15 text-xs sm:text-sm">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-base-content font-medium">
                      {getYear(game.first_release_date)}
                    </span>
                  </div>
                )}
                
                {game.rating && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 bg-primary/10 text-primary backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary/25 text-xs sm:text-sm">
                    <Star className="w-4 h-4 fill-primary text-primary transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                    <span className="font-bold text-primary">{game.rating.toFixed(0)}</span>
                    <span className="text-base-content/60 text-xs">/ 100</span>
                  </div>
                )}

                {game.game_type && (
                  <Badge className={cn(
                    "font-semibold text-xs sm:text-sm transition-transform duration-300 hover:scale-105",
                    game.game_type === 0 ? 'badge-primary' :
                    'badge-ghost'
                  )}>
                    {game.game_type === 0 ? 'Main Game' : 'Other'}
                  </Badge>
                )}
              </div>

              {/* Genres */}
              {game.genres && game.genres.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  {game.genres.map((genre, idx) => (
                    <span 
                      key={genre.id || idx} 
                      className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium text-xs sm:text-sm hover:bg-primary/20 hover:scale-105 transition-all duration-300 cursor-pointer"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Developers & Publishers */}
              {(game.developers?.length > 0 || game.publishers?.length > 0) && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                  {game.developers?.slice(0, 2).map((dev, idx) => (
                    <div key={idx} className="group flex items-center gap-1.5 sm:gap-2 text-base-content/70">
                      <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                      <span className="text-xs sm:text-sm">{dev.name}</span>
                    </div>
                  ))}
                  {game.publishers?.slice(0, 2).map((pub, idx) => (
                    <div key={idx} className="group flex items-center gap-1.5 sm:gap-2 text-base-content/70">
                      <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary transition-transform duration-300 group-hover:rotate-45" />
                      <span className="text-xs sm:text-sm">{pub.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
                {game.videos?.length > 0 && (
                  <Button 
                    className="group shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105"
                    onClick={() => {
                      if (game.videos?.length > 0) {
                        setSelectedVideo(game.videos[0]);
                      }
                    }}
                  >
                    <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 transition-transform duration-300 group-hover:scale-110" />
                    Watch Trailer
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsPlayed}
                  disabled={updatingPlayed}
                  className={cn(
                    "group border-base-content/20 text-base-content hover:bg-base-200 transition-all duration-300 hover:scale-105",
                    isPlayed && "bg-primary/20 border-primary/50 text-primary"
                  )}
                >
                  {updatingPlayed ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className={cn("w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-125", isPlayed && "fill-primary")} />
                  )}
                  {isPlayed ? 'Played' : 'Mark as Played'}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "group border-base-content/20 text-base-content hover:bg-base-200 transition-all duration-300 hover:scale-105",
                    isFavorite && "bg-destructive/20 border-destructive/50 text-destructive"
                  )}
                >
                  <Heart className={cn("w-4 h-4 transition-transform duration-300 group-hover:scale-125", isFavorite && "fill-destructive")} />
                </Button>
                
                <Button variant="outline" size="icon" className="group border-base-content/20 text-base-content hover:bg-base-200 transition-all duration-300 hover:scale-105">
                  <Share2 className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
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
            {/* Summary */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl blur-xl" />
              <div className="relative bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-8">
                <h2 className="text-2xl font-bold text-base-content mb-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  About
                </h2>
                <p className="text-base-content/80 leading-relaxed text-lg">
                  {game.summary || 'No summary available.'}
                </p>
                {game.storyline && (
                  <div className="mt-6 pt-6 border-t border-base-content/10">
                    <h3 className="text-lg font-semibold text-base-content mb-3">Storyline</h3>
                    <p className="text-base-content/70 leading-relaxed">
                      {game.storyline}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Videos Section */}
            {game.videos && game.videos.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6 text-secondary" />
                  Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {game.videos.map((video, idx) => (
                    <Card 
                      key={idx}
                      className="group overflow-hidden bg-base-200/70 backdrop-blur-xl border border-base-content/10 hover:border-primary/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="aspect-video relative bg-base-300">
                        <Image 
                          src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                          alt={video.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-12 h-12 text-white" />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-base-content text-sm font-medium truncate">{video.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Screenshots Section */}
            {game.screenshots && game.screenshots.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-accent" />
                  Screenshots
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {game.screenshots.map((screenshot, idx) => (
                    <div 
                      key={idx}
                      className="relative aspect-video rounded-lg overflow-hidden bg-base-300 hover:scale-105 transition-transform duration-300 cursor-pointer group"
                    >
                      <Image 
                        src={screenshot.url}
                        alt={`${game.name} screenshot ${idx + 1}`}
                        fill
                        sizes="(min-width: 1024px) 33vw, 50vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Similar Games */}
            {game.similar_games && game.similar_games.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <ThumbsUp className="w-6 h-6 text-primary" />
                  Similar Games
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {game.similar_games.map((similar, index) => (
                    <Link key={`${similar.id}-${index}`} href={`/games/${similar.id}`}>
                      <Card className="group overflow-hidden bg-base-200/70 backdrop-blur-xl border border-base-content/10 hover:border-primary/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[3/4] relative overflow-hidden bg-base-300">
                          {similar.cover_url ? (
                            <Image 
                              src={similar.cover_url}
                              alt={similar.name}
                              fill
                              sizes="(min-width: 1024px) 33vw, 50vw"
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                              <Gamepad2 className="w-10 h-10 text-base-content/40" />
                            </div>
                          )}
                          {similar.rating && (
                            <div className="absolute top-2 right-2 badge bg-base-100/85 backdrop-blur-md text-base-content border border-base-content/15 shadow-sm px-2 py-1 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3 fill-primary text-primary" />
                              <span className="text-base-content text-xs font-semibold">{similar.rating.toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-base-content truncate">{similar.name}</p>
                          <p className="text-xs text-base-content/60">{similar.first_release_date ? getYear(similar.first_release_date) : '—'}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Artworks Gallery */}
            {game.artworks && game.artworks.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-secondary" />
                  Artworks
                </h2>
                <GalleryLightbox
                  title={game.name}
                  gridClassName="grid grid-cols-2 md:grid-cols-3 gap-4"
                  images={game.artworks.map((artwork) => ({
                    src: artwork.url,
                    full: artwork.url.replace(/\/t_[^/]+\//, '/t_original/'),
                  }))}
                />
              </section>
            )}

            {/* DLCS & Expansions */}
            {(game.dlcs?.length > 0 || game.expansions?.length > 0) && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <Zap className="w-6 h-6 text-warning" />
                  DLCs & Expansions
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {game.dlcs?.map((dlc) => (
                    <Card key={`dlc-${dlc.id}`} className="bg-base-200/70 backdrop-blur-xl border border-base-content/10 hover:border-primary/50 transition-all duration-300">
                      <CardContent className="p-4">
                        <p className="text-base-content font-semibold">{dlc.name}</p>
                        <Badge variant="outline" className="mt-2 border-primary/30 text-primary">DLC</Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {game.expansions?.map((exp) => (
                    <Card key={`exp-${exp.id}`} className="bg-base-200/70 backdrop-blur-xl border border-base-content/10 hover:border-secondary/50 transition-all duration-300">
                      <CardContent className="p-4">
                        <p className="text-base-content font-semibold">{exp.name}</p>
                        <Badge variant="outline" className="mt-2 border-secondary/30 text-secondary">Expansion</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Age Ratings */}
            {game.age_ratings && game.age_ratings.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-secondary" />
                  Age Ratings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {game.age_ratings && game.age_ratings.length > 0 ? game.age_ratings.map((rating, idx) => (
                    <Card key={idx} className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-base-content/70 text-sm">{rating.category || 'Unknown'}</span>
                          <Badge className="badge-secondary font-bold">
                            {rating.rating || 'N/A'}
                          </Badge>
                        </div>
                        {rating.content_descriptions && rating.content_descriptions.length > 0 && (
                          <div className="space-y-2">
                            {rating.content_descriptions.map((desc, i) => (
                              <p key={i} className="text-base-content/60 text-xs">{desc}</p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )) : null}
                </div>
              </section>
            )}

            {/* Keywords */}
            {game.keywords && game.keywords.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  Keywords
                </h2>
                <div className="flex flex-wrap gap-2">
                  {game.keywords.map((keyword, idx) => (
                    <span 
                      key={keyword.id || idx} 
                      className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm hover:bg-primary/20 transition-all duration-300 cursor-pointer"
                    >
                      {keyword.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* External Links / Stores */}
            {game.external_games && game.external_games.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  Where to Buy
                </h3>
                <div className="space-y-3">
                  {game.external_games.filter(eg => eg.url).slice(0, 8).map((extGame, idx) => {
                    const StoreIcon = getExternalGameIcon(extGame.category);
                    return (
                      <a 
                        key={idx}
                        href={extGame.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-base-200/70 backdrop-blur-xl rounded-xl border border-base-content/10 hover:border-primary/50 transition-all duration-300 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                          <StoreIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <span className="text-base-content group-hover:text-primary transition-colors font-medium text-sm block">{extGame.name || extGame.category}</span>
                          <span className="text-base-content/60 text-xs">{extGame.category}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-base-content/60 group-hover:text-primary" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Rating Details */}
            {(game.aggregated_rating || game.total_rating || game.total_rating_count) && (
              <section className="bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-6">
                <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  Rating Details
                </h3>
                <div className="space-y-3">
                  {game.aggregated_rating && (
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 text-sm">Critic Score</span>
                      <span className="text-base-content font-medium">{game.aggregated_rating.toFixed(0)}%</span>
                    </div>
                  )}
                  {game.total_rating && (
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 text-sm">Total Rating</span>
                      <span className="text-base-content font-medium">{game.total_rating.toFixed(0)}%</span>
                    </div>
                  )}
                  {game.total_rating_count && (
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 text-sm">Rating Count</span>
                      <span className="text-base-content font-medium">{game.total_rating_count.toLocaleString()}</span>
                    </div>
                  )}
                  {game.rating_count && (
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60 text-sm">User Ratings</span>
                      <span className="text-base-content font-medium">{game.rating_count.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Release Dates */}
            {game.release_dates && game.release_dates.length > 0 && (
              <section className="bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-6">
                <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent" />
                  Release Dates
                </h3>
                <div className="space-y-3">
                  {game.release_dates.slice(0, 5).map((rd, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div>
                        <span className="text-base-content text-sm block">{rd.platform}</span>
                        {rd.status && <span className="text-base-content/60 text-xs">{rd.status}</span>}
                      </div>
                      <span className="text-base-content/70 text-sm">{rd.date ? formatDate(rd.date) : 'TBA'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Details Card */}
            <section className="bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-6">
              <h3 className="text-lg font-bold text-base-content mb-4">Details</h3>
              <div className="space-y-4">
                {game.game_modes && game.game_modes.length > 0 && (
                  <div>
                    <span className="text-base-content/60 text-sm block mb-2">Game Modes</span>
                    <div className="flex flex-wrap gap-2">
                      {game.game_modes.map((mode, idx) => (
                        <Badge key={mode.id || idx} variant="outline" className="border-base-content/20 text-base-content/80">
                          {mode.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {game.themes && game.themes.length > 0 && (
                  <div>
                    <span className="text-base-content/60 text-sm block mb-2">Themes</span>
                    <div className="flex flex-wrap gap-2">
                      {game.themes.map((theme, idx) => (
                        <Badge key={theme.id || idx} variant="outline" className="border-base-content/20 text-base-content/80">
                          {theme.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {game.player_perspectives && game.player_perspectives.length > 0 && (
                  <div>
                    <span className="text-base-content/60 text-sm block mb-2">Player Perspectives</span>
                    <div className="flex flex-wrap gap-2">
                      {game.player_perspectives.map((pp, idx) => (
                        <Badge key={pp.id || idx} variant="outline" className="border-base-content/20 text-base-content/80">
                          {pp.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 text-sm">Hypes</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-base-content font-medium">{game.hypes || 0}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 text-sm">Follows</span>
                  <span className="text-base-content font-medium">{game.follows || 0}</span>
                </div>
              </div>
            </section>

            {/* Platforms */}
            {game.platforms && game.platforms.length > 0 && (
              <section className="bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-secondary" />
                    Platforms
                  </h3>
                  {game.platforms.length > 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                      className="text-base-content/70 hover:text-base-content hover:bg-base-200"
                    >
                      {showAllPlatforms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {getDisplayPlatforms().map((platform, idx) => (
                    <Badge key={idx} variant="outline" className="border-base-content/20 text-base-content/80">
                      {platform.name}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Multiplayer Features */}
            {game.multiplayer_modes && game.multiplayer_modes.length > 0 && (
              <section className="bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-6">
                <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Multiplayer
                </h3>
                <div className="space-y-2">
                  {game.multiplayer_modes[0].offlinecoop && (
                    <div className="flex items-center gap-2 text-base-content/80">
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-sm">Offline Co-op</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].onlinecoop && (
                    <div className="flex items-center gap-2 text-base-content/80">
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-sm">Online Co-op</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].lancoop && (
                    <div className="flex items-center gap-2 text-base-content/80">
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-sm">LAN Co-op</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].splitscreen && (
                    <div className="flex items-center gap-2 text-base-content/80">
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-sm">Split Screen</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].campaigncoop && (
                    <div className="flex items-center gap-2 text-base-content/80">
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-sm">Campaign Co-op</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Language Supports */}
            {game.language_supports && game.language_supports.length > 0 && (
              <section className="bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-6">
                <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-accent" />
                  Languages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {game.language_supports.map((ls, idx) => (
                    <Badge key={idx} variant="outline" className="border-base-content/20 text-base-content/80">
                      {ls.language?.name || 'Unknown'} {ls.language_support_type?.name ? `(${ls.language_support_type.name})` : ''}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Websites */}
            {game.websites && game.websites.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Links
                </h3>
                <div className="space-y-3">
                  {game.websites.slice(0, 6).map((website, idx) => {
                    const WebsiteIcon = getWebsiteIcon(website.category);
                    return (
                      <a 
                        key={idx}
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-base-200/70 backdrop-blur-xl rounded-xl border border-base-content/10 hover:border-primary/50 transition-all duration-300 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                          <WebsiteIcon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-base-content group-hover:text-primary transition-colors font-medium text-sm">{getWebsiteCategory(website.category)}</span>
                        <ExternalLink className="w-4 h-4 text-base-content/60 ml-auto group-hover:text-primary" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {game ? (
          <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
            <CommentsSection
              mediaId={String(game.id)}
              mediaType="game"
              title={game.name}
              posterPath={game.cover_url ?? null}
              releaseDate={game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
