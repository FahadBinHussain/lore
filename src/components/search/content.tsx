'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Film, Tv, Gamepad2, BookOpen, Loader2, Puzzle, ScrollText, Mic, Music, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'game' | 'book' | 'boardgame' | 'comic' | 'podcast' | 'soundtrack' | 'themepark';
  image?: string;
  year?: string;
  rating?: number;
  description?: string;
}

export function SearchContent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Debounced search effect
  useEffect(() => {
    if (query.trim()) {
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    } else {
      // Clear results when query is empty
      setResults([]);
    }
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'movie':
        router.push(`/movies/${result.id}`);
        break;
      case 'tv':
        router.push(`/tv/${result.id}`);
        break;
      case 'game':
        router.push('/games');
        break;
      case 'book':
        router.push('/books');
        break;
      case 'boardgame':
        router.push('/boardgames');
        break;
      case 'comic':
        router.push('/comics');
        break;
      case 'podcast':
        router.push('/podcasts');
        break;
      case 'soundtrack':
        router.push('/soundtracks');
        break;
      case 'themepark':
        router.push('/themeparks');
        break;
      default:
        break;
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film className="w-4 h-4" />;
      case 'tv': return <Tv className="w-4 h-4" />;
      case 'game': return <Gamepad2 className="w-4 h-4" />;
      case 'book': return <BookOpen className="w-4 h-4" />;
      case 'boardgame': return <Puzzle className="w-4 h-4" />;
      case 'comic': return <ScrollText className="w-4 h-4" />;
      case 'podcast': return <Mic className="w-4 h-4" />;
      case 'soundtrack': return <Music className="w-4 h-4" />;
      case 'themepark': return <MapPin className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'tv': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'game': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'book': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'boardgame': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'comic': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'podcast': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'soundtrack': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      case 'themepark': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      default: return '';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Search Media</h1>
        <p className="text-muted-foreground">Discover movies, TV shows, games, books, comics, podcasts, and more</p>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Search for media..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 h-12"
        />
        <Button 
          size="lg" 
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map((result) => (
            <Card 
              key={result.id} 
              className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleResultClick(result)}
            >
              <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                {result.image ? (
                  <img 
                    src={result.image} 
                    alt={result.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {getTypeIcon(result.type)}
                  </div>
                )}
                <Badge 
                  variant="secondary" 
                  className={`absolute top-2 right-2 ${getTypeColor(result.type)}`}
                >
                  {getTypeIcon(result.type)}
                  <span className="ml-1 capitalize">{result.type}</span>
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold truncate">{result.title}</h3>
                {result.year && (
                  <p className="text-sm text-muted-foreground">{result.year}</p>
                )}
                {result.rating && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-yellow-500">★</span>
                    <span className="text-sm">{result.rating.toFixed(1)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No results found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
}
