'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Film, Star, Loader2, ArrowRight, ArrowLeft,
  TrendingUp, Flame, Sparkles, Search,
  Filter, X, Calendar, Award, Play, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

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
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [ratingRange, setRatingRange] = useState([0, 10]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!searchQuery) {
      fetchMovies();
    }
  }, [category, timeWindow, page, genre, year, sortBy, ratingRange, dateFrom, dateTo]);

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    } else {
      // Clear search results when search query is empty
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        page: page.toString(),
      });

      if (category === 'trending') {
        params.append('timeWindow', timeWindow);
      }

      // Add filter parameters
      if (genre) params.append('genre', genre);
      if (year) params.append('year', year);
      if (sortBy) params.append('sortBy', sortBy);
      if (ratingRange[0] > 0) params.append('minRating', ratingRange[0].toString());
      if (ratingRange[1] < 10) params.append('maxRating', ratingRange[1].toString());
      if (dateFrom) params.append('releaseDateFrom', dateFrom);
      if (dateTo) params.append('releaseDateTo', dateTo);

      const response = await fetch(`/api/movies?${params.toString()}`);
      const data = await response.json();
      setMovies(data.results || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch movies:', error);
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

  const clearFilters = () => {
    setGenre('');
    setYear('');
    setSortBy('popularity.desc');
    setRatingRange([0, 10]);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = genre || year || sortBy !== 'popularity.desc' || 
                          ratingRange[0] > 0 || ratingRange[1] < 10 || dateFrom || dateTo;

  const displayMovies = searchQuery ? searchResults : movies;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-8 sm:py-12 lg:py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5" />
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <Badge variant="outline" className="mb-3 sm:mb-4 bg-violet-500/10 text-violet-500 border-violet-500/30">
              <Film className="w-3 h-3 mr-1" />
              Movies
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Movies
              </span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-2 sm:px-0">
              Explore trending and popular movies from TMDB
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-6 sm:mb-8">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 sm:pl-12 h-10 sm:h-12 text-base sm:text-lg"
              />
            </div>
          </form>
        </div>
      </section>

      {/* Content */}
      <section className="pb-16 sm:pb-20 lg:pb-24">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {!searchQuery && (
            <>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <Tabs value={category} onValueChange={(value) => { setCategory(value); setPage(1); }} className="w-full lg:w-auto">
                  <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full lg:w-auto">
                    <TabsTrigger value="trending" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Trending</span>
                    </TabsTrigger>
                    <TabsTrigger value="popular" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Popular</span>
                    </TabsTrigger>
                    <TabsTrigger value="top_rated" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Award className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Top Rated</span>
                    </TabsTrigger>
                    <TabsTrigger value="now_playing" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline lg:hidden xl:inline">Now Playing</span>
                    </TabsTrigger>
                    <TabsTrigger value="upcoming" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline lg:hidden xl:inline">Upcoming</span>
                    </TabsTrigger>
                    <TabsTrigger value="discover" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline lg:hidden xl:inline">Discover</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                  {category === 'trending' && (
                    <Tabs value={timeWindow} onValueChange={setTimeWindow}>
                      <TabsList>
                        <TabsTrigger value="week" className="text-xs sm:text-sm">This Week</TabsTrigger>
                        <TabsTrigger value="day" className="text-xs sm:text-sm">Today</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`${hasActiveFilters ? 'border-primary text-primary' : ''} text-xs sm:text-sm`}
                    size="sm"
                  >
                    <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-xs">
                        !
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <Card className="mb-6">
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="genre">Genre</Label>
                        <Select value={genre} onValueChange={(value) => setGenre(value || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Genres" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Genres</SelectItem>
                            <SelectItem value="28">Action</SelectItem>
                            <SelectItem value="12">Adventure</SelectItem>
                            <SelectItem value="16">Animation</SelectItem>
                            <SelectItem value="35">Comedy</SelectItem>
                            <SelectItem value="80">Crime</SelectItem>
                            <SelectItem value="99">Documentary</SelectItem>
                            <SelectItem value="18">Drama</SelectItem>
                            <SelectItem value="10751">Family</SelectItem>
                            <SelectItem value="14">Fantasy</SelectItem>
                            <SelectItem value="36">History</SelectItem>
                            <SelectItem value="27">Horror</SelectItem>
                            <SelectItem value="10402">Music</SelectItem>
                            <SelectItem value="9648">Mystery</SelectItem>
                            <SelectItem value="10749">Romance</SelectItem>
                            <SelectItem value="878">Science Fiction</SelectItem>
                            <SelectItem value="10770">TV Movie</SelectItem>
                            <SelectItem value="53">Thriller</SelectItem>
                            <SelectItem value="10752">War</SelectItem>
                            <SelectItem value="37">Western</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="year">Year</Label>
                        <Select value={year} onValueChange={(value) => setYear(value || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Years" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Years</SelectItem>
                            {Array.from({ length: 50 }, (_, i) => {
                              const yearValue = (2026 - i).toString();
                              return (
                                <SelectItem key={yearValue} value={yearValue}>
                                  {yearValue}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Rating: {ratingRange[0]} - {ratingRange[1]}</Label>
                        <Slider
                          value={ratingRange}
                          onValueChange={(value) => setRatingRange(Array.isArray(value) ? value : [value, value])}
                          max={10}
                          min={0}
                          step={0.5}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sortBy">Sort By</Label>
                        <Select value={sortBy} onValueChange={(value) => setSortBy(value || 'popularity.desc')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="popularity.desc">Popularity</SelectItem>
                            <SelectItem value="vote_average.desc">Rating</SelectItem>
                            <SelectItem value="release_date.desc">Newest</SelectItem>
                            <SelectItem value="release_date.asc">Oldest</SelectItem>
                            <SelectItem value="title.asc">Title A-Z</SelectItem>
                            <SelectItem value="title.desc">Title Z-A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dateFrom">From Date</Label>
                        <Input
                          id="dateFrom"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dateTo">To Date</Label>
                        <Input
                          id="dateTo"
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <Button variant="outline" onClick={clearFilters} className="flex-1">
                          <X className="w-4 h-4 mr-2" />
                          Clear
                        </Button>
                        <Button onClick={() => setShowFilters(false)} className="flex-1">
                          Apply
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
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
                {displayMovies.map((movie) => {
                  // For search results, the ID is already prefixed, so use it directly
                  // For regular results, add the movie- prefix
                  const linkHref = searchQuery ? `/movies/${movie.id}` : `/movies/movie-${movie.id}`;
                  return (
                    <Link key={movie.id} href={linkHref}>
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
                  );
                })}
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
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Data provided by TMDB. &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}