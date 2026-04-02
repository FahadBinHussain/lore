'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Tv, Gamepad2, BookOpen, BookCopy, Dice6, Music, Podcast, MapPin, Plus, Check, Clock, Search, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

const iconMap = {
  Film,
  Tv,
  Zap,
  Gamepad2,
  BookOpen,
  BookCopy,
  Dice6,
  Music,
  Podcast,
  MapPin,
};

interface MediaContentProps {
  type: 'movie' | 'tv' | 'anime' | 'game' | 'book' | 'comic' | 'boardgame' | 'soundtrack' | 'podcast' | 'themepark';
  title: string;
  icon: keyof typeof iconMap;
}

interface MediaItem {
  id: number;
  mediaItem: {
    id: number;
    externalId: string;
    title: string;
    posterPath: string | null;
    releaseDate: string | null;
    rating: string | null;
    description: string | null;
    mediaType: string;
  };
  status: string;
  progress: number;
}

export function MediaContent({ type, title, icon }: MediaContentProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<number, boolean>>({});
  const Icon = iconMap[icon];
  const router = useRouter();

  useEffect(() => {
    console.log('Initial load for type:', type);
    setImageLoadErrors({});
    fetchItems();
  }, [type]);

  useEffect(() => {
    console.log('Items state changed:', items.length, 'items');
    items.forEach(item => {
      console.log('Item:', item.id, item.status, item.mediaItem.title);
    });
  }, [items]);

  // Refresh data when window regains focus (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, refreshing dashboard data for type:', type);
      fetchItems();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [type]);

  const fetchItems = async () => {
    console.log('Fetching items for type:', type);
    try {
      const response = await fetch(`/api/media?type=${type}`, {
        cache: 'no-cache'
      });
      const data = await response.json();
      console.log('Fetched items:', data.items?.length, 'items for type:', type);
      console.log('Setting items state with:', data.items?.map((item: any) => ({ id: item.id, status: item.status, title: item.mediaItem.title })));
      setItems(data.items || []);
      setImageLoadErrors({});
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDetailUrl = (mediaType: string, externalId: string) => {
    switch (mediaType) {
      case 'movie': return `/movies/${externalId}`;
      case 'tv': return `/tv/${externalId}`;
      case 'anime': return `/anime/${externalId}`;
      case 'game': return `/games/${externalId}`;
      case 'book': return `/books/${externalId}`;
      case 'comic': return `/comics/${externalId}`;
      case 'boardgame': return `/boardgames/${externalId}`;
      case 'soundtrack': return `/soundtracks/${externalId}`;
      case 'podcast': return `/podcasts/${externalId}`;
      case 'themepark': return `/themeparks/${externalId}`;
      default: return `/${mediaType}s/${externalId}`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500';
      case 'in_progress': return 'bg-amber-500/10 text-amber-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const stats = {
    total: items.length,
    completed: items.filter(i => i.status === 'completed').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
  };

  return (
    <div className="p-6 w-full max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">{title}</h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchItems()}
            className="ml-auto"
          >
            Refresh
          </Button>
        </div>
        <p className="text-muted-foreground">
          {stats.total} tracked • {stats.completed} completed • {stats.inProgress} in progress
        </p>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            In Progress ({stats.inProgress})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            Completed ({stats.completed})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="aspect-[2/3] bg-muted rounded-t-lg" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-2 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filteredItems.map((item) => (
            <Link key={item.id} href={getDetailUrl(item.mediaItem.mediaType, item.mediaItem.externalId)}>
              <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-0 shadow-md">
                <div className="aspect-[2/3] relative overflow-hidden bg-muted rounded-t-lg">
                  {item.mediaItem.posterPath && !imageLoadErrors[item.mediaItem.id] ? (
                    <img 
                      src={item.mediaItem.posterPath} 
                      alt={item.mediaItem.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={() =>
                        setImageLoadErrors((prev) => ({
                          ...prev,
                          [item.mediaItem.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <Icon className="w-12 h-12 text-muted-foreground/50" />
                    </div>
                  )}
                  {item.status !== 'not_started' && (
                    <Badge 
                      className={`absolute top-3 right-3 ${getStatusColor(item.status)} shadow-lg`}
                    >
                      {getStatusIcon(item.status)}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                    {item.mediaItem.title}
                  </h3>
                  {item.mediaItem.releaseDate && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.mediaItem.releaseDate).getFullYear()}
                    </p>
                  )}
                  {item.progress > 0 && item.mediaItem.mediaType !== 'movie' && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Icon className="w-16 h-16 mx-auto mb-6 text-muted-foreground/50" />
          <h3 className="text-2xl font-semibold mb-3">No {title} Tracked Yet</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Start building your {title.toLowerCase()} collection. Search for your favorites and mark them as watched to see them here.
          </p>
          <Link href="/search">
            <Button size="lg" className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25">
              <Search className="w-5 h-5 mr-2" />
              Discover {title}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
