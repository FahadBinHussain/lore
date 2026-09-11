'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Star, Calendar, Globe, MapPin,
  Users, Film, Camera, Palette, Mic, Scissors, Shirt, Sparkles,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GalleryLightbox } from '@/components/media/gallery-lightbox';
import {
  FacebookBrandIcon,
  InstagramBrandIcon,
  TwitterBrandIcon,
} from '@/components/icons/social-icons';
import { DetailPageSkeleton } from '@/components/ui/skeleton';

interface CreditItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  character?: string;
  department?: string;
  job?: string;
  poster_path: string | null;
  date: string | null;
  popularity: number;
}

interface PersonProfileImage {
  file_path: string;
  width?: number;
  height?: number;
}

interface PersonDetails {
  id: number;
  name: string;
  also_known_as: string[];
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
  homepage: string | null;
  external_ids: {
    imdb_id: string | null;
    wikidata_id: string | null;
    facebook_id: string | null;
    instagram_id: string | null;
    twitter_id: string | null;
  };  images: PersonProfileImage[];
  credits: { cast: CreditItem[]; crew: CreditItem[] };
}

const DEPARTMENT_META: Record<string, { icon: typeof Film; color: string }> = {
  Directing: { icon: Film, color: 'text-amber-500' },
  Writing: { icon: Palette, color: 'text-violet-400' },
  Production: { icon: Sparkles, color: 'text-emerald-500' },
  Camera: { icon: Camera, color: 'text-cyan-500' },
  Sound: { icon: Mic, color: 'text-pink-500' },
  Editing: { icon: Scissors, color: 'text-indigo-400' },
  'Costume & Make-Up': { icon: Shirt, color: 'text-fuchsia-400' },
  Art: { icon: Palette, color: 'text-lime-500' },
};

function creditHref(credit: CreditItem) {
  return credit.mediaType === 'tv' ? `/tv/${credit.id}` : `/movies/${credit.id}`;
}

