'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Film, Tv, Gamepad2, BookOpen, ArrowRight, Star,
  Music, Podcast, Puzzle, Clapperboard, MapPin as ThemeParkIcon,
  Compass, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MediaGridSkeleton, EmptyState, ErrorState } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LogoScrollSequence } from '@/components/home/logo-scroll-sequence';

interface MediaItem {
  id: number;
  title: string;
  image: string | null;
  year?: string;
  rating?: number;
  description?: string;
  seasons?: number;
  episodes?: number;
}

type MediaTabKey =
  | 'movies' | 'tv' | 'anime' | 'games'
  | 'books' | 'comics' | 'boardgames'
  | 'soundtracks' | 'podcasts' | 'themeparks';

const MEDIA_TABS: { key: MediaTabKey; label: string; icon: typeof Film; href: string }[] = [
  { key: 'movies', label: 'Movies', icon: Film, href: '/movies' },
  { key: 'tv', label: 'TV Shows', icon: Tv, href: '/tv' },
  { key: 'anime', label: 'Anime', icon: Clapperboard, href: '/anime' },
  { key: 'games', label: 'Games', icon: Gamepad2, href: '/games' },
  { key: 'books', label: 'Books', icon: BookOpen, href: '/books' },
  { key: 'comics', label: 'Comics', icon: BookOpen, href: '/comics' },
  { key: 'boardgames', label: 'Board Games', icon: Puzzle, href: '/boardgames' },
  { key: 'soundtracks', label: 'Soundtracks', icon: Music, href: '/soundtracks' },
  { key: 'podcasts', label: 'Podcasts', icon: Podcast, href: '/podcasts' },
  { key: 'themeparks', label: 'Theme Parks', icon: ThemeParkIcon, href: '/themeparks' },
];

