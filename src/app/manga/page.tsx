'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookCopy, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MediaGridSkeleton, EmptyState } from '@/components/ui/skeleton';

interface MangaItem {
  id: number;
  title: string;
  image: string | null;
  year?: string;
  rating?: number;
  description?: string;
  chapters?: number | null;
  volumes?: number | null;
  format?: string;
  status?: string;
  genres?: string[];
}

export default function MangaPage() {
  const [items, setItems] = useState<MangaItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  async function fetchManga(search = 'manga') {
    const isSearch = search.trim() !== 'manga';
    if (isSearch) setSearching(true);
    else setLoading(true);

    try {
      const response = await fetch(`/api/manga?q=${encodeURIComponent(search)}`);
      const data = await response.json();
      setItems(data.results || []);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  useEffect(() => {
    fetchManga();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      fetchManga();
      return;
    }

    const timer = setTimeout(() => {
      fetchManga(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-violet-500/5" />
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4 border-sky-500/30 bg-sky-500/10 text-sky-500">
              <BookCopy className="mr-1 h-3 w-3" />
              Manga
            </Badge>
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl">Discover Manga</h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Search AniList manga, manhwa, and light novel entries.
            </p>
          </div>

          <form className="mx-auto mb-8 max-w-xl" onSubmit={(event) => event.preventDefault()}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search manga by title..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-xl border-2 py-3 pl-12 pr-4 text-lg focus:border-sky-500/50"
              />
            </div>
          </form>

          <div className="mb-8 flex flex-wrap justify-center gap-4">
            <Link href="/dashboard/manga">
              <Button variant="outline" className="rounded-xl">
                <BookCopy className="mr-2 h-4 w-4" />
                Go to My Manga
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {loading || searching ? (
            <MediaGridSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={BookCopy}
              title="No manga found"
              description="Try a different search term."
            />
          ) : (
            <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <Link key={item.id} href={`/manga/${item.id}`} className="block h-full">
                  <Card className="group h-full transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <CardContent className="p-0">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg bg-muted">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 to-violet-100 dark:from-sky-900/20 dark:to-violet-900/20">
                            <BookCopy className="h-12 w-12 text-sky-500" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="mb-1 line-clamp-2 text-lg font-semibold transition-colors group-hover:text-sky-600">
                          {item.title}
                        </h3>
                        <div className="mb-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {item.year ? <span>{item.year}</span> : null}
                          {item.format ? <span>{item.format}</span> : null}
                          {item.chapters ? <span>{item.chapters} chapters</span> : null}
                        </div>
                        {item.description ? (
                          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                            {item.description.replace(/<[^>]*>/g, '')}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
