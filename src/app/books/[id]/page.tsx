'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Star, Calendar, Globe, 
  Users, Loader2, Play, 
  Heart, Share2, Check, BookOpen, FileText,
  ExternalLink, TrendingUp, Award, Building2,
  ChevronDown, ChevronUp,
  PlayCircle, Image as ImageIcon, Sparkles,
  MessageCircle, Camera, ThumbsUp, MapPin, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  const fetchBookDetails = async () => {
    try {
      const idParam = params.id as string;
      const fullKey = idParam.startsWith('/works/') ? idParam : `/works/${idParam}`;
      
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
  };

  const fetchReadStatus = async () => {
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
  };

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

  useEffect(() => {
    fetchBookDetails();
  }, [params.id]);

  useEffect(() => {
    if (book) {
      fetchReadStatus();
    }
  }, [book]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur-xl opacity-50 animate-pulse" />
          <Loader2 className="w-16 h-16 animate-spin text-white relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-xl opacity-50" />
          <BookOpen className="w-20 h-20 text-white relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-white">{error || 'Book not found'}</h1>
        <Button onClick={() => router.back()} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative h-screen -mt-16">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/30 via-orange-600/20 to-yellow-600/30" />
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />
        
        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-orange-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back Button */}
        <div className="fixed top-20 left-6 z-50">
          <Link href="/">
            <Button variant="ghost" className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-white transition-all duration-300">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Book Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Cover */}
            <div className="flex-shrink-0 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                {coverUrl ? (
                  <img 
                    src={coverUrl}
                    alt={book.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <div className="mb-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-tight">
                  {book.title}
                </h1>
                <p className="text-xl text-white/50 text-sm">
                  ID: {book.key.split('/').pop()}
                </p>
              </div>

              {/* Authors */}
              {book.author_names && book.author_names.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  {book.author_names.slice(0, 3).map((author, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-white/70">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium">{author.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {getPublishYear() && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span className="text-white font-medium">
                      {getPublishYear()}
                    </span>
                  </div>
                )}

                {book.ratings && book.ratings.summary && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-amber-400">{book.ratings.summary.average.toFixed(1)}</span>
                    <span className="text-white/50 text-sm">({book.ratings.summary.count} ratings)</span>
                  </div>
                )}

                {book.editions_count && book.editions_count > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{book.editions_count} editions</span>
                  </div>
                )}

                {book.covers && book.covers.length > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <ImageIcon className="w-4 h-4 text-violet-400" />
                    <span className="text-white font-medium">{book.covers.length} covers</span>
                  </div>
                )}

                {book.latest_revision && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">Rev. {book.latest_revision}</span>
                  </div>
                )}
              </div>

              {/* Genres/Subjects */}
              {book.subjects && book.subjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {getDisplaySubjects().map((subject, idx) => (
                    <span 
                      key={idx} 
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 font-medium text-sm hover:from-amber-500/30 hover:to-orange-500/30 transition-all duration-300 cursor-pointer"
                    >
                      {subject}
                    </span>
                  ))}
                  {book.subjects.length > 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllSubjects(!showAllSubjects)}
                      className="text-white/70 hover:text-white hover:bg-white/10"
                    >
                      {showAllSubjects ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              )}

              {/* Subject Places */}
              {book.subject_places && book.subject_places.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <MapPin className="w-4 h-4 text-pink-400" />
                  {book.subject_places.slice(0, 5).map((place, idx) => (
                    <span key={idx} className="text-white/60 text-sm">
                      {place}{idx < book.subject_places.length - 1 && idx < 4 && ', '}
                    </span>
                  ))}
                </div>
              )}

              {/* Subject People */}
              {book.subject_people && book.subject_people.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-white/60 text-sm">
                    Characters: {book.subject_people.slice(0, 5).join(', ')}
                  </span>
                </div>
              )}

              {/* Subject Times */}
              {book.subject_times && book.subject_times.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="text-white/60 text-sm">
                    {book.subject_times.slice(0, 3).join(', ')}
                  </span>
                </div>
              )}

              {/* Reading Log Stats */}
              {book.reading_log && book.reading_log.counts && (
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="flex items-center gap-2 text-white/60">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">{book.reading_log.counts.already_read || 0} read</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">{book.reading_log.counts.currently_reading || 0} reading</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <Heart className="w-4 h-4 text-pink-400" />
                    <span className="text-sm">{book.reading_log.counts.want_to_read || 0} want to read</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleMarkAsRead}
                  disabled={updatingRead}
                  className={cn(
                    "border-white/20 text-white hover:bg-white/10 transition-all duration-300",
                    isRead && "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  )}
                >
                  {updatingRead ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className={cn("w-4 h-4 mr-2", isRead && "fill-emerald-400")} />
                  )}
                  {isRead ? 'Read' : 'Mark as Read'}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    "border-white/20 text-white hover:bg-white/10 transition-all duration-300",
                    isFavorite && "bg-red-500/20 border-red-500/50 text-red-400"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isFavorite && "fill-red-400")} />
                </Button>
                
                <Button variant="outline" size="icon" className="border-white/20 text-white hover:bg-white/10">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
          {(['about', 'contents', 'editions'] as const).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10 capitalize",
                activeTab === tab && "text-white bg-white/10"
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
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-3xl blur-xl" />
                  <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-amber-400" />
                      About
                    </h2>
                    <p className="text-white/80 leading-relaxed text-lg">
                      {getDescription() || 'No description available.'}
                    </p>
                  </div>
                </section>

                {/* First Sentence */}
                {book.first_sentence && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-orange-400" />
                      Opening Line
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <p className="text-white/90 italic text-lg leading-relaxed">
                          "{book.first_sentence}"
                        </p>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Excerpts */}
                {book.excerpts && book.excerpts.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-yellow-400" />
                      Excerpts
                    </h2>
                    <div className="space-y-4">
                      {book.excerpts.slice(0, 3).map((excerpt, idx) => (
                        <Card key={idx} className="bg-white/5 backdrop-blur-xl border border-white/10">
                          <CardContent className="p-6">
                            <p className="text-white/80 leading-relaxed">
                              {excerpt.text}
                            </p>
                            {excerpt.comment && (
                              <p className="text-white/50 text-sm mt-2">
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <MapPin className="w-6 h-6 text-pink-400" />
                      Subject Places
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subject_places.map((place, idx) => (
                            <Badge key={idx} variant="outline" className="bg-pink-500/10 text-pink-300 border-pink-500/30">
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Users className="w-6 h-6 text-blue-400" />
                      Characters
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subject_people.map((person, idx) => (
                            <Badge key={idx} variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30">
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Clock className="w-6 h-6 text-cyan-400" />
                      Time Period
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subject_times.map((time, idx) => (
                            <Badge key={idx} variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
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
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                    Metadata
                  </h2>
                  <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between">
                        <span className="text-white/50">Work ID</span>
                        <span className="text-white">{book.key.split('/').pop() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Type</span>
                        <span className="text-white">{book.type?.key?.replace('/type/', '') || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Location</span>
                        <span className="text-white">{book.location?.split('/').pop() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Revision</span>
                        <span className="text-white">{book.revision || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Latest Revision</span>
                        <span className="text-white">{book.latest_revision || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Created</span>
                        <span className="text-white">{book.created?.value || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Last Modified</span>
                        <span className="text-white">{book.last_modified?.value || 'N/A'}</span>
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-amber-400" />
                      Similar Books
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {book.similar_books.slice(0, 6).map((similar, idx) => (
                        <Link
                          key={idx}
                          href={`/books/${similar.key.replace('/works/', '')}`}
                        >
                          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-colors">
                            <CardContent className="p-4">
                              <div className="aspect-[2/3] relative mb-3 rounded-lg overflow-hidden bg-muted">
                                {similar.cover_id ? (
                                  <img
                                    src={`https://covers.openlibrary.org/b/id/${similar.cover_id}-M.jpg`}
                                    alt={similar.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-900/50 to-orange-900/50">
                                    <BookOpen className="w-8 h-8 text-amber-500" />
                                  </div>
                                )}
                              </div>
                              <h3 className="text-white font-medium text-sm line-clamp-2">
                                {similar.title}
                              </h3>
                              <p className="text-white/50 text-xs mt-1">
                                {similar.authors || 'Unknown Author'}
                              </p>
                              {similar.first_publish_year && (
                                <p className="text-white/30 text-xs">
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-amber-400" />
                      Subjects ({book.subjects.length})
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {book.subjects.map((subject, idx) => (
                            <Badge key={idx} variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30">
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <ImageIcon className="w-6 h-6 text-violet-400" />
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
                          <img
                            src={`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`}
                            alt={`Cover ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink className="w-6 h-6 text-white" />
                          </div>
                        </a>
                      ))}
                    </div>
                    {book.covers.length > 12 && (
                      <p className="text-white/50 text-sm mt-4 text-center">
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Users className="w-6 h-6 text-amber-400" />
                      Authors ({book.author_names.length})
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6 space-y-4">
                        {book.author_names.map((author, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <a
                                href={`https://openlibrary.org${author.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white hover:text-amber-400 transition-colors font-medium"
                              >
                                {author.name}
                              </a>
                              {(author.birth_date || author.death_date) && (
                                <p className="text-white/50 text-sm">
                                  {author.birth_date || ''}{author.death_date ? ` - ${author.death_date}` : ''}
                                </p>
                              )}
                              {author.bio && (
                                <p className="text-white/70 text-sm mt-2 line-clamp-3">
                                  {typeof author.bio === 'string' ? author.bio : (author.bio as any).value || ''}
                                </p>
                              )}
                              <p className="text-white/30 text-xs mt-1">{author.key}</p>
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
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <ExternalLink className="w-6 h-6 text-emerald-400" />
                      Links
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6 space-y-3">
                        {book.links.slice(0, 10).map((link, idx) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 text-white hover:text-amber-400 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>{link.title || link.url}</span>
                          </a>
                        ))}
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Work Link */}
                {book.location && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <ExternalLink className="w-6 h-6 text-emerald-400" />
                      Open Library
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <a
                          href={`https://openlibrary.org${book.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-white hover:text-amber-400 transition-colors"
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
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/50">Covers</span>
                    <span className="text-white">{book.covers?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Subjects</span>
                    <span className="text-white">{book.subjects?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Subject Places</span>
                    <span className="text-white">{book.subject_places?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Subject People</span>
                    <span className="text-white">{book.subject_people?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Subject Times</span>
                    <span className="text-white">{book.subject_times?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Authors</span>
                    <span className="text-white">{book.author_names?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Info */}
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Details</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-white/50 text-sm">Work ID</span>
                    <p className="text-white">{book.key.split('/').pop() || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-white/50 text-sm">Type</span>
                    <p className="text-white">{book.type?.key?.replace('/type/', '') || 'Unknown'}</p>
                  </div>
                  {book.location && (
                    <div>
                      <span className="text-white/50 text-sm">Location</span>
                      <p className="text-white">{book.location.split('/').pop()}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-white/50 text-sm">Revision</span>
                    <p className="text-white">{book.latest_revision || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
              <CardContent className="p-6 space-y-3">
                <a
                  href={`https://openlibrary.org${book.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
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
                    <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Browse Covers
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
