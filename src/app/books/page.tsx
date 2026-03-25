'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, Star, Loader2, ArrowRight, ArrowLeft,
  TrendingUp, Flame, Sparkles, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

interface BookItem {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  rating?: number;
  description?: string;
  author?: string;
  pages?: number;
  isbn?: string;
}

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, [page]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/books?page=${page}`
      );
      const data = await response.json();
      setBooks(data.results || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch books:', error);
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
        `/api/books?q=${encodeURIComponent(searchQuery)}&page=1`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const displayBooks = searchQuery ? searchResults : books;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-green-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              <BookOpen className="w-3 h-3 mr-1" />
              Books
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Discover Books
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore books from Open Library - search by title, author, or ISBN
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search books by title, author, or ISBN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg rounded-xl border-2 focus:border-emerald-500/50"
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link href="/dashboard/books">
              <Button variant="outline" className="rounded-xl">
                <BookOpen className="w-4 h-4 mr-2" />
                Go to My Books
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Books Grid */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-muted-foreground">
                {searchResults.length} books found
              </p>
            </div>
          )}

          {loading || searching ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="ml-2 text-muted-foreground">
                {searching ? 'Searching...' : 'Loading books...'}
              </span>
            </div>
          ) : displayBooks.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No books found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Unable to load books at the moment'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {displayBooks.map((book) => (
                  <Card key={book.id} className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <CardContent className="p-0">
                      <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg bg-muted">
                        {book.image ? (
                          <img
                            src={book.image}
                            alt={book.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20">
                            <BookOpen className="w-12 h-12 text-emerald-500" />
                          </div>
                        )}
                        {book.rating && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {book.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                          {book.title}
                        </h3>
                        {book.author && (
                          <p className="text-sm text-muted-foreground mb-2">
                            by {book.author}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          {book.year && <span>{book.year}</span>}
                          {book.pages && <span>{book.pages} pages</span>}
                        </div>
                        {book.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {book.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {!searchQuery && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1 || loading}
                    className="rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages || loading}
                    className="rounded-xl"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 mr-2" />
                  </Button>
                </div>
              )}
            </>
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