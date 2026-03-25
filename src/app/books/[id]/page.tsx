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

interface Author {
  key: string;
  name: string;
  bio: string | null;
  birth_date: string | null;
  death_date: string | null;
  photo: string | null;
}

interface EditionInfo {
  physical_format: string | null;
  pagination: string | null;
  number_of_pages: number | null;
  weight: string | null;
  publish_date: string | null;
  publishers: string[];
  isbn_10: string[];
  isbn_13: string[];
  lccn: string[];
  oclc: string[];
}

interface Ratings {
  summary: {
    average: number;
    count: number;
    sortable: number;
  };
  counts: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface ReadingLog {
  counts: {
    want_to_read: number;
    currently_reading: number;
    already_read: number;
  };
}

interface Link {
  title: string;
  url: string;
}

interface Excerpt {
  text: string;
  comment?: string;
}

interface TableOfContentItem {
  title: string;
  level: number;
  page?: number;
}

interface SimilarBook {
  key: string;
  title: string;
  cover_id: number | null;
  authors: string;
  first_publish_year: number;
}

interface WorkDetails {
  description: string | null;
  subjects: string[];
  subject_places: string[];
  subject_people: string[];
  subject_times: string[];
  first_sentence: string | null;
}

interface BookDetails {
  key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  first_sentence: string | null;
  cover_url: string | null;
  authors: Author[];
  subjects: string[];
  subject_places: string[];
  subject_people: string[];
  subject_times: string[];
  first_publish_date: string | null;
  edition_info: EditionInfo;
  editions_count: number;
  ratings: Ratings | null;
  reading_log: ReadingLog | null;
  links: Link[];
  excerpts: Excerpt[];
  table_of_contents: TableOfContentItem[];
  languages: string[];
  similar_books: SimilarBook[];
  work_details: WorkDetails | null;
  created: string;
  last_modified: string;
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
          posterPath: book.cover_url,
          releaseDate: book.first_publish_date,
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

