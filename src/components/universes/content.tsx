'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Clock, CheckCircle, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Universe {
  id: number;
  name: string;
  description: string;
  coverImage: string | null;
  createdBy: number;
  isPublic: boolean;
  items: UniverseItem[];
  progress?: number;
  itemsCompleted?: number;
  itemsTotal?: number;
}

interface UniverseItem {
  id: number;
  mediaItem: {
    id: number;
    title: string;
    mediaType: string;
    posterPath: string | null;
    releaseDate: string;
  };
  orderIndex: number;
  isRequired: boolean;
}

interface UniversesContentProps {
}

export function UniversesContent({ }: UniversesContentProps) {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUniverses();
  }, []);

  const fetchUniverses = async () => {
    try {
      const response = await fetch('/api/universes');
      const data = await response.json();
      setUniverses(data.universes || []);
    } catch (error) {
      console.error('Failed to fetch universes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'movie': return '🎬';
      case 'tv': return '📺';
      case 'game': return '🎮';
      case 'book': return '📚';
      default: return '📄';
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-500" />
            Universes
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore and track your progress through interconnected media collections
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted" />
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-2/3 mb-4" />
                <div className="h-4 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : universes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {universes.map((universe) => (
            <Card key={universe.id} className="overflow-hidden group hover:shadow-xl transition-all">
              <div 
                className="h-48 bg-cover bg-center relative"
                style={{ 
                  backgroundImage: universe.coverImage 
                    ? `url(${universe.coverImage})` 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-xl font-bold text-white mb-1">{universe.name}</h3>
                  <p className="text-white/80 text-sm line-clamp-2">{universe.description}</p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger render={<div />}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 text-white hover:bg-white/20"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <CardContent className="p-4 space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Your Progress</span>
                    <span className="font-medium">
                      {universe.itemsCompleted || 0} / {universe.itemsTotal || universe.items.length}
                    </span>
                  </div>
                  <Progress 
                    value={universe.progress || 0} 
                    className="h-2"
                  />
                </div>

                {/* Media Type Breakdown */}
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(universe.items.map(item => item.mediaItem.mediaType))).map(type => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {getMediaTypeIcon(type)} {type}
                    </Badge>
                  ))}
                </div>

                {/* Quick Stats */}
                <div className="flex gap-4 pt-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {universe.items.length} items
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4" />
                    {universe.progress || 0}% complete
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Universes Yet</h3>
          <p className="text-muted-foreground mb-4">
            No public universes available yet. Check back soon!
          </p>
        </Card>
      )}
    </div>
  );
}
