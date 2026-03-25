'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Tv, Star, Loader2, ArrowRight, ArrowLeft,
  TrendingUp, Flame, Sparkles, Search, Monitor
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

interface TVShowItem {
  id: number;
  title: string;
  image: string | null;
  year?: string;
  rating?: number;
  description?: string;
  seasons?: number;
  episodes?: number;
}

export default function TVPage() {
  const [shows, setShows] = useState<TVShowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('trending');
  const [timeWindow, setTimeWindow] = useState('week');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TVShowItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchShows();
  }, [category, timeWindow, page]);

  const fetchShows = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tv?category=${category}&timeWindow=${timeWindow}&page=${page}`
      );
      const data = await response.json();
      setShows(data.results || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch TV shows:', error);
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
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=tv`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const displayShows = searchQuery ? searchResults : shows;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-cyan-500/10 text-cyan-500 border-cyan-500/30">
              <Tv className="w-3 h-3 mr-1" />
              TV Shows
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover TV Shows
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore trending and popular TV series from TMDB
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search TV shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-lg"
              />
            </div>
          </form>
        </div>
      </section>

      {/* Content */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {!searchQuery && (
            <Tabs value={category} onValueChange={setCategory} className="mb-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="trending" className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Trending
                  </TabsTrigger>
                  <TabsTrigger value="popular" className="flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    Popular
                  </TabsTrigger>
                </TabsList>

                {category === 'trending' && (
                  <TabsList>
                    <TabsTrigger value="week" onClick={() => setTimeWindow('week')}>
                      This Week
                    </TabsTrigger>
                    <TabsTrigger value="day" onClick={() => setTimeWindow('day')}>
                      Today
                    </TabsTrigger>
                  </TabsList>
                )}
              </div>
            </Tabs>
          )}

          {searchQuery && (
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Search Results</h2>
                <p className="text-muted-foreground">
                  {searchResults.length} results for &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            </div>
          )}

          {loading || searching ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : displayShows.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayShows.map((show) => (
                  <Link key={show.id} href={`/tv/${show.id}`}>
                    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
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

              {/* Pagination */}
              {!searchQuery && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-12">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="p-12 text-center">
              <Tv className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No TV Shows Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load TV shows at this time.'}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Data provided by TMDB. &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}