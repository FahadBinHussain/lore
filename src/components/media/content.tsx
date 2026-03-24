'use client';

import { useState, useEffect } from 'react';
import { Film, Tv, Gamepad2, BookOpen, Plus, Check, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const iconMap = {
  Film,
  Tv,
  Gamepad2,
  BookOpen,
};

interface MediaContentProps {
  type: 'movie' | 'tv' | 'game' | 'book';
  title: string;
  icon: keyof typeof iconMap;
}

interface MediaItem {
  id: number;
  mediaItem: {
    id: number;
    title: string;
    posterPath: string | null;
    releaseDate: string | null;
    rating: string | null;
    description: string | null;
  };
  status: string;
  progress: number;
}

export function MediaContent({ type, title, icon }: MediaContentProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const Icon = iconMap[icon];

  useEffect(() => {
    fetchItems();
  }, [type]);

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/media?type=${type}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Icon className="w-8 h-8" />
            {title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {stats.total} tracked • {stats.completed} completed • {stats.inProgress} in progress
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add {title}
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-[2/3] bg-muted" />
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden group hover:shadow-lg transition-shadow cursor-pointer">
              <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                {item.mediaItem.posterPath ? (
                  <img 
                    src={item.mediaItem.posterPath} 
                    alt={item.mediaItem.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                {item.status !== 'not_started' && (
                  <Badge 
                    className={`absolute top-2 right-2 ${getStatusColor(item.status)}`}
                  >
                    {getStatusIcon(item.status)}
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm truncate">{item.mediaItem.title}</h3>
                {item.mediaItem.releaseDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.mediaItem.releaseDate).getFullYear()}
                  </p>
                )}
                {item.progress > 0 && (
                  <div className="mt-2">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No {title} Yet</h3>
          <p className="text-muted-foreground mb-4">
            Start tracking your {title.toLowerCase()} by searching and adding them to your collection.
          </p>
          <Button>Discover {title}</Button>
        </Card>
      )}
    </div>
  );
}
