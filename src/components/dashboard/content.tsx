'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, Sparkles, TrendingUp, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{greeting}!</h1>
            <p className="text-muted-foreground">
              Welcome to your media tracking dashboard. Use the sidebar to navigate between categories.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/search">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="w-5 h-5 text-primary" />
                    Search Media
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Discover new movies, shows, games, and more across all categories.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/universes">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Universes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Explore and create connected universes across your media.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Select a category from the sidebar to start tracking your favorite media.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Use the <strong>Sidebar</strong> to quickly navigate between Movies, TV Shows, Games, Books, and more.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Visit <strong>Search</strong> to find and add new media to your collection.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Create <strong>Universes</strong> to connect related media across different categories.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
