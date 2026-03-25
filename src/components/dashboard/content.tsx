'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Film, Tv, Gamepad2, BookOpen, Sparkles,
  Search, Music, Podcast, MapPin
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-8 lg:p-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Welcome to Your Media Dashboard</h2>
            <p className="text-xl text-muted-foreground">
              Start tracking your favorite movies, TV shows, games, books, and more.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <Link href="/dashboard/movies">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Film className="w-12 h-12 mx-auto mb-4 text-violet-500" />
                  <h3 className="font-semibold text-lg mb-2">Movies</h3>
                  <p className="text-sm text-muted-foreground">Track your favorite films</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/dashboard/tv">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Tv className="w-12 h-12 mx-auto mb-4 text-cyan-500" />
                  <h3 className="font-semibold text-lg mb-2">TV Shows</h3>
                  <p className="text-sm text-muted-foreground">Follow your series</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/dashboard/games">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                  <h3 className="font-semibold text-lg mb-2">Games</h3>
                  <p className="text-sm text-muted-foreground">Manage your gaming library</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/dashboard/books">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                  <h3 className="font-semibold text-lg mb-2">Books</h3>
                  <p className="text-sm text-muted-foreground">Keep track of your reading</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/dashboard/comics">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                  <h3 className="font-semibold text-lg mb-2">Comics</h3>
                  <p className="text-sm text-muted-foreground">Explore comic universes</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/dashboard/boardgames">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-orange-500" />
                  <h3 className="font-semibold text-lg mb-2">Board Games</h3>
                  <p className="text-sm text-muted-foreground">Discover tabletop games</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/soundtracks">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Music className="w-12 h-12 mx-auto mb-4 text-teal-500" />
                  <h3 className="font-semibold text-lg mb-2">Soundtracks</h3>
                  <p className="text-sm text-muted-foreground">Discover music from media</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/podcasts">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Podcast className="w-12 h-12 mx-auto mb-4 text-red-500" />
                  <h3 className="font-semibold text-lg mb-2">Podcasts</h3>
                  <p className="text-sm text-muted-foreground">Follow your favorite shows</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/themeparks">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-lime-500" />
                  <h3 className="font-semibold text-lg mb-2">Theme Parks</h3>
                  <p className="text-sm text-muted-foreground">Plan your park adventures</p>
                </CardContent>
              </Card>
            </Link>
          </div>
          
          <div className="mt-12">
            <Link href="/search">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25">
                <Search className="w-5 h-5 mr-2" />
                Start Exploring
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}