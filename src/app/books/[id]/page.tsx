'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Calendar, 
  Users, Loader2, 
  Heart, Share2, Check, BookOpen, FileText,
  ExternalLink, TrendingUp,
  ChevronDown, ChevronUp,
  Image as ImageIcon, Sparkles,
  MapPin, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FacebookBrandIcon,
  InstagramBrandIcon,
  RedditBrandIcon,
  TwitchBrandIcon,
  TwitterBrandIcon,
  YouTubeBrandIcon,
} from '@/components/icons/social-icons';
import { cn } from '@/lib/utils';
import { DetailPageSkeleton } from '@/components/ui/skeleton';
import { CommentsSection } from '@/components/media/comments-section';

// Raw OpenLibrary response interface
interface OpenLibraryDateTime {
  type: string;
  value: string;
}

interface AuthorRef {
  author: {
    key: string;
  };
  type: {
    key: string;
  };
}

interface AuthorWithName {
  key: string;
  name: string;
  bio?: string | { type?: string; value?: string } | null;
  birth_date?: string | null;
  death_date?: string | null;
  photos?: number[];
}

interface TypeRef {
  key: string;
}

interface Ratings {
  summary: {
    average: number;
    count: number;
    sortable: number;
  };
  counts?: {
    1?: number;
    2?: number;
    3?: number;
    4?: number;
    5?: number;
  };
}

interface ReadingLog {
  counts?: {
    want_to_read?: number;
    currently_reading?: number;
    already_read?: number;
  };
}

interface SimilarBook {
  key: string;
  title: string;
  cover_id: number | null;
  authors: string;
  first_publish_year: number | null;
}