  const getDisplaySubjects = () => {
    const subjects = book?.subjects || [];
    return showAllSubjects ? subjects : subjects.slice(0, 8);
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
      <div className="relative min-h-[70vh] overflow-hidden">
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
        <div className="absolute top-6 left-6 z-20">
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
                {book.cover_url ? (
                  <img 
                    src={book.cover_url}
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
                {book.subtitle && (
                  <p className="text-xl text-white/70 italic">
                    {book.subtitle}
                  </p>
                )}
              </div>

              {/* Authors */}
              {book.authors && book.authors.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  {book.authors.slice(0, 3).map((author, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-white/70">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium">{author.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {book.first_publish_date && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span className="text-white font-medium">
                      {book.first_publish_date}
                    </span>
                  </div>
                )}
                
                {book.ratings && book.ratings.summary.average && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-amber-400">{book.ratings.summary.average.toFixed(1)}</span>
                    <span className="text-white/50 text-sm">({book.ratings.summary.count} ratings)</span>
                  </div>
                )}

                {book.edition_info.number_of_pages && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <FileText className="w-4 h-4 text-violet-400" />
                    <span className="text-white font-medium">{book.edition_info.number_of_pages} pages</span>
                  </div>
                )}

                {book.editions_count > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{book.editions_count} editions</span>
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

              {/* Reading Log Stats */}
              {book.reading_log && (
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="flex items-center gap-2 text-white/60">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">{book.reading_log.counts.already_read} read</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">{book.reading_log.counts.currently_reading} reading</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <Heart className="w-4 h-4 text-pink-400" />
                    <span className="text-sm">{book.reading_log.counts.want_to_read} want to read</span>
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
                      {book.description || book.work_details?.description || book.first_sentence || 'No description available.'}
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
                      {book.excerpts.map((excerpt, idx) => (
                        <Card key={idx} className="bg-white/5 backdrop-blur-xl border border-white/10">
                          <CardContent className="p-6">
                            <p className="text-white/90 italic leading-relaxed">
                              "{excerpt.text}"
                            </p>
                            {excerpt.comment && (
                              <p className="text-white/50 text-sm mt-3">— {excerpt.comment}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Similar Books */}
                {book.similar_books && book.similar_books.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <ThumbsUp className="w-6 h-6 text-amber-400" />
                      Similar Books
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
                      {book.similar_books.map((similar) => (
                        <Link key={similar.key} href={`/books/${similar.key.replace('/works/', '')}`}>
                          <Card className="group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-amber-500/50 transition-all duration-300 hover:transform hover:scale-105">
                            <div className="aspect-[2/3] relative overflow-hidden bg-slate-800">
                              {similar.cover_id ? (
                                <img 
                                  src={`https://covers.openlibrary.org/b/id/${similar.cover_id}-M.jpg`}
                                  alt={similar.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                                  <BookOpen className="w-10 h-10 text-white/30" />
                                </div>
                              )}
                            </div>
                            <CardContent className="p-3">
                              <p className="font-semibold text-sm text-white truncate">{similar.title}</p>
                              <p className="text-xs text-white/50 truncate">{similar.authors}</p>
                              {similar.first_publish_year && (
                                <p className="text-xs text-white/40 mt-1">{similar.first_publish_year}</p>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === 'contents' && (
              <>
                {/* Table of Contents */}
                {book.table_of_contents && book.table_of_contents.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-amber-400" />
                      Table of Contents
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          {book.table_of_contents.map((item, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0"
                              style={{ paddingLeft: `${(item.level - 1) * 16}px` }}
                            >
                              <span className="text-white/80">{item.title}</span>
                              {item.page && (
                                <span className="text-white/50 text-sm">p. {item.page}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Subject Places */}
                {book.subject_places && book.subject_places.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <MapPin className="w-6 h-6 text-cyan-400" />
                      Places
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {book.subject_places.map((place, idx) => (
                        <Badge key={idx} variant="outline" className="border-white/20 text-white/80">
                          {place}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Subject People */}
                {book.subject_people && book.subject_people.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Users className="w-6 h-6 text-violet-400" />
                      People
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {book.subject_people.map((person, idx) => (
                        <Badge key={idx} variant="outline" className="border-white/20 text-white/80">
                          {person}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Subject Times */}
                {book.subject_times && book.subject_times.length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Clock className="w-6 h-6 text-emerald-400" />
                      Time Periods
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {book.subject_times.map((time, idx) => (
                        <Badge key={idx} variant="outline" className="border-white/20 text-white/80">
                          {time}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === 'editions' && (
              <>
                {/* Edition Details */}
                <section className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-3xl blur-xl" />
                  <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-amber-400" />
                      Edition Details
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {book.edition_info.physical_format && (
                        <div>
                          <span className="text-white/60 text-sm block mb-1">Format</span>
                          <span className="text-white font-medium capitalize">{book.edition_info.physical_format}</span>
                        </div>
                      )}
                      {book.edition_info.number_of_pages && (
                        <div>
                          <span className="text-white/60 text-sm block mb-1">Pages</span>
                          <span className="text-white font-medium">{book.edition_info.number_of_pages}</span>
                        </div>
                      )}
                      {book.edition_info.publish_date && (
                        <div>
                          <span className="text-white/60 text-sm block mb-1">Published</span>
                          <span className="text-white font-medium">{book.edition_info.publish_date}</span>
                        </div>
                      )}
                      {book.edition_info.publishers && book.edition_info.publishers.length > 0 && (
                        <div>
                          <span className="text-white/60 text-sm block mb-1">Publishers</span>
                          <span className="text-white font-medium">{book.edition_info.publishers.join(', ')}</span>
                        </div>
                      )}
                      {book.edition_info.weight && (
                        <div>
                          <span className="text-white/60 text-sm block mb-1">Weight</span>
                          <span className="text-white font-medium">{book.edition_info.weight}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* ISBNs */}
                {(book.edition_info.isbn_10?.length > 0 || book.edition_info.isbn_13?.length > 0) && (
                  <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-blue-400" />
                      ISBNs
                    </h2>
                    <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
                      <CardContent className="p-6 space-y-4">
                        {book.edition_info.isbn_10?.length > 0 && (
                          <div>
                            <span className="text-white/60 text-sm block mb-2">ISBN-10</span>
                            <div className="flex flex-wrap gap-2">
                              {book.edition_info.isbn_10.map((isbn, idx) => (
                                <Badge key={idx} variant="outline" className="border-white/20 text-white/80 font-mono">
                                  {isbn}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {book.edition_info.isbn_13?.length > 0 && (
                          <div>
                            <span className="text-white/60 text-sm block mb-2">ISBN-13</span>
                            <div className="flex flex-wrap gap-2">
                              {book.edition_info.isbn_13.map((isbn, idx) => (
                                <Badge key={idx} variant="outline" className="border-white/20 text-white/80 font-mono">
                                  {isbn}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Author Details */}
            {book.authors && book.authors.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Authors
                </h3>
                <div className="space-y-4">
                  {book.authors.slice(0, 3).map((author, idx) => (
                    <Card key={idx} className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-amber-500/30 transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {author.photo ? (
                            <img 
                              src={author.photo}
                              alt={author.name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                              <Users className="w-8 h-8 text-white" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-white font-semibold">{author.name}</p>
                            {author.birth_date && (
                              <p className="text-white/50 text-sm">
                                {author.birth_date}
                                {author.death_date && ` - ${author.death_date}`}
                              </p>
                            )}
                          </div>
                        </div>
                        {author.bio && (
                          <p className="text-white/70 text-sm mt-3 line-clamp-3">{author.bio}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Links */}
            {book.links && book.links.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-blue-400" />
                  Links
                </h3>
                <div className="space-y-3">
                  {book.links.map((link, idx) => (
                    <a 
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:border-blue-500/50 transition-all duration-300 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white group-hover:text-blue-400 transition-colors font-medium text-sm">{link.title}</span>
                      <ExternalLink className="w-4 h-4 text-white/50 ml-auto group-hover:text-blue-400" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Languages */}
            {book.languages && book.languages.length > 0 && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Languages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {book.languages.map((lang, idx) => (
                    <Badge key={idx} variant="outline" className="border-white/20 text-white/80 capitalize">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Identifiers */}
            {(book.edition_info.lccn?.length > 0 || book.edition_info.oclc?.length > 0) && (
              <section className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-violet-400" />
                  Identifiers
                </h3>
                <div className="space-y-3">
                  {book.edition_info.lccn?.length > 0 && (
                    <div>
                      <span className="text-white/60 text-xs block mb-1">LCCN</span>
                      <span className="text-white/80 text-sm font-mono">{book.edition_info.lccn[0]}</span>
                    </div>
                  )}
                  {book.edition_info.oclc?.length > 0 && (
                    <div>
                      <span className="text-white/60 text-xs block mb-1">OCLC</span>
                      <span className="text-white/80 text-sm font-mono">{book.edition_info.oclc[0]}</span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}