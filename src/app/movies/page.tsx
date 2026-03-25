'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Film, Star, Loader2, ArrowRight, ArrowLeft,
  TrendingUp, Flame, Sparkles, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

interface MovieItem {
  id: number;
  title: string;
  image: string | null;
  year?: string;
  rating?: number;
  description?: string;
}

export default function MoviesPage() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('trending');
  const [timeWindow, setTimeWindow] = useState('week');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchMovies();
  }, [category, timeWindow, page]);

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/movies?category=${category}&timeWindow=${timeWindow}&page=${page}`
      );
      const data = await response.json();
      setMovies(data.results || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch movies:', error);
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
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=movie`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const displayMovies = searchQuery ? searchResults : movies;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">Lore</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link href="/movies" className="text-sm font-medium text-primary">
                Movies
              </Link>
              <Link href="/tv" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                TV Shows
              </Link>
              <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/auth/signin">
                <Button variant="ghost" className="text-sm">Sign In</Button>
              </Link>
              <Link href="/auth/signin">
                <Button className="bg-gradient-to-r from-primary to-primary/90">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-violet-500/10 text-violet-500 border-violet-500/30">
              <Film className="w-3 h-3 mr-1" />
              Movies
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Movies
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore trending and popular movies from TMDB
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search movies..."
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
          ) : displayMovies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayMovies.map((movie) => (
                  <Link key={movie.id} href={`/movies/${movie.id}`}>
                    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
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
              <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Movies Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load movies at this time.'}
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