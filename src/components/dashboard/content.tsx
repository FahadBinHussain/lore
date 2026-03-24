'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Film, Tv, Gamepad2, BookOpen, Sparkles,
  TrendingUp, Clock, CheckCircle, Target,
  ArrowRight, Play, Star, Zap, Globe,
  ChevronRight, Flame, Rocket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const stats = [
  { name: 'Movies', value: 12, total: 156, icon: Film, color: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/25' },
  { name: 'TV Shows', value: 8, total: 89, icon: Tv, color: 'from-cyan-500 to-blue-600', glow: 'shadow-cyan-500/25' },
  { name: 'Games', value: 5, total: 42, icon: Gamepad2, color: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/25' },
  { name: 'Books', value: 3, total: 67, icon: BookOpen, color: 'from-emerald-500 to-green-600', glow: 'shadow-emerald-500/25' },
];

const featuredUniverses = [
  { 
    id: 1, 
    name: 'Marvel Cinematic Universe', 
    progress: 75, 
    total: 32,
    completed: 24,
    cover: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600',
    gradient: 'from-red-500 via-orange-500 to-yellow-500'
  },
  { 
    id: 2, 
    name: 'The Witcher Universe', 
    progress: 45, 
    total: 12,
    completed: 5,
    cover: 'https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?w=600',
    gradient: 'from-slate-600 via-zinc-500 to-stone-600'
  },
];

const trendingItems = [
  { type: 'movie', title: 'Oppenheimer', rating: 8.9, year: 2023, image: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400' },
  { type: 'tv', title: 'Shogun', rating: 9.1, year: 2024, image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400' },
  { type: 'game', title: 'Baldur\'s Gate 3', rating: 9.7, year: 2023, image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400' },
  { type: 'book', title: 'Fourth Wing', rating: 4.5, year: 2023, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400' },
];

const recentActivity = [
  { type: 'movie', title: 'Inception', action: 'completed', date: '2 hours ago', progress: 100 },
  { type: 'tv', title: 'The Last of Us', action: 'watched S1E3', date: '1 day ago', progress: 30 },
  { type: 'game', title: 'Elden Ring', action: 'started', date: '2 days ago', progress: 15 },
  { type: 'book', title: 'Dune', action: '75% read', date: '3 days ago', progress: 75 },
];

export function DashboardContent() {
  const [greeting, setGreeting] = useState('Hello');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const totalProgress = stats.reduce((acc, stat) => acc + stat.value, 0);
  const totalItems = stats.reduce((acc, stat) => acc + stat.total, 0);
  const overallProgress = Math.round((totalProgress / totalItems) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full blur-2xl animate-pulse delay-1000" />
        
        <div className="relative p-8 lg:p-12">
          {/* Header */}
          <div className={cn(
            "flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all duration-1000",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-bounce" />
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary border-primary/20">
                  <Zap className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  {greeting}
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Track your journey through movies, shows, games, and books
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/search">
                <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                  <Rocket className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                  Discover Media
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/universes">
                <Button variant="outline" size="lg" className="group border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300">
                  <Globe className="w-5 h-5 mr-2 group-hover:rotate-45 transition-transform" />
                  Explore Universes
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 lg:p-12 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card 
              key={stat.name} 
              className={cn(
                "group relative overflow-hidden border-0 bg-card/50 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl",
                stat.glow,
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5", stat.color)} />
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-3 rounded-2xl bg-gradient-to-br shadow-lg", stat.color)}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">of {stat.total}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stat.name}</span>
                    <span className="text-muted-foreground">{Math.round((stat.value / stat.total) * 100)}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={(stat.value / stat.total) * 100} className="h-2" />
                    <div className={cn("absolute inset-0 bg-gradient-to-r opacity-30 rounded-full", stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Featured Universes */}
          <div className="xl:col-span-2 space-y-6">
            {/* Overall Progress */}
            <Card className="group overflow-hidden border-0 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    Overall Progress
                  </CardTitle>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {overallProgress}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Progress value={overallProgress} className="h-4 rounded-full" />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent rounded-full" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {totalProgress} of {totalItems} items tracked
                    </span>
                    <Link href="/search">
                      <Button variant="ghost" size="sm" className="group text-primary hover:text-primary">
                        View All
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Featured Universes */}
            <Card className="overflow-hidden border-0 bg-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                    </div>
                    Universes
                  </CardTitle>
                  <Link href="/universes">
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                      View All
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuredUniverses.map((universe, index) => (
                  <div 
                    key={universe.id} 
                    className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-muted/50 to-muted/30 p-1 transition-all duration-500 hover:shadow-lg"
                    style={{ animationDelay: `${index * 200}ms` }}
                  >
                    <div className="flex items-center gap-4 p-4 rounded-xl">
                      <div 
                        className="relative w-20 h-28 rounded-xl bg-cover bg-center flex-shrink-0 overflow-hidden shadow-lg"
                        style={{ backgroundImage: `url(${universe.cover})` }}
                      >
                        <div className={cn("absolute inset-0 bg-gradient-to-t opacity-60", universe.gradient)} />
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-white rounded-full transition-all duration-1000"
                              style={{ width: `${universe.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h4 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                          {universe.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {universe.completed} of {universe.total} items completed
                        </p>
                        <div className="flex items-center gap-2">
                          <Progress value={universe.progress} className="flex-1 h-2" />
                          <span className="text-sm font-semibold text-primary">{universe.progress}%</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Trending Now */}
            <Card className="overflow-hidden border-0 bg-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-pink-500/20">
                      <Flame className="w-5 h-5 text-red-500" />
                    </div>
                    Trending Now
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {trendingItems.map((item, index) => (
                    <div 
                      key={index}
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-transparent to-black/50 aspect-[3/4] cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                        style={{ backgroundImage: `url(${item.image})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-white/20 text-white border-0">
                            {item.type === 'movie' ? <Film className="w-3 h-3 mr-1" /> :
                             item.type === 'tv' ? <Tv className="w-3 h-3 mr-1" /> :
                             item.type === 'game' ? <Gamepad2 className="w-3 h-3 mr-1" /> :
                             <BookOpen className="w-3 h-3 mr-1" />}
                            {item.type}
                          </Badge>
                          <div className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs font-medium">{item.rating}</span>
                          </div>
                        </div>
                        <h4 className="font-semibold text-white truncate">{item.title}</h4>
                        <p className="text-xs text-white/70">{item.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity & Quick Stats */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'In Progress', value: 8, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { label: 'Completed', value: 28, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
                  { label: 'Universes', value: 3, icon: Globe, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                ].map((stat, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={cn("p-2 rounded-lg", stat.bg)}>
                      <stat.icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="overflow-hidden border-0 bg-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                    <Clock className="w-5 h-5 text-emerald-500" />
                  </div>
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div 
                      key={index} 
                      className="group flex items-start gap-3 p-3 rounded-xl hover:bg-muted/30 transition-all duration-300 cursor-pointer"
                    >
                      <div className={cn(
                        "p-2 rounded-xl flex-shrink-0 transition-transform group-hover:scale-110",
                        activity.type === 'movie' ? 'bg-violet-500/10' :
                        activity.type === 'tv' ? 'bg-cyan-500/10' :
                        activity.type === 'game' ? 'bg-amber-500/10' :
                        'bg-emerald-500/10'
                      )}>
                        {activity.type === 'movie' ? <Film className="w-4 h-4 text-violet-500" /> :
                         activity.type === 'tv' ? <Tv className="w-4 h-4 text-cyan-500" /> :
                         activity.type === 'game' ? <Gamepad2 className="w-4 h-4 text-amber-500" /> :
                         <BookOpen className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="font-medium truncate group-hover:text-primary transition-colors">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.action} • {activity.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                activity.type === 'movie' ? 'bg-violet-500' :
                                activity.type === 'tv' ? 'bg-cyan-500' :
                                activity.type === 'game' ? 'bg-amber-500' :
                                'bg-emerald-500'
                              )}
                              style={{ width: `${activity.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{activity.progress}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-xl">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                    <Rocket className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Start Your Journey</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Discover new media to track and explore
                    </p>
                  </div>
                  <Link href="/search">
                    <Button className="w-full bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25">
                      <Play className="w-4 h-4 mr-2" />
                      Explore Now
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}