interface BookDetails {
  title: string;
  key: string;
  authors: AuthorRef[];
  author_names: AuthorWithName[];
  type: TypeRef;
  description: string | { type: string; value: string };
  covers: number[];
  subject_places: string[];
  subjects: string[];
  subject_people: string[];
  subject_times: string[];
  location: string;
  latest_revision: number;
  revision: number;
  created: OpenLibraryDateTime;
  last_modified: OpenLibraryDateTime;
  // Additional fetched fields
  ratings?: Ratings | null;
  reading_log?: ReadingLog | null;
  editions_count?: number;
  first_sentence?: string | null;
  similar_books?: SimilarBook[];
  links?: Array<{ title?: string; url?: string; type?: string }>;
  excerpts?: Array<{ text?: string; comment?: string; pages?: string[] }>;
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [book, setBook] = useState<BookDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRead, setIsRead] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [updatingRead, setUpdatingRead] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'contents' | 'editions'>('about');

  const handleMarkAsRead = async () => {
    if (!book) return;
    
    setUpdatingRead(true);
    try {
      const idParam = params.id as string;
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch('/api/media/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: numericId,
          mediaType: 'book',
          isWatched: !isRead,
          title: book.title,
          posterPath: coverUrl,
          releaseDate: book.last_modified?.value?.split('T')[0],
        }),
      });
      
      if (response.ok) {
        setIsRead(!isRead);
      }
    } catch (err) {
      console.error('Failed to update read status:', err);
    } finally {
      setUpdatingRead(false);
    }
  };

  const fetchBookDetails = useCallback(async () => {
    try {
      const idParam = params.id as string;
      // Work keys (OL…W) live under /works/, edition keys (OL…M) under /books/ —
      // OpenLibrary 404s when they are swapped, and OL merges some books into one
      // work, so distinct books legitimately carry edition keys.
      const fullKey = idParam.startsWith('/works/') || idParam.startsWith('/books/')
        ? idParam
        : idParam.endsWith('M')
          ? `/books/${idParam}`
          : `/works/${idParam}`;
      
      const response = await fetch(`/api/books/${fullKey}`);
      if (!response.ok) {
        throw new Error('Book not found');
      }
      const data = await response.json();
      setBook(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchReadStatus = useCallback(async () => {
    try {
      const idParam = params.id as string;
      const numericIdMatch = idParam.match(/(\d+)$/);
      const numericId = numericIdMatch ? numericIdMatch[1] : idParam;
      
      const response = await fetch(`/api/media/status?mediaId=${numericId}&mediaType=book`);
      if (response.ok) {
        const data = await response.json();
        setIsRead(data.isWatched);
      }
    } catch (err) {
      console.error('Failed to fetch read status:', err);
    }
  }, [params.id]);

  useEffect(() => {
    fetchBookDetails();
  }, [params.id, fetchBookDetails]);

  useEffect(() => {
    if (book) {
      fetchReadStatus();
    }
  }, [book, fetchReadStatus]);

  // Compute derived values from raw response
  const coverUrl = book?.covers && book.covers.length > 0
    ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
    : null;
  
  const getDescription = () => {
    if (!book?.description) return null;
    if (typeof book.description === 'string') return book.description;
    return book.description.value;
  };

  const getDisplaySubjects = () => {
    const subjects = book?.subjects || [];
    return showAllSubjects ? subjects : subjects.slice(0, 8);
  };

  const getPublishYear = () => {
    if (!book?.last_modified?.value) return null;
    const dateStr = book.last_modified.value;
    const match = dateStr.match(/^(\d{4})/);
    return match ? match[1] : null;
  };

  const getLinkIcon = (url?: string) => {
    const normalized = (url || '').toLowerCase();
    if (normalized.includes('facebook.com')) return FacebookBrandIcon;
    if (normalized.includes('instagram.com')) return InstagramBrandIcon;
    if (normalized.includes('twitter.com') || normalized.includes('x.com')) return TwitterBrandIcon;
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return YouTubeBrandIcon;
    if (normalized.includes('twitch.tv')) return TwitchBrandIcon;
    if (normalized.includes('reddit.com')) return RedditBrandIcon;
    return ExternalLink;
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-base-100 text-base-content flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-error/20 rounded-full blur-xl" />
          <BookOpen className="w-20 h-20 text-base-content relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-base-content">{error || 'Book not found'}</h1>
        <Button onClick={() => router.back()} variant="outline" className="border-base-content/20 text-base-content hover:bg-base-200">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      {/* Hero Section */}
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-10 lg:pb-12">
        {/* Background Backdrop Layer - isolated overflow-hidden so outer page flow is never clipped */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-base-200/40 to-secondary/10" />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/75 to-base-100/25 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-base-100 via-base-100/60 sm:via-transparent to-base-100/50" />
          
          {/* Animated Background Effects */}
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-secondary/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button - in normal flow above hero content */}
        <div className="relative z-20 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto mb-4 sm:mb-6">
          <Button 
            variant="ghost" 
            className="group bg-base-100/70 backdrop-blur-xl border border-base-content/20 hover:bg-base-200 text-base-content transition-all duration-300 shadow-sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
            Back
          </Button>
        </div>

        {/* Book Info & Poster in normal document flow */}
        <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 lg:gap-8 items-center sm:items-end">
            {/* Cover */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-500" />
              <div className="relative w-36 sm:w-44 md:w-52 lg:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-base-content/10 bg-base-300">
                {coverUrl ? (
                  <Image 
                    src={coverUrl}
                    alt={book.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-base-200 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-base-content/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              {/* Title */}
              <div className="mb-4">
                <h1 className="text-4xl md:text-6xl font-bold text-base-content mb-2 tracking-tight">
                  {book.title}
                </h1>
                <p className="text-xl text-base-content/60 text-sm">
                  ID: {book.key.split('/').pop()}
                </p>
              </div>

              {/* Authors */}
              {book.author_names && book.author_names.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                  {book.author_names.slice(0, 3).map((author, idx) => (
                    <div key={idx} className="group flex items-center gap-1.5 sm:gap-2 text-base-content/70">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                      <span className="text-xs sm:text-sm font-medium">{author.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                {getPublishYear() && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 bg-base-200/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-base-content/15 text-xs sm:text-sm">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-base-content font-medium">
                      {getPublishYear()}
                    </span>
                  </div>
                )}

                {book.ratings && book.ratings.summary && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-warning/20 to-primary/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-warning/30 text-xs sm:text-sm">
                    <Star className="w-4 h-4 fill-warning text-warning transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                    <span className="font-bold text-foreground">{book.ratings.summary.average.toFixed(1)}</span>
                    <span className="text-base-content/60 text-xs">({book.ratings.summary.count} ratings)</span>
                  </div>
                )}

                {book.editions_count && book.editions_count > 0 && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 bg-base-200/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-base-content/15 text-xs sm:text-sm">
                    <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-base-content font-medium">{book.editions_count} editions</span>
                  </div>
                )}

                {book.covers && book.covers.length > 0 && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 bg-base-200/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-base-content/15 text-xs sm:text-sm">
                    <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-base-content font-medium">{book.covers.length} covers</span>
                  </div>
                )}

                {book.latest_revision && (
                  <div className="group flex items-center gap-1.5 sm:gap-2 bg-base-200/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-base-content/15 text-xs sm:text-sm">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-base-content font-medium">Rev. {book.latest_revision}</span>
                  </div>
                )}
              </div>

              {/* Genres/Subjects */}
              {book.subjects && book.subjects.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  {getDisplaySubjects().map((subject, idx) => (
                    <span 
                      key={idx} 
                      className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary font-medium text-xs sm:text-sm hover:bg-primary/20 hover:scale-105 transition-all duration-300 cursor-pointer"
                    >
                      {subject}
                    </span>
                  ))}
                  {book.subjects.length > 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllSubjects(!showAllSubjects)}
                      className="group text-base-content/70 hover:text-base-content hover:bg-base-200 text-xs sm:text-sm"
                    >
                      {showAllSubjects ? <ChevronUp className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" /> : <ChevronDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />}
                    </Button>
                  )}
                </div>
              )}

              {/* Subject Places */}
              {book.subject_places && book.subject_places.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary" />
                  {book.subject_places.slice(0, 5).map((place, idx) => (
                    <span key={idx} className="text-base-content/60 text-xs sm:text-sm">
                      {place}{idx < book.subject_places.length - 1 && idx < 4 && ', '}
                    </span>
                  ))}
                </div>
              )}

              {/* Subject People */}
              {book.subject_people && book.subject_people.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="text-base-content/60 text-xs sm:text-sm">
                    Characters: {book.subject_people.slice(0, 5).join(', ')}
                  </span>
                </div>
              )}

              {/* Subject Times */}
              {book.subject_times && book.subject_times.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
                  <span className="text-base-content/60 text-xs sm:text-sm">
                    {book.subject_times.slice(0, 3).join(', ')}
                  </span>
                </div>
              )}

              {/* Reading Log Stats */}
              {book.reading_log && book.reading_log.counts && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="group flex items-center gap-1.5 text-base-content/60">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-xs sm:text-sm">{book.reading_log.counts.already_read || 0} read</span>
                  </div>
                  <div className="group flex items-center gap-1.5 text-base-content/60">
                    <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-xs sm:text-sm">{book.reading_log.counts.currently_reading || 0} reading</span>
                  </div>
                  <div className="group flex items-center gap-1.5 text-base-content/60">
                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-error transition-transform duration-300 group-hover:scale-125" />
                    <span className="text-xs sm:text-sm">{book.reading_log.counts.want_to_read || 0} want to read</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsRead}
                  disabled={updatingRead}
                  className={cn(
                    "group border-base-content/20 text-base-content hover:bg-base-200 transition-all duration-300 hover:scale-105",
                    isRead && "bg-success/20 border-success/50 text-success"
                  )}
                >
                  {updatingRead ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className={cn("w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-125", isRead && "text-success")} />
                  )}
                  {isRead ? 'Read' : 'Mark as Read'}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "group border-base-content/20 text-base-content hover:bg-base-200 transition-all duration-300 hover:scale-105",
                    isFavorite && "bg-error/20 border-error/50 text-error"
                  )}
                >
                  <Heart className={cn("w-4 h-4 transition-transform duration-300 group-hover:scale-125", isFavorite && "fill-error text-error")} />
                </Button>
                
                <Button variant="outline" size="icon" className="group border-base-content/20 text-base-content hover:bg-base-200 transition-all duration-300 hover:scale-105">
                  <Share2 className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-base-content/10 pb-4">
          {(['about', 'contents', 'editions'] as const).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "text-base-content/70 hover:text-base-content hover:bg-base-200 capitalize",
                activeTab === tab && "text-base-content bg-base-200 font-semibold shadow-sm"
              )}
            >
              {tab}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {activeTab === 'about' && (
              <>
                {/* Description */}
                <section className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl blur-xl" />
                  <div className="relative bg-base-200/70 backdrop-blur-xl rounded-2xl border border-base-content/10 p-8">
                    <h2 className="text-2xl font-bold text-base-content mb-4 flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-primary" />
                      About
                    </h2>
                    <p className="text-base-content/80 leading-relaxed text-lg">
                      {getDescription() || 'No description available.'}
                    </p>
                  </div>
                </section>

                {/* First Sentence */}
                {book.first_sentence && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-primary" />
                      Opening Line
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <p className="text-base-content italic text-lg leading-relaxed">
                          &quot;{book.first_sentence}&quot;
                        </p>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Excerpts */}
                {book.excerpts && book.excerpts.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-warning" />
                      Excerpts
                    </h2>
                    <div className="space-y-4">
                      {book.excerpts.slice(0, 3).map((excerpt, idx) => (
                        <Card key={idx} className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                          <CardContent className="p-6">
                            <p className="text-base-content/80 leading-relaxed">
                              {excerpt.text}
                            </p>
                            {excerpt.comment && (
                              <p className="text-base-content/60 text-sm mt-2">
                                - {excerpt.comment}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Subject Places */}
                {book.subject_places && book.subject_places.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <MapPin className="w-6 h-6 text-secondary" />
                      Subject Places
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subject_places.map((place, idx) => (
                            <Badge key={idx} variant="outline" className="bg-secondary/10 text-secondary border-secondary/30">
                              {place}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Subject People */}
                {book.subject_people && book.subject_people.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <Users className="w-6 h-6 text-primary" />
                      Characters
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subject_people.map((person, idx) => (
                            <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              {person}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Subject Times */}
                {book.subject_times && book.subject_times.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <Clock className="w-6 h-6 text-accent" />
                      Time Period
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subject_times.map((time, idx) => (
                            <Badge key={idx} variant="outline" className="bg-accent/10 text-accent border-accent/30">
                              {time}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Metadata */}
                <section>
                  <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-base-content/60" />
                    Metadata
                  </h2>
                  <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Work ID</span>
                        <span className="text-base-content font-medium">{book.key.split('/').pop() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Type</span>
                        <span className="text-base-content font-medium">{book.type?.key?.replace('/type/', '') || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Location</span>
                        <span className="text-base-content font-medium">{book.location?.split('/').pop() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Revision</span>
                        <span className="text-base-content font-medium">{book.revision || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Latest Revision</span>
                        <span className="text-base-content font-medium">{book.latest_revision || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Created</span>
                        <span className="text-base-content font-medium">{book.created?.value || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Last Modified</span>
                        <span className="text-base-content font-medium">{book.last_modified?.value || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </>
            )}

            {activeTab === 'contents' && (
              <>
                {/* Similar Books */}
                {book.similar_books && book.similar_books.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-primary" />
                      Similar Books
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {book.similar_books.slice(0, 6).map((similar, idx) => (
                        <Link
                          key={idx}
                          href={`/books/${similar.key.replace('/works/', '')}`}
                        >
                          <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10 hover:bg-base-200 transition-colors">
                            <CardContent className="p-4">
                              <div className="aspect-[2/3] relative mb-3 rounded-lg overflow-hidden bg-muted">
                                {similar.cover_id ? (
                                  <Image
                                    src={`https://covers.openlibrary.org/b/id/${similar.cover_id}-M.jpg`}
                                    alt={similar.title}
                                    fill
                                    sizes="(min-width: 1024px) 33vw, 50vw"
                                    className="object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-base-300">
                                    <BookOpen className="w-8 h-8 text-primary" />
                                  </div>
                                )}
                              </div>
                              <h3 className="text-base-content font-medium text-sm line-clamp-2">
                                {similar.title}
                              </h3>
                              <p className="text-base-content/60 text-xs mt-1">
                                {similar.authors || 'Unknown Author'}
                              </p>
                              {similar.first_publish_year && (
                                <p className="text-base-content/40 text-xs">
                                  {similar.first_publish_year}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Subjects - Full List */}
                {book.subjects && book.subjects.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-primary" />
                      Subjects ({book.subjects.length})
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subjects.map((subject, idx) => (
                            <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Covers Gallery */}
                {book.covers && book.covers.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <ImageIcon className="w-6 h-6 text-secondary" />
                      Covers ({book.covers.length})
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {book.covers.slice(0, 12).map((coverId, idx) => (
                        <a 
                          key={idx}
                          href={`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-[2/3] rounded-lg overflow-hidden group"
                        >
                          <Image
                            src={`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`}
                            alt={`Cover ${idx + 1}`}
                            fill
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-base-300/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink className="w-6 h-6 text-base-content" />
                          </div>
                        </a>
                      ))}
                    </div>
                    {book.covers.length > 12 && (
                      <p className="text-base-content/60 text-sm mt-4 text-center">
                        And {book.covers.length - 12} more covers...
                      </p>
                    )}
                  </section>
                )}
              </>
            )}

            {activeTab === 'editions' && (
              <>
                {/* Authors */}
                {book.author_names && book.author_names.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <Users className="w-6 h-6 text-primary" />
                      Authors ({book.author_names.length})
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6 space-y-4">
                        {book.author_names.map((author, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-content font-bold flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <a
                                href={`https://openlibrary.org${author.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-base-content hover:text-primary transition-colors font-medium"
                              >
                                {author.name}
                              </a>
                              {(author.birth_date || author.death_date) && (
                                <p className="text-base-content/60 text-sm">
                                  {author.birth_date || ''}{author.death_date ? ` - ${author.death_date}` : ''}
                                </p>
                              )}
                              {author.bio && (
                                <p className="text-base-content/70 text-sm mt-2 line-clamp-3">
                                  {typeof author.bio === 'string' ? author.bio : (author.bio as { value?: string }).value || ''}
                                </p>
                              )}
                              <p className="text-base-content/40 text-xs mt-1">{author.key}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Links */}
                {book.links && book.links.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <ExternalLink className="w-6 h-6 text-primary" />
                      Links
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6 space-y-3">
                        {book.links.slice(0, 10).map((link, idx) => {
                          const LinkIcon = getLinkIcon(link.url);
                          return (
                            <a
                              key={idx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 text-base-content hover:text-primary transition-colors"
                            >
                              <LinkIcon className="w-4 h-4" />
                              <span>{link.title || link.url}</span>
                            </a>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Work Link */}
                {book.location && (
                  <section>
                    <h2 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-3">
                      <ExternalLink className="w-6 h-6 text-primary" />
                      Open Library
                    </h2>
                    <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
                      <CardContent className="p-6">
                        <a
                          href={`https://openlibrary.org${book.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-base-content hover:text-primary transition-colors"
                        >
                          <BookOpen className="w-5 h-5" />
                          <span>View on Open Library</span>
                          <ExternalLink className="w-4 h-4 ml-auto" />
                        </a>
                      </CardContent>
                    </Card>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Quick Stats */}
            <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-base-content mb-4">Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Covers</span>
                    <span className="text-base-content font-medium">{book.covers?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Subjects</span>
                    <span className="text-base-content font-medium">{book.subjects?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Subject Places</span>
                    <span className="text-base-content font-medium">{book.subject_places?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Subject People</span>
                    <span className="text-base-content font-medium">{book.subject_people?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Subject Times</span>
                    <span className="text-base-content font-medium">{book.subject_times?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Authors</span>
                    <span className="text-base-content font-medium">{book.author_names?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Info */}
            <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-base-content mb-4">Details</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-base-content/60 text-sm">Work ID</span>
                    <p className="text-base-content font-medium">{book.key.split('/').pop() || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-base-content/60 text-sm">Type</span>
                    <p className="text-base-content font-medium">{book.type?.key?.replace('/type/', '') || 'Unknown'}</p>
                  </div>
                  {book.location && (
                    <div>
                      <span className="text-base-content/60 text-sm">Location</span>
                      <p className="text-base-content font-medium">{book.location.split('/').pop()}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-base-content/60 text-sm">Revision</span>
                    <p className="text-base-content font-medium">{book.latest_revision || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-base-200/70 backdrop-blur-xl border border-base-content/10">
              <CardContent className="p-6 space-y-3">
                <a
                  href={`https://openlibrary.org${book.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="outline" className="w-full border-base-content/20 text-base-content hover:bg-base-200">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Open Library
                  </Button>
                </a>
                {book.covers && book.covers.length > 0 && (
                  <a
                    href={`https://openlibrary.org/browse/works${book.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full border-base-content/20 text-base-content hover:bg-base-200">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Browse Covers
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {book ? (
          <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
            <CommentsSection
              mediaId={params.id as string}
              mediaType="book"
              title={book.title}
              posterPath={book.covers?.[0] ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg` : null}
              releaseDate={null}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
