'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin, Star, Loader2, ArrowRight,
  TrendingUp, Flame, Sparkles, Search, Clock, Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface ThemeParkItem {
  id: string;
  title: string;
  image: string | null;
  location?: string;
  description?: string;
  waitTime?: number;
  status?: string;
  latitude?: number;
  longitude?: number;
}

export default function ThemeParksPage() {
  const [attractions, setAttractions] = useState<ThemeParkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ThemeParkItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchAttractions();
  }, []);

  const fetchAttractions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/themeparks');
      const data = await response.json();
      setAttractions(data.results || []);
    } catch (error) {
      console.error('Failed to fetch attractions:', error);
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
        `/api/themeparks?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const displayAttractions = searchQuery ? searchResults : attractions;

  const getWaitTimeColor = (waitTime?: number) => {
    if (!waitTime) return 'text-muted-foreground';
    if (waitTime < 30) return 'text-green-500';
    if (waitTime < 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-500';
    switch (status.toLowerCase()) {
      case 'operating': return 'bg-green-500';
      case 'closed': return 'bg-red-500';
      case 'down': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-pink-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-rose-500/10 text-rose-500 border-rose-500/30">
              <MapPin className="w-3 h-3 mr-1" />
              Theme Parks
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Theme Park Attractions
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore theme park attractions from Themeparks.wiki - search by ride name, park, or location
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search attractions by name, park, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 focus:border-rose-500/50"
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link href="/dashboard/themeparks">
              <Button variant="outline" className="rounded-xl">
                <MapPin className="w-4 h-4 mr-2" />
                Go to My Attractions
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Attractions Grid */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-muted-foreground">
                {searchResults.length} attractions found
              </p>
            </div>
          )}

          {loading || searching ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <span className="ml-2 text-muted-foreground">
                {searching ? 'Searching...' : 'Loading attractions...'}
              </span>
            </div>
          ) : displayAttractions.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No attractions found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load attractions at the moment'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayAttractions.map((attraction) => (
                <Card key={attraction.id} className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <CardContent className="p-0">
                    <div className="aspect-[4/3] relative overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/20 dark:to-pink-900/20">
                        <MapPin className="w-16 h-16 text-rose-500" />
                      </div>
                      {/* Status indicator */}
                      {attraction.status && (
                        <div className="absolute top-2 left-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(attraction.status)}`} />
                        </div>
                      )}
                      {/* Wait time */}
                      {attraction.waitTime && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className={getWaitTimeColor(attraction.waitTime)}>
                            {attraction.waitTime}m
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-rose-600 transition-colors">
                        {attraction.title}
                      </h3>
                      {attraction.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <Navigation className="w-3 h-3" />
                          <span>{attraction.location}</span>
                        </div>
                      )}
                      {attraction.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {attraction.description}
                        </p>
                      )}
                      {/* Coordinates for geolocation features */}
                      {attraction.latitude && attraction.longitude && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {attraction.latitude.toFixed(4)}, {attraction.longitude.toFixed(4)}
                        </div>
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