'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Film, Tv, Gamepad2, BookOpen, Sparkles,
  ArrowRight, Play, Star, Zap, Globe,
  ChevronRight, Flame, Crown, Rocket,
  TrendingUp, Users, Award, Shield,
  CheckCircle, BarChart3, Layers, Target,
  Monitor, Smartphone, Cloud, Lock,
  MessageCircle, Heart, Eye,
  Clock, Calendar, MapPin, Mail,
  Phone, ExternalLink, Download, Share2,
  Loader2, BookOpen as ComicIcon, Music, Podcast, MapPin as ThemeParkIcon,
  Puzzle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: number;
  title: string;
  image: string | null;
  year?: string;
  rating?: number;
  description?: string;
  seasons?: number;
  episodes?: number;
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTVShows] = useState<MediaItem[]>([]);
  const [games, setGames] = useState<MediaItem[]>([]);
  const [books, setBooks] = useState<MediaItem[]>([]);
  const [comics, setComics] = useState<MediaItem[]>([]);
  const [boardGames, setBoardGames] = useState<MediaItem[]>([]);
  const [soundtracks, setSoundtracks] = useState<MediaItem[]>([]);
  const [podcasts, setPodcasts] = useState<MediaItem[]>([]);
  const [themeParks, setThemeParks] = useState<MediaItem[]>([]);
  
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingTV, setLoadingTV] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingComics, setLoadingComics] = useState(true);
  const [loadingBoardGames, setLoadingBoardGames] = useState(true);
  const [loadingSoundtracks, setLoadingSoundtracks] = useState(true);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);
  const [loadingThemeParks, setLoadingThemeParks] = useState(true);
  const [activeTab, setActiveTab] = useState('movies');

  useEffect(() => {
    setMounted(true);
    fetchMovies();
    fetchTVShows();
    fetchGames();
    fetchBooks();
    fetchComics();
    fetchBoardGames();
    fetchSoundtracks();
    fetchPodcasts();
    fetchThemeParks();
  }, []);

  const fetchMovies = async () => {
    try {
      const response = await fetch('/api/movies?category=trending&timeWindow=week');
      const data = await response.json();
      setMovies(data.results || []);
    } catch (error) {
      console.error('Failed to fetch movies:', error);
    } finally {
      setLoadingMovies(false);
    }
  };

  const fetchTVShows = async () => {
    try {
      const response = await fetch('/api/tv?category=trending&timeWindow=week');
      const data = await response.json();
      setTVShows(data.results || []);
    } catch (error) {
      console.error('Failed to fetch TV shows:', error);
    } finally {
      setLoadingTV(false);
    }
  };

  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games');
      const data = await response.json();
      setGames(data.results || []);
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  const fetchBooks = async () => {
    try {
      const response = await fetch('/api/books');
      const data = await response.json();
      setBooks(data.results || []);
    } catch (error) {
      console.error('Failed to fetch books:', error);
    } finally {
      setLoadingBooks(false);
    }
  };

  const fetchComics = async () => {
    try {
      const response = await fetch('/api/comics');
      const data = await response.json();
      setComics(data.results || []);
    } catch (error) {
      console.error('Failed to fetch comics:', error);
    } finally {
      setLoadingComics(false);
    }
  };

  const fetchBoardGames = async () => {
    try {
      const response = await fetch('/api/boardgames');
      const data = await response.json();
      setBoardGames(data.results || []);
    } catch (error) {
      console.error('Failed to fetch board games:', error);
    } finally {
      setLoadingBoardGames(false);
    }
  };

  const fetchSoundtracks = async () => {
    try {
      const response = await fetch('/api/soundtracks');
      const data = await response.json();
      setSoundtracks(data.results || []);
    } catch (error) {
      console.error('Failed to fetch soundtracks:', error);
    } finally {
      setLoadingSoundtracks(false);
    }
  };

  const fetchPodcasts = async () => {
    try {
      const response = await fetch('/api/podcasts');
      const data = await response.json();
      setPodcasts(data.results || []);
    } catch (error) {
      console.error('Failed to fetch podcasts:', error);
    } finally {
      setLoadingPodcasts(false);
    }
  };

  const fetchThemeParks = async () => {
    try {
      const response = await fetch('/api/themeparks');
      const data = await response.json();
      setThemeParks(data.results || []);
    } catch (error) {
      console.error('Failed to fetch theme parks:', error);
    } finally {
      setLoadingThemeParks(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full blur-3xl opacity-50" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 transition-all duration-1000",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Introducing Lore 2.0</span>
              <Badge variant="secondary" className="text-xs">New</Badge>
            </div>

            {/* Main Headline */}
            <div className={cn(
              "space-y-4 transition-all duration-1000 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  Track Your
                </span>
                <br />
                <span className="bg-gradient-to-r from-primary via-primary to-primary/80 bg-clip-text text-transparent">
                  Media Universe
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                The most beautiful and intuitive way to track movies, TV shows, games, and books. 
                Join thousands of enthusiasts who&apos;ve transformed their media experience.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-300",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              <Link href="/auth/signin">
                <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                  <Rocket className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                  Start Tracking Free
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="group border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300">
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Watch Demo
              </Button>
            </div>

            {/* Social Proof */}
            <div className={cn(
              "flex flex-col items-center gap-6 pt-8 transition-all duration-1000 delay-500",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
                <div className="flex -space-x-2">
                {[
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50',
                  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50',
                  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50'
                ].map((avatar, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-background bg-cover bg-center shadow-lg"
                    style={{ backgroundImage: `url("${avatar}")` }}
                    suppressHydrationWarning
                  />
                ))}
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Trusted by <span className="font-semibold text-foreground">50,000+</span> users worldwide
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-sm font-medium ml-1">4.9/5 rating</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Media Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending Now
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover What&apos;s Hot
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore trending movies and TV shows from TMDB
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground overflow-x-auto max-w-full">
                <TabsTrigger value="movies" className="flex items-center gap-2 whitespace-nowrap">
                  <Film className="w-4 h-4" />
                  Movies
                </TabsTrigger>
                <TabsTrigger value="tv" className="flex items-center gap-2 whitespace-nowrap">
                  <Tv className="w-4 h-4" />
                  TV Shows
                </TabsTrigger>
                <TabsTrigger value="games" className="flex items-center gap-2 whitespace-nowrap">
                  <Gamepad2 className="w-4 h-4" />
                  Games
                </TabsTrigger>
                <TabsTrigger value="books" className="flex items-center gap-2 whitespace-nowrap">
                  <BookOpen className="w-4 h-4" />
                  Books
                </TabsTrigger>
                <TabsTrigger value="comics" className="flex items-center gap-2 whitespace-nowrap">
                  <ComicIcon className="w-4 h-4" />
                  Comics
                </TabsTrigger>
                <TabsTrigger value="boardgames" className="flex items-center gap-2 whitespace-nowrap">
                  <Puzzle className="w-4 h-4" />
                  Board Games
                </TabsTrigger>
                <TabsTrigger value="soundtracks" className="flex items-center gap-2 whitespace-nowrap">
                  <Music className="w-4 h-4" />
                  Soundtracks
                </TabsTrigger>
                <TabsTrigger value="podcasts" className="flex items-center gap-2 whitespace-nowrap">
                  <Podcast className="w-4 h-4" />
                  Podcasts
                </TabsTrigger>
                <TabsTrigger value="themeparks" className="flex items-center gap-2 whitespace-nowrap">
                  <ThemeParkIcon className="w-4 h-4" />
                  Theme Parks
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="movies">
              {loadingMovies ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : movies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {movies.slice(0, 12).map((movie) => (
                    <Link key={movie.id} href={`/movies/${movie.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {movie.image ? (
                            <img 
                              src={movie.image} 
                              alt={movie.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {movie.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {movie.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
                          {movie.year && (
                            <p className="text-xs text-muted-foreground mt-1">{movie.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Movies Found</h3>
                  <p className="text-muted-foreground">Unable to load trending movies at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/movies">
                  <Button variant="outline" className="group">
                    View All Movies
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="tv">
              {loadingTV ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : tvShows.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {tvShows.slice(0, 12).map((show) => (
                    <Link key={show.id} href={`/tv/${show.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {show.image ? (
                            <img 
                              src={show.image} 
                              alt={show.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Tv className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {show.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {show.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{show.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {show.year && (
                              <p className="text-xs text-muted-foreground">{show.year}</p>
                            )}
                            {show.seasons && (
                              <p className="text-xs text-muted-foreground">
                                {show.seasons} season{show.seasons !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Tv className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No TV Shows Found</h3>
                  <p className="text-muted-foreground">Unable to load trending TV shows at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/tv">
                  <Button variant="outline" className="group">
                    View All TV Shows
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="games">
              {loadingGames ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : games.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {games.slice(0, 12).map((game) => (
                    <Link key={game.id} href={`/games/${game.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {game.image ? (
                            <img 
                              src={game.image} 
                              alt={game.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Gamepad2 className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {game.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {game.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{game.title}</h3>
                          {game.year && (
                            <p className="text-xs text-muted-foreground mt-1">{game.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Games Found</h3>
                  <p className="text-muted-foreground">Unable to load trending games at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/games">
                  <Button variant="outline" className="group">
                    View All Games
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="books">
              {loadingBooks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : books.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {books.slice(0, 12).map((book) => (
                    <Link key={book.id} href={`/books/${book.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {book.image ? (
                            <img 
                              src={book.image} 
                              alt={book.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {book.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {book.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{book.title}</h3>
                          {book.year && (
                            <p className="text-xs text-muted-foreground mt-1">{book.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Books Found</h3>
                  <p className="text-muted-foreground">Unable to load trending books at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/books">
                  <Button variant="outline" className="group">
                    View All Books
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="comics">
              {loadingComics ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : comics.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {comics.slice(0, 12).map((comic) => (
                    <Link key={comic.id} href={`/comics/${comic.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {comic.image ? (
                            <img 
                              src={comic.image} 
                              alt={comic.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ComicIcon className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {comic.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {comic.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{comic.title}</h3>
                          {comic.year && (
                            <p className="text-xs text-muted-foreground mt-1">{comic.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <ComicIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Comics Found</h3>
                  <p className="text-muted-foreground">Unable to load trending comics at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/comics">
                  <Button variant="outline" className="group">
                    View All Comics
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="boardgames">
              {loadingBoardGames ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : boardGames.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {boardGames.slice(0, 12).map((boardGame) => (
                    <Link key={boardGame.id} href={`/boardgames/${boardGame.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {boardGame.image ? (
                            <img 
                              src={boardGame.image} 
                              alt={boardGame.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Puzzle className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {boardGame.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {boardGame.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{boardGame.title}</h3>
                          {boardGame.year && (
                            <p className="text-xs text-muted-foreground mt-1">{boardGame.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Puzzle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Board Games Found</h3>
                  <p className="text-muted-foreground">Unable to load trending board games at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/boardgames">
                  <Button variant="outline" className="group">
                    View All Board Games
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="soundtracks">
              {loadingSoundtracks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : soundtracks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {soundtracks.slice(0, 12).map((soundtrack) => (
                    <Link key={soundtrack.id} href={`/soundtracks/${soundtrack.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {soundtrack.image ? (
                            <img 
                              src={soundtrack.image} 
                              alt={soundtrack.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {soundtrack.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {soundtrack.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{soundtrack.title}</h3>
                          {soundtrack.year && (
                            <p className="text-xs text-muted-foreground mt-1">{soundtrack.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Soundtracks Found</h3>
                  <p className="text-muted-foreground">Unable to load trending soundtracks at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/soundtracks">
                  <Button variant="outline" className="group">
                    View All Soundtracks
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="podcasts">
              {loadingPodcasts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : podcasts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {podcasts.slice(0, 12).map((podcast) => (
                    <Link key={podcast.id} href={`/podcasts/${podcast.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {podcast.image ? (
                            <img 
                              src={podcast.image} 
                              alt={podcast.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Podcast className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {podcast.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {podcast.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{podcast.title}</h3>
                          {podcast.year && (
                            <p className="text-xs text-muted-foreground mt-1">{podcast.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Podcast className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Podcasts Found</h3>
                  <p className="text-muted-foreground">Unable to load trending podcasts at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/podcasts">
                  <Button variant="outline" className="group">
                    View All Podcasts
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="themeparks">
              {loadingThemeParks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : themeParks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {themeParks.slice(0, 12).map((themePark) => (
                    <Link key={themePark.id} href={`/themeparks/${themePark.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                          {themePark.image ? (
                            <img 
                              src={themePark.image} 
                              alt={themePark.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ThemeParkIcon className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          {themePark.rating && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {themePark.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm truncate">{themePark.title}</h3>
                          {themePark.year && (
                            <p className="text-xs text-muted-foreground mt-1">{themePark.year}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <ThemeParkIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Theme Parks Found</h3>
                  <p className="text-muted-foreground">Unable to load trending theme parks at this time.</p>
                </Card>
              )}
              <div className="mt-8 text-center">
                <Link href="/themeparks">
                  <Button variant="outline" className="group">
                    View All Theme Parks
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Rocket className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Ready to Start?</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl font-bold">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Begin Your Journey Today
              </span>
            </h2>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join our community of media enthusiasts and transform how you track your entertainment.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signin">
                <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                  <Zap className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="border-2">
                <Globe className="w-5 h-5 mr-2" />
                View on GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">Lore</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                The most beautiful way to track your media universe.
              </p>
              <div className="flex items-center gap-4">
                {[MessageCircle, Heart, Eye, Globe].map((Icon, i) => (
                  <Button key={i} variant="ghost" size="icon" className="h-8 w-8">
                    <Icon className="w-4 h-4" />
                  </Button>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                {['Features', 'Integrations', 'Changelog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                {['Privacy', 'Terms', 'Security', 'Cookies'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © 2026 Lore. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <span className="text-sm text-muted-foreground">Made with</span>
              <Heart className="w-4 h-4 text-red-500 fill-current" />
              <span className="text-sm text-muted-foreground">for media lovers</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}