function MediaCard({ item, href, icon }: { item: MediaItem; href: string; icon: typeof Film }) {
  return (
    <Link href={href} className="block group/card">
      <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 hover:border-border">
        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.title}
              fill
              sizes="(min-width: 640px) 33vw, (min-width: 1024px) 20vw, 50vw"
              className="object-cover transition duration-500 group-hover/card:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
              {(() => {
                const Icon = icon;
                return <Icon className="w-12 h-12 text-muted-foreground/30" />;
              })()}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
          {item.rating ? (
            <div className="absolute top-2.5 right-2.5 bg-card/90 backdrop-blur-md border border-border/50 text-foreground px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              {item.rating.toFixed(1)}
            </div>
          ) : null}
        </div>
        <CardContent className="p-3.5">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem] group-hover/card:text-primary transition-colors">{item.title}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            {item.year ? <span className="text-xs text-muted-foreground">{item.year}</span> : null}
            {item.year && item.seasons ? <span className="text-xs text-muted-foreground/40">·</span> : null}
            {item.seasons ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {item.seasons} season{item.seasons !== 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MediaGrid({
  items,
  loading,
  error,
  href,
  icon,
  emptyLabel,
  onRetry,
}: {
  items: MediaItem[];
  loading: boolean;
  error: boolean;
  href: string;
  icon: typeof Film;
  emptyLabel: string;
  onRetry: () => void;
}) {
  if (loading) {
    return <MediaGridSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load"
        description="Something went wrong while fetching this content."
        retryAction={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={icon}
        title={emptyLabel}
        description="Check back later for new additions."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {items.slice(0, 12).map((item) => (
        <MediaCard key={item.id} item={item} href={`${href}/${item.id}`} icon={icon} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { status } = useSession();

  const [mediaData, setMediaData] = useState<Record<MediaTabKey, MediaItem[]>>({
    movies: [], tv: [], anime: [], games: [],
    books: [], comics: [], boardgames: [],
    soundtracks: [], podcasts: [], themeparks: [],
  });
  const [loadingStates, setLoadingStates] = useState<Record<MediaTabKey, boolean>>({
    movies: true, tv: true, anime: true, games: true,
    books: true, comics: true, boardgames: true,
    soundtracks: true, podcasts: true, themeparks: true,
  });
  const [errorStates, setErrorStates] = useState<Record<MediaTabKey, boolean>>({
    movies: false, tv: false, anime: false, games: false,
    books: false, comics: false, boardgames: false,
    soundtracks: false, podcasts: false, themeparks: false,
  });

  const [activeTab, setActiveTab] = useState<MediaTabKey>('movies');
  const isAuthenticated = status === 'authenticated';

  const fetchMedia = useCallback(async (key: MediaTabKey) => {
    const endpoints: Record<MediaTabKey, string> = {
      movies: '/api/movies?category=trending&timeWindow=week',
      tv: '/api/tv?category=trending&timeWindow=week',
      anime: '/api/anime?category=trending',
      games: '/api/games',
      books: '/api/books',
      comics: '/api/comics',
      boardgames: '/api/boardgames',
      soundtracks: '/api/soundtracks',
      podcasts: '/api/podcasts',
      themeparks: '/api/themeparks',
    };

    try {
      const response = await fetch(endpoints[key]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMediaData((prev) => ({ ...prev, [key]: data.results || [] }));
      setErrorStates((prev) => ({ ...prev, [key]: false }));
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
      setErrorStates((prev) => ({ ...prev, [key]: true }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    MEDIA_TABS.forEach(({ key }) => fetchMedia(key));
  }, [fetchMedia]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero — scroll-linked canvas, reduced from 240vh for tighter pacing */}
      <section className="relative min-h-[180vh] supports-[animation-timeline:view()]:min-h-[180vh] [@media(prefers-reduced-motion:reduce)]:min-h-[100vh]">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">
          <LogoScrollSequence />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background" />

          <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className={cn(
              "space-y-6 transition-all duration-700",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground font-[family-name:var(--font-epilogue)]">
                Track your media universe
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Discover, track, and organize every movie, show, game, book, and comic across interconnected franchises — in release order.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={isAuthenticated ? '/dashboard' : '/auth/signin'}>
                  <Button size="lg" className="group">
                    {isAuthenticated ? 'Go to Dashboard' : 'Start Tracking'}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <Link href="/universes">
                  <Button variant="outline" size="lg">
                    <Compass className="w-4 h-4 mr-2" />
                    Browse Universes
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Media */}
      <section className="py-12 sm:py-16 relative">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 font-[family-name:var(--font-epilogue)]">
              Trending now
            </h2>
            <p className="text-sm text-muted-foreground">
              Discover what&apos;s popular across movies, TV, anime, games, and more
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MediaTabKey)} className="w-full">
            <div className="mb-6 overflow-x-auto no-scrollbar scroll-px-6 -mx-1 px-1">
              <TabsList className="inline-flex min-w-max h-auto items-center rounded-full bg-muted p-1 gap-0.5 border border-border/40">
                {MEDIA_TABS.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="shrink-0 flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm px-3.5 py-1.5 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm font-medium"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {MEDIA_TABS.map(({ key, label, icon, href }) => (
              <TabsContent key={key} value={key}>
                <MediaGrid
                  items={mediaData[key]}
                  loading={loadingStates[key]}
                  error={errorStates[key]}
                  href={href}
                  icon={icon}
                  emptyLabel={`No ${label.toLowerCase()} found right now`}
                  onRetry={() => fetchMedia(key)}
                />
                {mediaData[key].length > 0 && (
                  <div className="mt-8 text-center">
                    <Link href={href}>
                      <Button variant="outline" size="sm" className="group">
                        View all {label.toLowerCase()}
                        <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Universes callout */}
      <section className="py-16 sm:py-20 border-t border-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                <Layers className="w-3 h-3 mr-1.5" />
                Universes
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 font-[family-name:var(--font-epilogue)]">
                Every item in a franchise, in release order
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
                Universes are curated collections of every official release in a franchise — movies, shows, games, books, comics, soundtracks, and theme park attractions. All ordered by release date, so you always know what to experience next.
              </p>
              <Link href="/universes">
                <Button className="group">
                  Explore universes
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Universes', value: '40+' },
                { label: 'Media items', value: '2,900+' },
                { label: 'Media types', value: '10' },
                { label: 'Franchises', value: 'MCU, DC, Shrek, and more' },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-lg border border-border/40 bg-card/50">
                  <div className="text-xl font-bold font-[family-name:var(--font-epilogue)]">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Lore logo"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
              />
              <span className="font-bold text-lg">Lore</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
              <Link href="/universes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Universes
              </Link>
              <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Search
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Lore
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}