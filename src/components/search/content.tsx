'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Film, Tv, Gamepad2, BookOpen, Mic, Loader2 } from 'lucide-react';

interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'anime' | 'game' | 'book' | 'boardgame' | 'comic' | 'podcast' | 'soundtrack' | 'themepark';
  image?: string;
  year?: string;
  rating?: number;
  genre?: string;
}

interface Universe {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
}

// Sample universes data
const universes: Universe[] = [
  {
    id: '1',
    name: 'The Orion Frontier',
    description: 'A multi-generational saga of human expansion across the stars.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD8ZmsQITuZkcMHh-dNydgZW5rb-Ky3pqPQ8SPpuYXs5PA_Y6PE1W-_N0MpjTHCJmSbzivlr4YbO9J7WnowmHDtQ9q8aV_HAy4KcTNhJxeaqcs0F4Jap5LvL3Ir9a6Vrdirxa7jmutqTtqou3QkLBDeHBvq0hKFi9Wh5P0pT27Z66S0_qIewECsHW_cdQgCb_CkLKB9XL3ABNrEUSKKF8o3qJ7Di2GpS4SrKRHYkdAP3us23wGpM3p-JtXY0oyN7NOV9rp-HLDiDJEq',
    category: 'Epic Space Opera',
  },
  {
    id: '2',
    name: 'Echoes of Valoria',
    description: 'A world where magic is a dying resource and kingdoms are built on forgotten shadows.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyn6bTXw5w5W9b2CebZ5Gwkr0M2yPNM_5VBGMU8S6LK1jHKqsGOccTF2s7BbeXiHeMi__BSX-WsrGA5M9LMTSpqBs2JfnkBFoPuCaXZwfc8btPH_sc4eFl6TlysU_E0UDlISbc8LG3uekaDtCH8u0yOhcTtGblNliDv60vISTWM4Ii8neHdwOYgMnk9e62Ma6yCilisptFPjr5tOWAtmyJZCO9UmqFcLCFObubsVHsvVPZhY92EngaEoRFKXTuQtUHTV77WPIx26xa',
    category: 'Dark Fantasy',
  },
  {
    id: '3',
    name: 'Neon Syndicate',
    description: 'Underground warring factions fighting for control of the digital afterlife.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDtaTcwr1Va7uO5OBVINEnkZGz-i3CVWu1U05_6zkC9VqVF_ENGp-if7aU62E-P3w9BVXGUS1QRbnb5zOmjhE0hscc9bmVARnxpBYXNJvmTKZbu1apkATWY5achUw5LVSc4dYMXRRhDf_bUtkCv6wT96nhVsF8P3gNHCRLFJJRwXZdOPYgmbHOAwQm8A9Gk5PEWeeLM6QX9KwTRhEMDxVVkaVVyJBX6dTnxPywfhJwUfCwhRLSc2PvIXWmnMN8pR6wignzfpuDsmKes',
    category: 'Cyberpunk Crime',
  },
];

