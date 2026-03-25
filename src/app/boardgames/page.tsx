'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Gamepad2, Star, Loader2, ArrowRight,
  TrendingUp, Flame, Sparkles, Search, Users, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface BoardGameItem {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  players?: string;
  playtime?: string;
  categories?: string;
  mechanics?: string;
  designers?: string;
  publishers?: string;
  description?: string;
}

export default function BoardGamesPage() {
  const [games, setGames] = useState<BoardGameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BoardGameItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/boardgames');
      const data = await response.json();

      setGames(data.results || []);
    } catch (error) {
      console.error('Failed to fetch board games:', error);
      setError('Failed to load board games');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/boardgames?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const displayGames = searchQuery ? searchResults : games;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-orange-500/10 text-orange-500 border-orange-500/30">
              <Gamepad2 className="w-3 h-3 mr-1" />
              Board Games
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Board Games
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore board games from BoardGameGeek - search by title, designer, or category
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search board games by title, designer, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 focus:border-orange-500/50"
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link href="/dashboard/boardgames">
              <Button variant="outline" className="rounded-xl">
                <Gamepad2 className="w-4 h-4 mr-2" />
                Go to My Board Games
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Board Games Grid */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-muted-foreground">
                {searchResults.length} board games found
              </p>
            </div>
          )}

          {loading || searching ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span className="ml-2 text-muted-foreground">
                {searching ? 'Searching...' : 'Loading board games...'}
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">Unable to load board games</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchGames} variant="outline">
                Try Again
              </Button>
            </div>
          ) : displayGames.length === 0 ? (
            <div className="text-center py-16">
              <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No board games found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load board games at the moment'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayGames.map((game) => (
                <Card key={game.id} className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <CardContent className="p-0">
                    <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg bg-muted">
                      {game.image ? (
                        <img
                          src={game.image}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/20 dark:to-red-900/20">
                          <Gamepad2 className="w-12 h-12 text-orange-500" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-orange-600 transition-colors">
                        {game.title}
                      </h3>
                      {game.designers && (
                        <p className="text-sm text-muted-foreground mb-2">
                          by {game.designers}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        {game.year && <span>{game.year}</span>}
                        {game.players && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{game.players}</span>
                          </div>
                        )}
                      </div>
                      {game.playtime && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          <span>{game.playtime}</span>
                        </div>
                      )}
                      {game.categories && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {game.categories}
                        </p>
                      )}
                      {game.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {game.description}
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