function CreditCard({ credit, role }: { credit: CreditItem; role: string }) {
  return (
    <Link href={creditHref(credit)} className="block">
      <Card className="group overflow-hidden bg-card/80 backdrop-blur-xl border border-border/80 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:scale-105 h-full">
        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
          {credit.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w185${credit.poster_path}`}
              alt={credit.title}
              fill
              sizes="(min-width: 1024px) 16vw, 33vw"
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
              <Film className="w-10 h-10 text-muted-foreground/70" />
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm text-foreground truncate">{credit.title}</p>
          <p className="text-xs text-muted-foreground/80 truncate">{role}</p>
          {credit.date && (
            <p className="text-xs text-muted-foreground/60">{credit.date.slice(0, 4)}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function FilmographySection({
  title,
  icon: Icon,
  iconColor,
  items,
  roleOf,
}: {
  title: string;
  icon: typeof Film;
  iconColor: string;
  items: CreditItem[];
  roleOf: (item: CreditItem) => string;
}) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const visible = showAll ? items : items.slice(0, 12);
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
          <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        </h2>
        {items.length > 12 && (
          <Button
            variant="ghost"
            onClick={() => setShowAll(!showAll)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {showAll ? (
              <>Show Less <ChevronUp className="w-4 h-4 ml-2" /></>
            ) : (
              <>Show All ({items.length}) <ChevronDown className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {visible.map((item, idx) => (
          <CreditCard key={`${item.id}-${idx}`} credit={item} role={roleOf(item)} />
        ))}
      </div>
    </section>
  );
}

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  const fetchPerson = useCallback(async () => {
    try {
      const idParam = params.id as string;
      const numericMatch = idParam.match(/(\d+)$/);
      const numericId = numericMatch ? numericMatch[1] : idParam;

      const response = await fetch(`/api/people/${numericId}`);
      if (!response.ok) {
        throw new Error('Person not found');
      }
      const data = (await response.json()) as PersonDetails;
      setPerson(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load person');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPerson();
  }, [fetchPerson]);

  if (loading) return <DetailPageSkeleton />;

  if (error || !person) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <Users className="w-16 h-16 text-muted-foreground/50" />
        <h1 className="text-2xl font-bold text-foreground">Person not found</h1>
        <p className="text-muted-foreground">{error || 'This person could not be loaded.'}</p>
        <Button onClick={() => router.back()} variant="outline" className="hover:scale-105 transition-transform">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const crewDepartments = Object.entries(
    person.credits.crew.reduce<Record<string, CreditItem[]>>((acc, item) => {
      (acc[item.department || 'Other'] ||= []).push(item);
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b.length - a.length);

  const year = (d: string | null) => (d ? d.slice(0, 4) : null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </Link>

        {/* Hero */}
        <Card className="bg-card/80 backdrop-blur-xl border border-border/80 mb-8 overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <div className="w-40 md:w-52 shrink-0 mx-auto md:mx-0">
                <div className="aspect-[2/3] relative rounded-2xl overflow-hidden bg-muted shadow-xl">
                  {person.profile_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${person.profile_path}`}
                      alt={person.name}
                      fill
                      sizes="208px"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                      <Users className="w-20 h-20 text-muted-foreground/70" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground">{person.name}</h1>
                  {person.known_for_department && (
                    <Badge variant="secondary" className="text-sm">
                      {person.known_for_department}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
                  {person.birthday && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      Born {year(person.birthday)}
                      {person.deathday && ` · Died ${year(person.deathday)}`}
                    </span>
                  )}
                  {person.place_of_birth && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary" />
                      {person.place_of_birth}
                    </span>
                  )}
                  {person.popularity > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-primary" />
                      {person.popularity.toFixed(1)} popularity
                    </span>
                  )}
                </div>

                {person.biography ? (
                  <div className="mb-4">
                    <p
                      className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${
                        bioExpanded ? '' : 'line-clamp-4'
                      }`}
                    >
                      {person.biography}
                    </p>
                    {person.biography.length > 280 && (
                      <button
                        type="button"
                        onClick={() => setBioExpanded(!bioExpanded)}
                        className="text-sm text-primary hover:underline mt-1"
                      >
                        {bioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/60 italic mb-4">
                    No biography available yet.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {person.external_ids.imdb_id && (
                    <a
                      href={`https://www.imdb.com/name/${person.external_ids.imdb_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 hover:scale-105 transition-all text-sm font-medium"
                    >
                      IMDb <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {person.external_ids.wikidata_id && (
                    <a
                      href={`https://www.wikidata.org/wiki/${person.external_ids.wikidata_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 hover:scale-105 transition-all text-sm font-medium"
                    >
                      Wikidata <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {person.homepage && (
                    <a
                      href={person.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 hover:scale-105 transition-all text-sm font-medium"
                    >
                      <Globe className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                  {person.external_ids.facebook_id && (
                    <a
                      href={`https://www.facebook.com/${person.external_ids.facebook_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 hover:scale-105 transition-all text-sm font-medium"
                    >
                      <FacebookBrandIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {person.external_ids.instagram_id && (
                    <a
                      href={`https://www.instagram.com/${person.external_ids.instagram_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 hover:scale-105 transition-all text-sm font-medium"
                    >
                      <InstagramBrandIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {person.external_ids.twitter_id && (
                    <a
                      href={`https://twitter.com/${person.external_ids.twitter_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-400/15 text-sky-300 hover:bg-sky-400/25 hover:scale-105 transition-all text-sm font-medium"
                    >
                      <TwitterBrandIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-10">
          <FilmographySection
            title="Acting"
            icon={Users}
            iconColor="text-accent"
            items={person.credits.cast}
            roleOf={(c) => c.character || ''}
          />

          {crewDepartments.map(([department, items]) => {
            const meta = DEPARTMENT_META[department] || { icon: Film, color: 'text-slate-400' };
            return (
              <FilmographySection
                key={department}
                title={department}
                icon={meta.icon}
                iconColor={meta.color}
                items={items}
                roleOf={(c) => c.job || ''}
              />
            );
          })}
        </div>

        {person.images.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
              <Camera className="w-6 h-6 text-secondary" />
              Photos
            </h2>
            <GalleryLightbox
              title={person.name}
              gridClassName="grid grid-cols-3 md:grid-cols-6 gap-4"
              images={person.images.map((img) => ({
                src: `https://image.tmdb.org/t/p/w342${img.file_path}`,
                full: `https://image.tmdb.org/t/p/original${img.file_path}`,
                width: img.width,
                height: img.height,
              }))}
            />
          </section>
        )}
      </div>
    </div>
  );
}
