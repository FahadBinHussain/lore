'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Calendar, Globe, 
  Users, Loader2, Play, 
  Heart, Share2, Check, Gamepad2, Monitor,
  ExternalLink, TrendingUp, Award, Building2,
  ChevronDown, ChevronUp,
  PlayCircle, Image as ImageIcon, Sparkles,
  ThumbsUp, Zap, 
  Video, FileText, MapPin, Clock, Settings
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

interface MultiplayerMode {
  campaigncoop: boolean;
  lancoop: boolean;
  offlinecoop: boolean;
  onlinecoop: boolean;
  splitscreen: boolean;
}

interface LanguageSupport {
  id: number;
  language?: {
    name: string;
  };
  language_support_type?: {
    name: string;
  };
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

  const getExternalGameIcon = (category?: string) => {
    const normalized = (category || '').toLowerCase();
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-50 animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin text-white relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-xl opacity-50" />
          <Gamepad2 className="w-20 h-20 text-white relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-white">{error || 'Game not found'}</h1>
        <Button onClick={() => router.back()} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setSelectedVideo(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Backdrop */}
      <div className="relative h-[70vh] min-h-[600px] overflow-hidden">
        {game.screenshots && game.screenshots.length > 0 ? (
          <div 
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ 
              backgroundImage: `url(${game.screenshots[0].url})` 
            }}
            suppressHydrationWarning
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-teal-600/20 to-cyan-600/30" />
        )}
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />
        
        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-teal-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
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

        {/* Game Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Cover */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl">
                {game.cover_url ? (
                  <img 
                    src={game.cover_url}
                    alt={game.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                    <Gamepad2 className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <div className="mb-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-tight">
                  {game.name}
                </h1>
                {game.alternative_names && game.alternative_names.length > 0 && (
                  <p className="text-lg text-white/50 mb-2">
                    Also known as: {game.alternative_names.slice(0, 3).map(an => an.name).join(', ')}
                  </p>
                )}
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {game.first_release_date && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span className="text-white font-medium">
                      {getYear(game.first_release_date)}
                    </span>
                  </div>
                )}
                
                {game.rating && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-amber-400">{game.rating.toFixed(0)}</span>
                    <span className="text-white/50 text-sm">/ 100</span>
                  </div>
                )}

                {game.game_type && (
                  <Badge className={cn(
                    "font-semibold",
                    game.game_type === 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  )}>
                    {game.game_type === 0 ? 'Main Game' : 'Other'}
                  </Badge>
                )}

              </div>

              {/* Genres */}
              {game.genres && game.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {game.genres.map((genre, idx) => (
                    <span 
                      key={genre.id || idx} 
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 font-medium text-sm hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-300 cursor-pointer"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Developers & Publishers */}
              {(game.developers?.length > 0 || game.publishers?.length > 0) && (
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  {game.developers?.slice(0, 2).map((dev, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-white/70">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">{dev.name}</span>
                    </div>
                  ))}
                  {game.publishers?.slice(0, 2).map((pub, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-white/70">
                      <Globe className="w-4 h-4 text-teal-400" />
                      <span className="text-sm">{pub.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {game.videos?.length > 0 && (
                  <Button 
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300"
                    onClick={() => {
                      if (game.videos?.length > 0) {
                        setSelectedVideo(game.videos[0]);
                      }
                    }}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Watch Trailer
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsPlayed}
                  disabled={updatingPlayed}
                  className={cn(
                    "border-white/20 text-white hover:bg-white/10 transition-all duration-300",
                    isPlayed && "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  )}
                >
                  {updatingPlayed ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className={cn("w-4 h-4 mr-2", isPlayed && "fill-emerald-400")} />
                  )}
                  {isPlayed ? 'Played' : 'Mark as Played'}
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
            {/* Summary */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 rounded-3xl blur-xl" />
              <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                  About
                </h2>
                <p className="text-white/80 leading-relaxed text-lg">
                  {game.summary || 'No summary available.'}
                </p>
                {game.storyline && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3">Storyline</h3>
                    <p className="text-white/70 leading-relaxed">
                      {game.storyline}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Videos Section */}
            {game.videos && game.videos.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6 text-teal-400" />
                  Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {game.videos.map((video, idx) => (
                    <Card 
                      key={idx}
                      className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="aspect-video relative bg-slate-800">
                        <img 
                          src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-12 h-12 text-white" />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-white text-sm font-medium truncate">{video.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Screenshots Section */}
            {game.screenshots && game.screenshots.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-pink-400" />
                  Screenshots
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {game.screenshots.map((screenshot, idx) => (
                    <div 
                      key={idx}
                      className="aspect-video rounded-lg overflow-hidden bg-slate-800 hover:scale-105 transition-transform duration-300 cursor-pointer group"
                    >
                      <img 
                        src={screenshot.url}
                        alt={`${game.name} screenshot ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Similar Games */}
            {game.similar_games && game.similar_games.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <ThumbsUp className="w-6 h-6 text-emerald-400" />
                  Similar Games
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {game.similar_games.map((similar, index) => (
                    <Link key={`${similar.id}-${index}`} href={`/games/${similar.id}`}>
                      <Card className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 transition-all duration-300 hover:transform hover:scale-105">
                        <div className="aspect-[3/4] relative overflow-hidden bg-slate-800">
                          {similar.cover_url ? (
                            <img 
                              src={similar.cover_url}
                              alt={similar.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                              <Gamepad2 className="w-10 h-10 text-white/30" />
                            </div>
                          )}
                          {similar.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span className="text-white text-xs font-semibold">{similar.rating.toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-white truncate">{similar.name}</p>
                          <p className="text-xs text-white/50">{similar.first_release_date ? getYear(similar.first_release_date) : '—'}</p>
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
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-purple-400" />
                  Artworks
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {game.artworks.map((artwork, idx) => (
                    <div 
                      key={idx}
                      className="aspect-video rounded-lg overflow-hidden bg-slate-800 hover:scale-105 transition-transform duration-300 cursor-pointer group"
                    >
                      <img 
                        src={artwork.url}
                        alt={`${game.name} artwork ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* DLCS & Expansions */}
            {(game.dlcs?.length > 0 || game.expansions?.length > 0) && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Zap className="w-6 h-6 text-yellow-400" />
                  DLCs & Expansions
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {game.dlcs?.map((dlc) => (
                    <Card key={`dlc-${dlc.id}`} className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-yellow-500/30 transition-all duration-300">
                      <CardContent className="p-4">
                        <p className="text-white font-semibold">{dlc.name}</p>
                        <Badge variant="outline" className="mt-2 border-yellow-500/30 text-yellow-400">DLC</Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {game.expansions?.map((exp) => (
                    <Card key={`exp-${exp.id}`} className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-purple-500/30 transition-all duration-300">
                      <CardContent className="p-4">
                        <p className="text-white font-semibold">{exp.name}</p>
                        <Badge variant="outline" className="mt-2 border-purple-500/30 text-purple-400">Expansion</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Age Ratings */}
            {game.age_ratings && game.age_ratings.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-orange-400" />
                  Age Ratings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {game.age_ratings && game.age_ratings.length > 0 ? game.age_ratings.map((rating, idx) => (
                    <Card key={idx} className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-white/70 text-sm">{rating.category || 'Unknown'}</span>
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-bold">
                            {rating.rating || 'N/A'}
                          </Badge>
                        </div>
                        {rating.content_descriptions && rating.content_descriptions.length > 0 && (
                          <div className="space-y-2">
                            {rating.content_descriptions.map((desc, i) => (
                              <p key={i} className="text-white/60 text-xs">{desc}</p>
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
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                  Keywords
                </h2>
                <div className="flex flex-wrap gap-2">
                  {game.keywords.map((keyword, idx) => (
                    <span 
                      key={keyword.id || idx} 
                      className="px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 text-yellow-300 text-sm hover:from-yellow-500/20 hover:to-orange-500/20 transition-all duration-300 cursor-pointer"
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
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-emerald-400" />
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
                        className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-emerald-500/50 transition-all duration-300 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <StoreIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <span className="text-white group-hover:text-emerald-400 transition-colors font-medium text-sm block">{extGame.name || extGame.category}</span>
                          <span className="text-white/50 text-xs">{extGame.category}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/50 group-hover:text-emerald-400" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Rating Details */}
            {(game.aggregated_rating || game.total_rating || game.total_rating_count) && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" />
                  Rating Details
                </h3>
                <div className="space-y-3">
                  {game.aggregated_rating && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Critic Score</span>
                      <span className="text-white font-medium">{game.aggregated_rating.toFixed(0)}%</span>
                    </div>
                  )}
                  {game.total_rating && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Total Rating</span>
                      <span className="text-white font-medium">{game.total_rating.toFixed(0)}%</span>
                    </div>
                  )}
                  {game.total_rating_count && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Rating Count</span>
                      <span className="text-white font-medium">{game.total_rating_count.toLocaleString()}</span>
                    </div>
                  )}
                  {game.rating_count && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">User Ratings</span>
                      <span className="text-white font-medium">{game.rating_count.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Release Dates */}
            {game.release_dates && game.release_dates.length > 0 && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Release Dates
                </h3>
                <div className="space-y-3">
                  {game.release_dates.slice(0, 5).map((rd, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div>
                        <span className="text-white text-sm block">{rd.platform}</span>
                        {rd.status && <span className="text-white/50 text-xs">{rd.status}</span>}
                      </div>
                      <span className="text-white/70 text-sm">{rd.date ? formatDate(rd.date) : 'TBA'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Details Card */}
            <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Details</h3>
              <div className="space-y-4">
                {game.game_modes && game.game_modes.length > 0 && (
                  <div>
                    <span className="text-white/60 text-sm block mb-2">Game Modes</span>
                    <div className="flex flex-wrap gap-2">
                      {game.game_modes.map((mode, idx) => (
                        <Badge key={mode.id || idx} variant="outline" className="border-white/20 text-white/80">
                          {mode.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {game.themes && game.themes.length > 0 && (
                  <div>
                    <span className="text-white/60 text-sm block mb-2">Themes</span>
                    <div className="flex flex-wrap gap-2">
                      {game.themes.map((theme, idx) => (
                        <Badge key={theme.id || idx} variant="outline" className="border-white/20 text-white/80">
                          {theme.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {game.player_perspectives && game.player_perspectives.length > 0 && (
                  <div>
                    <span className="text-white/60 text-sm block mb-2">Player Perspectives</span>
                    <div className="flex flex-wrap gap-2">
                      {game.player_perspectives.map((pp, idx) => (
                        <Badge key={pp.id || idx} variant="outline" className="border-white/20 text-white/80">
                          {pp.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">Hypes</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{game.hypes || 0}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">Follows</span>
                  <span className="text-white font-medium">{game.follows || 0}</span>
                </div>
              </div>
            </section>

            {/* Platforms */}
            {game.platforms && game.platforms.length > 0 && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-teal-400" />
                    Platforms
                  </h3>
                  {game.platforms.length > 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                      className="text-white/70 hover:text-white hover:bg-white/10"
                    >
                      {showAllPlatforms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {getDisplayPlatforms().map((platform, idx) => (
                    <Badge key={idx} variant="outline" className="border-white/20 text-white/80">
                      {platform.name}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Multiplayer Features */}
            {game.multiplayer_modes && game.multiplayer_modes.length > 0 && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Multiplayer
                </h3>
                <div className="space-y-2">
                  {game.multiplayer_modes[0].offlinecoop && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">Offline Co-op</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].onlinecoop && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">Online Co-op</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].lancoop && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">LAN Co-op</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].splitscreen && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">Split Screen</span>
                    </div>
                  )}
                  {game.multiplayer_modes[0].campaigncoop && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">Campaign Co-op</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Language Supports */}
            {game.language_supports && game.language_supports.length > 0 && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Languages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {game.language_supports.map((ls, idx) => (
                    <Badge key={idx} variant="outline" className="border-white/20 text-white/80">
                      {ls.language?.name || 'Unknown'} {ls.language_support_type?.name ? `(${ls.language_support_type.name})` : ''}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Websites */}
            {game.websites && game.websites.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
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
                        className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-blue-500/50 transition-all duration-300 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          <WebsiteIcon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white group-hover:text-blue-400 transition-colors font-medium text-sm">{getWebsiteCategory(website.category)}</span>
                        <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-blue-400" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
