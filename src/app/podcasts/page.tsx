'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Podcast, Star, Loader2, ArrowRight,
  TrendingUp, Flame, Sparkles, Search, Radio, Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface PodcastItem {
  id: string;
  title: string;
  image: string | null;
  publisher?: string;
  totalEpisodes?: number;
  description?: string;
  rating?: number;
}

export default function PodcastsPage() {
  const [podcasts, setPodcasts] = useState<PodcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const fetchPodcasts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/podcasts');
      const data = await response.json();
      setPodcasts(data.results || []);
    } catch (error) {
      console.error('Failed to fetch podcasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `/api/podcasts?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const displayPodcasts = searchQuery ? searchResults : podcasts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-cyan-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-teal-500/10 text-teal-500 border-teal-500/30">
              <Podcast className="w-3 h-3 mr-1" />
              Podcasts
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Podcasts
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore podcasts from Listen Notes - search by title, topic, or creator
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search podcasts by title, topic, or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 focus:border-teal-500/50"
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link href="/dashboard/podcasts">
              <Button variant="outline" className="rounded-xl">
                <Headphones className="w-4 h-4 mr-2" />
                Go to My Podcasts
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Podcasts Grid */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-muted-foreground">
                {searchResults.length} podcasts found
              </p>
            </div>
          )}

          {loading || searching ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              <span className="ml-2 text-muted-foreground">
                {searching ? 'Searching...' : 'Loading podcasts...'}
              </span>
            </div>
          ) : displayPodcasts.length === 0 ? (
            <div className="text-center py-16">
              <Podcast className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No podcasts found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load podcasts at the moment'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayPodcasts.map((podcast) => (
                <Card key={podcast.id} className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <CardContent className="p-0">
                    <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                      {podcast.image ? (
                        <img
                          src={podcast.image}
                          alt={podcast.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/20 dark:to-cyan-900/20">
                          <Podcast className="w-16 h-16 text-teal-500" />
                        </div>
                      )}
                      {podcast.rating && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {podcast.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-teal-600 transition-colors">
                        {podcast.title}
                      </h3>
                      {podcast.publisher && (
                        <p className="text-sm text-muted-foreground mb-2">
                          by {podcast.publisher}
                        </p>
                      )}
                      {podcast.totalEpisodes && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <Radio className="w-3 h-3" />
                          <span>{podcast.totalEpisodes} episodes</span>
                        </div>
                      )}
                      {podcast.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {podcast.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}