export function SearchContent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const router = useRouter();

  // Fetch trending items on mount
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch('/api/search/trending');
        if (response.ok) {
          const data = await response.json();
          setTrendingItems(data.results || []);
        }
      } catch {
        console.error('Failed to fetch trending');
      } finally {
        setTrendingLoading(false);
      }
    };
    fetchTrending();
  }, []);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim()) {
      setLoading(true);
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (response.ok) {
            const data = await response.json();
            setResults(data.results || []);
            setShowResults(true);
          }
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film className="text-lg" />;
      case 'tv': return <Tv className="text-lg" />;
      case 'anime': return <span className="text-lg">capture</span>;
      case 'game': return <Gamepad2 className="text-lg" />;
      case 'book': return <BookOpen className="text-lg" />;
      case 'podcast': return <Mic className="text-lg" />;
      default: return <Film className="text-lg" />;
    }
  };

  const handleCategoryClick = (category: string) => {
    router.push(`/${category.toLowerCase().replace(' ', '')}`);
  };

  const handleItemClick = (item: MediaItem) => {
    const routes: Record<string, string> = {
      movie: `/movies/${item.id}`,
      tv: `/tv/${item.id}`,
      anime: `/anime/${item.id}`,
      game: `/games/${item.id}`,
      book: `/books/${item.id}`,
    };
    router.push(routes[item.type] || '/');
  };

  return (
    <main className="relative z-10 pt-24 pb-32 px-6 max-w-7xl mx-auto">
      {/* Hero Search Section */}
      <section className="flex flex-col items-center text-center mb-20">
        <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter mb-8 flex flex-col items-center">
          <span>The Archive</span>
          <span className="font-script text-primary text-6xl md:text-8xl mt-[-10px] glowing-text italic lowercase">Awaits</span>
        </h1>
        
        {/* Search Bar */}
        <div className="w-full max-w-2xl relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
          <div className="relative flex items-center bg-surface-container-high rounded-full px-6 py-5 border border-outline-variant/20 shadow-2xl">
            <span className="material-symbols-outlined text-on-surface-variant mr-4">search</span>
            <input
              type="text"
              className="bg-transparent border-none focus:ring-0 text-on-surface placeholder-on-surface-variant w-full font-body text-lg"
              placeholder="Search universes, media, or archives..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <kbd className="hidden md:flex items-center justify-center bg-surface-container-highest border border-outline-variant/30 text-on-surface-variant px-2 py-1 rounded-lg text-xs font-sans">⌘</kbd>
              <kbd className="hidden md:flex items-center justify-center bg-surface-container-highest border border-outline-variant/30 text-on-surface-variant px-2 py-1 rounded-lg text-xs font-sans">K</kbd>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {showResults && (
          <div className="w-full max-w-2xl mt-4 bg-surface-container rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-surface-container-high transition-colors text-left"
                  >
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-on-surface truncate">{item.title}</h3>
                      <p className="text-sm text-on-surface-variant">{item.genre} • {item.year}</p>
                    </div>
                    {getCategoryIcon(item.type)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant">
                No results found. Try a different search term.
              </div>
            )}
          </div>
        )}

        {/* Discover Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          <Link href="/movies">
            <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface rounded-full transition-all border border-outline-variant/10">
              <Film className="text-lg" />
              <span className="text-sm font-medium">Movies</span>
            </button>
          </Link>
          <Link href="/tv">
            <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface rounded-full transition-all border border-outline-variant/10">
              <Tv className="text-lg" />
              <span className="text-sm font-medium">TV Shows</span>
            </button>
          </Link>
          <Link href="/games">
            <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface rounded-full transition-all border border-outline-variant/10">
              <Gamepad2 className="text-lg" />
              <span className="text-sm font-medium">Games</span>
            </button>
          </Link>
          <Link href="/books">
            <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface rounded-full transition-all border border-outline-variant/10">
              <BookOpen className="text-lg" />
              <span className="text-sm font-medium">Books</span>
            </button>
          </Link>
          <Link href="/anime">
            <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface rounded-full transition-all border border-outline-variant/10">
              <span className="material-symbols-outlined text-lg">capture</span>
              <span className="text-sm font-medium">Anime</span>
            </button>
          </Link>
          <Link href="/podcasts">
            <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface rounded-full transition-all border border-outline-variant/10">
              <Mic className="text-lg" />
              <span className="text-sm font-medium">Podcasts</span>
            </button>
          </Link>
        </div>
      </section>

      {/* Trending Section */}
      <section className="mb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-2xl font-bold tracking-tight">Trending in your circle</h2>
          <Link href="#" className="text-primary text-sm font-medium hover:underline">View All</Link>
        </div>
        {trendingLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x">
            {trendingItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="min-w-[180px] md:min-w-[220px] snap-start group cursor-pointer"
                onClick={() => handleItemClick(item)}
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-4 shadow-lg transition-transform duration-500 group-hover:scale-[1.02]">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                      {getCategoryIcon(item.type)}
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                    <span className="material-symbols-outlined text-yellow-400 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="text-[10px] font-bold">{item.rating}</span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                    <span className="text-[10px] font-medium uppercase">{item.type}</span>
                  </div>
                </div>
                <h3 className="font-bold text-on-surface text-base line-clamp-1">{item.title}</h3>
                <p className="text-on-surface-variant text-xs mt-1">{item.year}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured Universes Section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-2xl font-bold tracking-tight">Featured Universes</h2>
          <Link href="/universes">
            <button className="p-2 rounded-full bg-surface-container-high border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {universes.map((universe) => (
            <Link href={`/universes/${universe.id}`} key={universe.id}>
              <div className="relative h-64 rounded-3xl overflow-hidden group cursor-pointer">
                <img
                  src={universe.image}
                  alt={universe.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/30">
                      {universe.category}
                    </span>
                  </div>
                  <h3 className="font-headline text-xl font-bold text-white">{universe.name}</h3>
                  <p className="text-white/60 text-xs mt-1 line-clamp-2">{universe.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full"></div>
      </div>
    </main>
  );
}
