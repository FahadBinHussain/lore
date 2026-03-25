'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Tv, Star, Loader2, ArrowRight, ArrowLeft,
  TrendingUp, Flame, Sparkles, Search, Monitor,
  Filter, X, Calendar, Award, Play, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

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
      fetchShows();
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

  const fetchShows = async () => {
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
      if (dateFrom) params.append('firstAirDateFrom', dateFrom);
      if (dateTo) params.append('firstAirDateTo', dateTo);

      const response = await fetch(`/api/tv?${params.toString()}`);
      const data = await response.json();
      setShows(data.results || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch TV shows:', error);
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

  const displayShows = searchQuery ? searchResults : shows;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
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
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {!searchQuery && (
            <>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <Tabs value={category} onValueChange={(value) => { setCategory(value); setPage(1); }}>
                  <TabsList className="grid grid-cols-3 lg:grid-cols-6">
                    <TabsTrigger value="trending" className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Trending</span>
                    </TabsTrigger>
                    <TabsTrigger value="popular" className="flex items-center gap-2">
                      <Flame className="w-4 h-4" />
                      <span className="hidden sm:inline">Popular</span>
                    </TabsTrigger>
                    <TabsTrigger value="top_rated" className="flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      <span className="hidden sm:inline">Top Rated</span>
                    </TabsTrigger>
                    <TabsTrigger value="on_the_air" className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      <span className="hidden sm:inline">On Air</span>
                    </TabsTrigger>
                    <TabsTrigger value="airing_today" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="hidden sm:inline">Today</span>
                    </TabsTrigger>
                    <TabsTrigger value="discover" className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">Discover</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                  {category === 'trending' && (
                    <Tabs value={timeWindow} onValueChange={setTimeWindow}>
                      <TabsList>
                        <TabsTrigger value="week">This Week</TabsTrigger>
                        <TabsTrigger value="day">Today</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className={hasActiveFilters ? 'border-primary text-primary' : ''}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        !
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <Card className="mb-6">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="genre">Genre</Label>
                        <Select value={genre} onValueChange={(value) => setGenre(value || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Genres" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Genres</SelectItem>
                            <SelectItem value="10759">Action & Adventure</SelectItem>
                            <SelectItem value="16">Animation</SelectItem>
                            <SelectItem value="35">Comedy</SelectItem>
                            <SelectItem value="80">Crime</SelectItem>
                            <SelectItem value="99">Documentary</SelectItem>
                            <SelectItem value="18">Drama</SelectItem>
                            <SelectItem value="10751">Family</SelectItem>
                            <SelectItem value="10762">Kids</SelectItem>
                            <SelectItem value="9648">Mystery</SelectItem>
                            <SelectItem value="10763">News</SelectItem>
                            <SelectItem value="10764">Reality</SelectItem>
                            <SelectItem value="10765">Sci-Fi & Fantasy</SelectItem>
                            <SelectItem value="10766">Soap</SelectItem>
                            <SelectItem value="10767">Talk</SelectItem>
                            <SelectItem value="10768">War & Politics</SelectItem>
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
                            <SelectItem value="first_air_date.desc">Newest</SelectItem>
                            <SelectItem value="first_air_date.asc">Oldest</SelectItem>
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
          ) : displayShows.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayShows.map((show) => {
                  // For search results, the ID is already prefixed, so use it directly
                  // For regular results, add the tv- prefix
                  const linkHref = searchQuery ? `/tv/${show.id}` : `/tv/tv-${show.id}`;
                  return (
                    <Link key={show.id} href={linkHref}>
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
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Data provided by TMDB. &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}