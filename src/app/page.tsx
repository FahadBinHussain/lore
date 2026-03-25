'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { 
  Film, Tv, Gamepad2, BookOpen, Sparkles,
  ArrowRight, Play, Star, Zap, Globe,
  ChevronRight, Flame, Crown, Rocket,
  TrendingUp, Users, Award, Shield,
  CheckCircle, BarChart3, Layers, Target,
  Monitor, Smartphone, Cloud, Lock,
  Menu, X, MessageCircle, Heart, Eye,
  Clock, Calendar, MapPin, Mail,
  Phone, ExternalLink, Download, Share2,
  LayoutDashboard, User, Settings, LogOut,
  Search, Plus, Bell, Moon, Sun, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
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

const features = [
  {
    icon: Film,
    title: 'Movie Tracking',
    description: 'Track your cinema journey with detailed progress and ratings',
    color: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/25'
  },
  {
    icon: Tv,
    title: 'TV Shows',
    description: 'Never lose track of episodes and seasons again',
    color: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/25'
  },
  {
    icon: Gamepad2,
    title: 'Gaming',
    description: 'Level up your gaming experience with progress tracking',
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/25'
  },
  {
    icon: BookOpen,
    title: 'Books',
    description: 'Read more with intelligent progress monitoring',
    color: 'from-emerald-500 to-green-600',
    glow: 'shadow-emerald-500/25'
  }
];

const stats = [
  { value: '50K+', label: 'Active Users', icon: Users },
  { value: '2M+', label: 'Items Tracked', icon: Target },
  { value: '99.9%', label: 'Uptime', icon: Shield },
  { value: '4.9', label: 'Rating', icon: Star }
];

const testimonials = [
  {
    quote: "Lore has completely transformed how I track my entertainment. The interface is beautiful and intuitive.",
    author: "Sarah Chen",
    role: "Film Enthusiast",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100"
  },
  {
    quote: "The universe feature is genius! I can finally organize all my favorite franchises in one place.",
    author: "Marcus Rodriguez",
    role: "Content Creator",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
  },
  {
    quote: "Best media tracking app I've ever used. The progress visualization is incredibly satisfying.",
    author: "Emily Watson",
    role: "Book Lover",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100"
  }
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTVShows] = useState<MediaItem[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingTV, setLoadingTV] = useState(true);
  const [activeTab, setActiveTab] = useState('movies');

  useEffect(() => {
    setMounted(true);
    fetchMovies();
    fetchTVShows();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="relative z-50 border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/90 to-background/80 backdrop-blur-xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  Lore
                </span>
                <span className="text-[10px] text-muted-foreground font-medium -mt-1">Media Tracker</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
              </a>
              <Link
                href="/about"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
              </Link>
              <Link
                href="/contact"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 group-hover:w-full transition-all duration-300" />
              </Link>
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {status === 'loading' ? (
                <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<div />}>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all duration-200">
                      <Avatar className="h-10 w-10 ring-2 ring-background/50">
                        <AvatarImage src={session.user.image || ''} alt={session.user.name || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground font-semibold text-sm">
                          {session.user.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72 p-0 shadow-2xl border-border/50 bg-background/95 backdrop-blur-xl" align="end">
                    {/* User Profile Section */}
                    <div className="px-4 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-secondary/5 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage src={session.user.image || ''} alt={session.user.name || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                            {session.user.name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {session.user.name || 'User'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {session.user.email || 'user@example.com'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Section */}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Navigation
                      </DropdownMenuLabel>
                      
                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <Link href="/dashboard" className="flex items-center w-full">
                          <LayoutDashboard className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Dashboard</span>
                          <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <Link href="/search" className="flex items-center w-full">
                          <Search className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Search Media</span>
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <Link href="/universes" className="flex items-center w-full">
                          <Plus className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Create Universe</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Account Section */}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Account
                      </DropdownMenuLabel>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <User className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Profile</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <Settings className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Settings</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem className="px-3 py-2.5 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 transition-colors duration-150">
                        <div className="flex items-center w-full">
                          <Bell className="mr-3 h-4 w-4 text-primary" />
                          <span className="font-medium">Notifications</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Sign Out */}
                    <div className="p-2">
                      <DropdownMenuItem 
                        className="px-3 py-2.5 cursor-pointer hover:bg-destructive/5 focus:bg-destructive/5 transition-colors duration-150 text-destructive focus:text-destructive"
                        onClick={() => signOut({ callbackUrl: '/' })}
                      >
                        <div className="flex items-center w-full">
                          <LogOut className="mr-3 h-4 w-4" />
                          <span className="font-medium">Sign Out</span>
                        </div>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button variant="ghost" className="text-sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signin">
                    <Button className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border/50">
              <div className="flex flex-col space-y-4">
                <a
                  href="#features"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </a>
                <Link
                  href="/about"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </Link>
                <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
                  {status === 'loading' ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : session?.user ? (
                    <Link href="/dashboard">
                      <Button className="w-full bg-gradient-to-r from-primary to-primary/90">
                        Go to Dashboard
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link href="/auth/signin">
                        <Button variant="ghost" className="w-full">
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/auth/signin">
                        <Button className="w-full bg-gradient-to-r from-primary to-primary/90">
                          Get Started
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

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
              {status === 'loading' ? (
                <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : session?.user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                    <Rocket className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signin">
                  <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                    <Rocket className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                    Start Tracking Free
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
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
                    style={{ backgroundImage: "url('" + avatar + "')" }}
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

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
              <Layers className="w-3 h-3 mr-1" />
              Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Everything You Need
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to make media tracking effortless and enjoyable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className={cn(
                  "group relative overflow-hidden border-0 bg-card/50 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl",
                  feature.glow,
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5", feature.color)} />
                <CardContent className="relative p-6">
                  <div className={cn("p-3 rounded-2xl bg-gradient-to-br shadow-lg mb-4", feature.color)}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
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
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="movies" className="flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  Movies
                </TabsTrigger>
                <TabsTrigger value="tv" className="flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  TV Shows
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
          </Tabs>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index}
                className="text-center group"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
              <Heart className="w-3 h-3 mr-1" />
              Testimonials
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Loved by Thousands
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index}
                className="group relative overflow-hidden border-0 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-500"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${testimonial.avatar})` }}
                  />
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
              {status === 'loading' ? (
                <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : session?.user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                    <Zap className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signin">
                  <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                    <Zap className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
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