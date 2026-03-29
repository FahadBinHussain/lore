'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Zap, Star, Loader2, ArrowRight, ArrowLeft,
  TrendingUp, Flame, Sparkles, Search,
  Award, Play, Clock, Filter, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface AnimeItem {
  id: number;
  title: string;
  image: string | null;
  year: string;
  rating: number | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  format: string;
  status: string;
  genres: string[];
  banner: string | null;
  studios: string[];
  trailer: {
    id: string;
    site: string;
    thumbnail: string | null;
  } | null;
  season: string | null;
  seasonYear: number | null;
  popularity: number | null;
  favourites: number | null;
  nextEpisode: {
    airingAt: number;
    episode: number;
    timeUntilAiring: number;
  } | null;
}

export default function AnimePage() {
  const [anime, setAnime] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('trending');
  const [timeWindow, setTimeWindow] = useState('week');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [sortBy, setSortBy] = useState('POPULARITY_DESC');
  const [ratingRange, setRatingRange] = useState([0, 100]);
  const [format, setFormat] = useState('');
  const [status, setStatus] = useState('');
  const [season, setSeason] = useState('');

  useEffect(() => {
    if (!searchQuery) {
      fetchAnime();
    }
  }, [category, timeWindow, page, genre, year, sortBy, ratingRange, format, status, season]);

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchAnime = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        timeWindow,
        page: page.toString(),
      });

      // Add filter parameters
      if (genre) params.append('genre', genre);
      if (year) params.append('year', year);
      if (sortBy) params.append('sortBy', sortBy);
      if (ratingRange[0] > 0) params.append('minRating', ratingRange[0].toString());
      if (ratingRange[1] < 100) params.append('maxRating', ratingRange[1].toString());
      if (format) params.append('format', format);
      if (status) params.append('status', status);
      if (season) params.append('season', season);

      const response = await fetch(`/api/anime?${params.toString()}`);
      const data = await response.json();
      setAnime(data.results || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch anime:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `/api/anime?search=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const displayAnime = searchQuery ? searchResults : anime;
  
  const clearFilters = () => {
    setGenre('');
    setYear('');
    setSortBy('POPULARITY_DESC');
    setRatingRange([0, 100]);
    setFormat('');
    setStatus('');
    setSeason('');
    setPage(1);
  };

  const hasActiveFilters = genre || year || sortBy !== 'POPULARITY_DESC' || 
                          ratingRange[0] > 0 || ratingRange[1] < 100 || format || status || season;

  const getFormatBadge = (format: string) => {
    switch (format) {
      case 'TV': return 'TV';
      case 'TV_SHORT': return 'TV Short';
      case 'MOVIE': return 'Movie';
      case 'SPECIAL': return 'Special';
      case 'OVA': return 'OVA';
      case 'ONA': return 'ONA';
      default: return format;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-purple-500/5" />
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-pink-500/10 text-pink-500 border-pink-500/30">
              <Zap className="w-3 h-3 mr-1" />
              Anime
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Anime
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powered by AniList • Explore trending, popular, and upcoming anime
            </p>
          </div>

          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search anime (e.g., Death Note, Attack on Titan)..."
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
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <Tabs value={category} onValueChange={(value) => { setCategory(value); setPage(1); }} className="w-full lg:w-auto">
                  <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <TabsList className="inline-flex min-w-max h-auto items-center gap-1 rounded-xl p-1">
                        <TabsTrigger value="trending" className="shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-3">
                          <TrendingUp className="w-4 h-4" />
                          <span className="hidden sm:inline">Trending</span>
                        </TabsTrigger>
                        <TabsTrigger value="popular" className="shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-3">
                          <Flame className="w-4 h-4" />
                          <span className="hidden sm:inline">Popular</span>
                        </TabsTrigger>
                        <TabsTrigger value="top_rated" className="shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-3">
                          <Award className="w-4 h-4" />
                          <span className="hidden sm:inline">Top Rated</span>
                        </TabsTrigger>
                        <TabsTrigger value="now_playing" className="shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-3">
                          <Play className="w-4 h-4" />
                          <span className="hidden sm:inline lg:hidden xl:inline">Now Playing</span>
                        </TabsTrigger>
                        <TabsTrigger value="upcoming" className="shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-3">
                          <Clock className="w-4 h-4" />
                          <span className="hidden sm:inline lg:hidden xl:inline">Upcoming</span>
                        </TabsTrigger>
                        <TabsTrigger value="discover" className="shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-3">
                          <Sparkles className="w-4 h-4" />
                          <span className="hidden sm:inline lg:hidden xl:inline">Discover</span>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>
                </Tabs>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                  {category === 'trending' && (
                    <Tabs value={timeWindow} onValueChange={setTimeWindow}>
                      <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <TabsList className="inline-flex min-w-max">
                          <TabsTrigger value="week" className="shrink-0 text-xs sm:text-sm">This Week</TabsTrigger>
                          <TabsTrigger value="day" className="shrink-0 text-xs sm:text-sm">Today</TabsTrigger>
                        </TabsList>
                      </div>
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
                            <SelectItem value="Action">Action</SelectItem>
                            <SelectItem value="Adventure">Adventure</SelectItem>
                            <SelectItem value="Comedy">Comedy</SelectItem>
                            <SelectItem value="Drama">Drama</SelectItem>
                            <SelectItem value="Fantasy">Fantasy</SelectItem>
                            <SelectItem value="Horror">Horror</SelectItem>
                            <SelectItem value="Mystery">Mystery</SelectItem>
                            <SelectItem value="Romance">Romance</SelectItem>
                            <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                            <SelectItem value="Slice of Life">Slice of Life</SelectItem>
                            <SelectItem value="Sports">Sports</SelectItem>
                            <SelectItem value="Supernatural">Supernatural</SelectItem>
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
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sortBy">Sort By</Label>
                        <Select value={sortBy} onValueChange={(value) => setSortBy(value || 'POPULARITY_DESC')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="POPULARITY_DESC">Popularity</SelectItem>
                            <SelectItem value="SCORE_DESC">Rating</SelectItem>
                            <SelectItem value="TRENDING_DESC">Trending</SelectItem>
                            <SelectItem value="START_DATE_DESC">Newest</SelectItem>
                            <SelectItem value="START_DATE">Oldest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="format">Format</Label>
                        <Select value={format} onValueChange={(value) => setFormat(value || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Formats" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Formats</SelectItem>
                            <SelectItem value="TV">TV</SelectItem>
                            <SelectItem value="TV_SHORT">TV Short</SelectItem>
                            <SelectItem value="MOVIE">Movie</SelectItem>
                            <SelectItem value="SPECIAL">Special</SelectItem>
                            <SelectItem value="OVA">OVA</SelectItem>
                            <SelectItem value="ONA">ONA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={status} onValueChange={(value) => setStatus(value || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Statuses</SelectItem>
                            <SelectItem value="RELEASING">Airing</SelectItem>
                            <SelectItem value="FINISHED">Finished</SelectItem>
                            <SelectItem value="NOT_YET_RELEASED">Upcoming</SelectItem>
                            <SelectItem value="HIATUS">Hiatus</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="season">Season</Label>
                        <Select value={season} onValueChange={(value) => setSeason(value || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="Any Season" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Any Season</SelectItem>
                            <SelectItem value="WINTER">Winter</SelectItem>
                            <SelectItem value="SPRING">Spring</SelectItem>
                            <SelectItem value="SUMMER">Summer</SelectItem>
                            <SelectItem value="FALL">Fall</SelectItem>
                          </SelectContent>
                        </Select>
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
          ) : displayAnime.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayAnime.map((show) => (
                  <Link key={show.id} href={`/anime/${show.id}`}>
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
                            <Zap className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        {show.rating && (
                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {show.rating / 10}
                          </div>
                        )}
                        {show.format && (
                          <div className="absolute top-2 left-2 bg-pink-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium">
                            {getFormatBadge(show.format)}
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-sm truncate">{show.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {show.year && (
                            <p className="text-xs text-muted-foreground">{show.year}</p>
                          )}
                          {show.episodes && (
                            <p className="text-xs text-muted-foreground">
                              {show.episodes} ep{show.episodes !== 1 ? 's' : ''}
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
              <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Anime Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load anime at this time.'}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Data provided by AniList. &copy; 2026 Lore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
