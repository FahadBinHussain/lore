'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Music, Star, Loader2, ArrowRight,
  TrendingUp, Flame, Sparkles, Search, Clock, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface SoundtrackItem {
  id: string;
  title: string;
  artist?: string;
  duration?: string;
  year?: string;
  album?: string;
  genres?: string;
}

export default function SoundtracksPage() {
  const [tracks, setTracks] = useState<SoundtrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SoundtrackItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/soundtracks');
      const data = await response.json();
      setTracks(data.results || []);
    } catch (error) {
      console.error('Failed to fetch soundtracks:', error);
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
        `/api/soundtracks?q=${encodeURIComponent(searchQuery)}`
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

  const displayTracks = searchQuery ? searchResults : tracks;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5" />
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-indigo-500/10 text-indigo-500 border-indigo-500/30">
              <Music className="w-3 h-3 mr-1" />
              Soundtracks
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Soundtracks
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore music from MusicBrainz - search by title, artist, or composer
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search soundtracks by title, artist, or composer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 focus:border-indigo-500/50"
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link href="/dashboard/soundtracks">
              <Button variant="outline" className="rounded-xl">
                <Music className="w-4 h-4 mr-2" />
                Go to My Soundtracks
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Soundtracks Grid */}
      <section className="pb-16">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-muted-foreground">
                {searchResults.length} tracks found
              </p>
            </div>
          )}

          {loading || searching ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="ml-2 text-muted-foreground">
                {searching ? 'Searching...' : 'Loading soundtracks...'}
              </span>
            </div>
          ) : displayTracks.length === 0 ? (
            <div className="text-center py-16">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No soundtracks found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load soundtracks at the moment'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayTracks.map((track) => (
                <Card key={track.id} className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <CardContent className="p-0">
                    <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/20 dark:to-blue-900/20">
                        <Music className="w-16 h-16 text-indigo-500" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {track.title}
                      </h3>
                      {track.artist && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <User className="w-3 h-3" />
                          <span>{track.artist}</span>
                        </div>
                      )}
                      {track.album && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {track.album}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        {track.year && <span>{track.year}</span>}
                        {track.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{track.duration}</span>
                          </div>
                        )}
                      </div>
                      {track.genres && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {track.genres}
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
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}