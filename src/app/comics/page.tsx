'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, Star, Loader2, ArrowRight,
  TrendingUp, Flame, Sparkles, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface ComicItem {
  id: number;
  title: string;
  image: string | null;
  year?: string;
  issue?: string;
  volume?: string;
  description?: string;
  creators?: string;
}

export default function ComicsPage() {
  const [comics, setComics] = useState<ComicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ComicItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchComics();
  }, []);

  const fetchComics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/comics');
      const data = await response.json();
      setComics(data.results || []);
    } catch (error) {
      console.error('Failed to fetch comics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `/api/comics?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const displayComics = searchQuery ? searchResults : comics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-purple-500/10 text-purple-500 border-purple-500/30">
              <BookOpen className="w-3 h-3 mr-1" />
              Comics
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Comics
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore comics from Comic Vine - search by title, character, or creator
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search comics by title, character, or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 focus:border-purple-500/50"
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link href="/dashboard/comics">
              <Button variant="outline" className="rounded-xl">
                <BookOpen className="w-4 h-4 mr-2" />
                Go to My Comics
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Comics Grid */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-muted-foreground">
                {searchResults.length} comics found
              </p>
            </div>
          )}

          {loading || searching ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="ml-2 text-muted-foreground">
                {searching ? 'Searching...' : 'Loading comics...'}
              </span>
            </div>
          ) : displayComics.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No comics found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load comics at the moment'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayComics.map((comic) => (
                <Card key={comic.id} className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <CardContent className="p-0">
                    <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg bg-muted">
                      {comic.image ? (
                        <img
                          src={comic.image}
                          alt={comic.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20">
                          <BookOpen className="w-12 h-12 text-purple-500" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                        {comic.title}
                      </h3>
                      {comic.volume && (
                        <p className="text-sm text-muted-foreground mb-1">
                          {comic.volume}
                        </p>
                      )}
                      {comic.issue && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Issue #{comic.issue}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        {comic.year && <span>{comic.year}</span>}
                      </div>
                      {comic.creators && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {comic.creators}
                        </p>
                      )}
                      {comic.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {comic.description.replace(/<[^>]*>/g, '')}
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