import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, inArray, or } from 'drizzle-orm';
import { Star, BookOpen, Users, Gem } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collectionItems, collections, userMediaProgress } from '@/db/schema';
import { HeroDebugLog } from '@/components/universes/hero-debug-log';

interface UniversePageProps {
  params: Promise<{ slug: string }>;
}

function toImageUrl(path: string | null, source: string | null, size: 'w342' | 'w1280' = 'w342'): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  if (path.startsWith('//')) return `https:${path}`;
  if (path.startsWith('/t/p/')) return `https://image.tmdb.org${path}`;
  if (source === 'anilist' && path.startsWith('/file/')) return `https://s4.anilist.co${path}`;
  if (path.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${path}`;
  return path;
}

function getMediaHref(mediaType: string, externalId: string): string | null {
  if (!externalId) return null;
  if (mediaType === 'movie') return `/movies/${externalId}`;
  if (mediaType === 'tv') return `/tv/${externalId}`;
  if (mediaType === 'anime') return `/anime/${externalId}`;
  if (mediaType === 'game') return `/games/${externalId}`;
  if (mediaType === 'book') return `/books/${externalId}`;
  return null;
}

function formatReleaseDate(value: Date | string | null): string {
  if (!value) return 'Unknown date';

  let date: Date;
  if (typeof value === 'string') {
    const plainDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    date = plainDateMatch ? new Date(`${value}T00:00:00Z`) : new Date(value);
  } else {
    date = value;
  }

  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatMediaType(type: string): string {
  return type.replace('_', ' ').toUpperCase();
}

export default async function Page({ params }: UniversePageProps) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  const { slug } = await params;
  const maybeId = Number.parseInt(slug, 10);

  const universe = await db.query.collections.findFirst({
    where: and(
      eq(collections.visibility, 'public'),
      Number.isNaN(maybeId) ? eq(collections.slug, slug) : or(eq(collections.slug, slug), eq(collections.id, maybeId))
    ),
    with: {
      creator: { columns: { name: true } },
      items: {
        orderBy: collectionItems.releaseOrder,
        with: { mediaItem: true },
      },
    },
  });

  if (!universe) notFound();

  const mediaItemIds = universe.items.map((item) => item.mediaItem.id);
  const progressRows =
    mediaItemIds.length > 0
      ? await db.query.userMediaProgress.findMany({
          where: and(
            eq(userMediaProgress.userId, Number.parseInt(session.user.id, 10)),
            inArray(userMediaProgress.mediaItemId, mediaItemIds)
          ),
          columns: {
            mediaItemId: true,
            status: true,
          },
        })
      : [];
  const watchedMediaIds = new Set(
    progressRows
      .filter((row) => row.status !== 'not_started')
      .map((row) => row.mediaItemId)
  );

  const firstBackdropItem = universe.items.find((x) => x.mediaItem.backdropPath);
  const heroImage =
    toImageUrl(universe.bannerImage, 'tmdb', 'w1280') ||
    toImageUrl(universe.coverImage, 'tmdb', 'w1280') ||
    toImageUrl(firstBackdropItem?.mediaItem.backdropPath ?? null, firstBackdropItem?.mediaItem.source ?? null, 'w1280');

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-manrope)] overflow-x-hidden">
      <HeroDebugLog
        universeSlug={universe.slug}
        universeName={universe.name}
        bannerImage={universe.bannerImage}
        coverImage={universe.coverImage}
        firstBackdropItem={firstBackdropItem ? {
          id: firstBackdropItem.mediaItem.id,
          title: firstBackdropItem.mediaItem.title,
          mediaType: firstBackdropItem.mediaItem.mediaType,
          source: firstBackdropItem.mediaItem.source,
          backdropPath: firstBackdropItem.mediaItem.backdropPath,
        } : null}
        resolvedHeroImage={heroImage}
      />
      <main className="pb-32">
        <section className="relative h-[716px] w-full flex items-end overflow-hidden">
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <img src={heroImage} alt={`${universe.name} hero`} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/60 to-transparent" />
          </div>
          <div className="relative z-10 px-6 md:px-12 pb-16 max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase rounded-sm">Curated Universe</span>
              {universe.creator?.name ? <span className="text-base-content/70 text-xs font-medium">by {universe.creator.name}</span> : null}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-[family-name:var(--font-epilogue)] mb-6 tracking-tight">{universe.name}</h1>
            <p className="text-lg text-base-content/80 leading-relaxed mb-8 max-w-2xl">{universe.description || 'Explore this universe timeline in release order.'}</p>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col">
                <span className="text-primary font-bold text-2xl">{universe.items.length}</span>
                <span className="text-base-content/60 text-xs uppercase tracking-widest font-bold">Titles</span>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 md:px-12 py-24 relative max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-[family-name:var(--font-epilogue)] mb-4">Release Timeline</h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
          </div>
          <div className="relative">
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent -translate-x-1/2 opacity-30" />

            {universe.items.map((item, index) => {
              const reverse = index % 2 === 1;
              const poster = toImageUrl(item.mediaItem.posterPath, item.mediaItem.source, 'w342');
              const href = getMediaHref(item.mediaItem.mediaType, item.mediaItem.externalId);
              const releaseDate = formatReleaseDate(item.mediaItem.releaseDate);
              const isWatched = watchedMediaIds.has(item.mediaItem.id);

              return (
                <div key={item.id} className={`relative mb-24 flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center justify-between w-full`}>
                  <div className="hidden md:block w-5/12" />
                  <div className="z-20 w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center mb-6 md:mb-0">
                    {isWatched ? <div className="w-2 h-2 rounded-full bg-primary" /> : null}
                  </div>
                  <div className="w-full md:w-5/12 pl-12 md:pl-0">
                    <div className="bg-base-200/60 backdrop-blur-xl p-6 rounded-xl border border-base-content/10 hover:border-primary/30 transition-all group">
                      <span className={`text-primary text-sm font-bold tracking-tighter mb-1 block ${reverse ? 'text-right md:text-left' : ''}`}>{releaseDate}</span>
                      <div className={`flex gap-4 ${reverse ? 'flex-row-reverse md:flex-row' : ''}`}>
                        <div className="w-24 h-36 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {poster ? (
                            <img
                              src={poster}
                              alt={item.mediaItem.title}
                              className="h-full w-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700"
                            />
                          ) : (
                            <div className="h-full w-full bg-base-300" />
                          )}
                        </div>
                        <div className={`${reverse ? 'text-right md:text-left flex-grow' : ''}`}>
                          {href ? (
                            <Link href={href} scroll className="text-xl font-[family-name:var(--font-epilogue)] mb-2 group-hover:text-primary transition-colors block">
                              {item.mediaItem.title}
                            </Link>
                          ) : (
                            <h3 className="text-xl font-[family-name:var(--font-epilogue)] mb-2 group-hover:text-primary transition-colors">
                              {item.mediaItem.title}
                            </h3>
                          )}
                          <span className="inline-block px-2 py-0.5 bg-base-300 text-base-content/70 text-[10px] font-bold rounded mb-2">
                            {formatMediaType(item.mediaItem.mediaType)}
                          </span>
                          <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
                            {item.mediaItem.description || 'No description available yet.'}
                          </p>
                          {item.mediaItem.rating ? (
                            <div className={`flex items-center gap-2 text-yellow-500 ${reverse ? 'justify-end md:justify-start' : ''}`}>
                              <Star className="w-4 h-4" fill="currentColor" />
                              <span className="text-xs font-bold">{Number(item.mediaItem.rating).toFixed(1)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-base-200 p-8 rounded-xl border border-base-content/10">
              <BookOpen className="text-primary mb-4 w-8 h-8" />
              <h4 className="text-lg font-[family-name:var(--font-epilogue)] mb-2">Universe Notes</h4>
              <p className="text-sm text-base-content/80">Release-ordered timeline powered from your collection data.</p>
            </div>
            <div className="bg-base-200 p-8 rounded-xl border border-base-content/10">
              <Users className="text-primary mb-4 w-8 h-8" />
              <h4 className="text-lg font-[family-name:var(--font-epilogue)] mb-2">Created By</h4>
              <p className="text-sm text-base-content/80">{universe.creator?.name || 'Unknown creator'}</p>
            </div>
            <div className="bg-base-200 p-8 rounded-xl border border-base-content/10">
              <Gem className="text-primary mb-4 w-8 h-8" />
              <h4 className="text-lg font-[family-name:var(--font-epilogue)] mb-2">Collection Size</h4>
              <p className="text-sm text-base-content/80">{universe.items.length} items in this universe.</p>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
