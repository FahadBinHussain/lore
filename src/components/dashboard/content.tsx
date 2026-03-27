'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Film, Tv, Gamepad2, BookOpen,
  Music, Podcast, MapPin, Zap, Upload
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImportModal } from './import-modal';

const categories = [
  { name: 'Movies', href: '/dashboard/movies', icon: Film, color: 'text-violet-500', description: 'Track your favorite films' },
  { name: 'TV Shows', href: '/dashboard/tv', icon: Tv, color: 'text-cyan-500', description: 'Follow your series' },
  { name: 'Anime', href: '/dashboard/anime', icon: Zap, color: 'text-pink-500', description: 'Discover anime' },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, color: 'text-amber-500', description: 'Track your games' },
  { name: 'Books', href: '/dashboard/books', icon: BookOpen, color: 'text-emerald-500', description: 'Track your reading' },
  { name: 'Comics', href: '/dashboard/comics', icon: Sparkles, color: 'text-purple-500', description: 'Follow your comics' },
  { name: 'Board Games', href: '/dashboard/boardgames', icon: Gamepad2, color: 'text-orange-500', description: 'Track tabletop games' },
  { name: 'Soundtracks', href: '/dashboard/soundtracks', icon: Music, color: 'text-teal-500', description: 'Discover music' },
  { name: 'Podcasts', href: '/dashboard/podcasts', icon: Podcast, color: 'text-red-500', description: 'Follow podcasts' },
  { name: 'Theme Parks', href: '/dashboard/themeparks', icon: MapPin, color: 'text-lime-500', description: 'Plan your visits' },
];

export function DashboardContent() {
  const [greeting, setGreeting] = useState('Hello');
  const [mounted, setMounted] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const handleImport = async (selectedItems: any[]) => {
    try {
      for (const item of selectedItems) {
        if (!item.tmdbData) continue;

        const isMovie = item.type === 'movie';
        const externalId = isMovie ? item.movie.ids.tmdb.toString() : item.show.ids.tmdb.toString();
        const mediaType = isMovie ? 'movie' : 'tv';

        // Ensure media item exists
        const ensureResponse = await fetch('/api/media/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalId,
            mediaType,
            title: item.tmdbData.title,
            posterPath: item.tmdbData.poster_path,
            backdropPath: item.tmdbData.backdrop_path,
            releaseDate: item.tmdbData.release_date,
            rating: item.tmdbData.vote_average,
            description: item.tmdbData.overview,
            genres: item.tmdbData.genres?.map((g: any) => g.name) || [],
            runtime: item.tmdbData.runtime,
            tagline: item.tmdbData.tagline,
            popularity: item.tmdbData.popularity,
            source: 'tmdb',
          }),
        });

        if (!ensureResponse.ok) {
          console.error('Failed to ensure media item for', item.tmdbData.title);
          continue;
        }

        const { id: mediaItemId } = await ensureResponse.json();

        // Add to user progress
        const progressResponse = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaItemId,
            status: 'completed',
            currentProgress: 0, // No progress tracking for imported items
            completedAt: item.watched_at,
          }),
        });

        if (!progressResponse.ok) {
          console.error('Failed to add progress for', item.tmdbData.title);
        }
      }

      // Refresh the page or update state to show imported items
      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import some items. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">{greeting}!</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Welcome to your media tracking dashboard. Select a category below to get started.
            </p>
          </div>

          {/* Import Section */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-secondary/5 rounded-lg p-4 border border-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Import Your Media</h3>
                <p className="text-sm text-muted-foreground">
                  Import your watched movies from Trakt.tv or other services.
                </p>
              </div>
              <Button onClick={() => setImportModalOpen(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import Data
              </Button>
            </div>
          </div>

          {/* Category Navigation */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Media Categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Link key={category.href} href={category.href}>
                    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer h-full">
                      <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ${category.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{category.name}</h3>
                          <p className="text-xs text-muted-foreground">{category.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
