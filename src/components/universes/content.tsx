'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Universe {
  id: number;
  slug: string;
  name: string;
  description: string;
  bannerImage: string | null;
  coverImage: string | null;
  items: Array<{
    mediaItem: {
      id: number;
      source: string | null;
      backdropPath: string | null;
    };
  }>;
  progress?: number;
  itemsCompleted?: number;
  itemsTotal?: number;
}

interface UniversesContentProps {
  initialUniverses?: Universe[];
}

function toImageUrl(path: string | null, source: string | null, size: 'w780' | 'w1280' = 'w780'): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/t/p/')) return `https://image.tmdb.org${trimmed}`;
  if (source === 'anilist' && trimmed.startsWith('/file/')) return `https://s4.anilist.co${trimmed}`;
  if (trimmed.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${trimmed}`;
  return trimmed;
}

function getUniverseHeroImage(universe: Universe, size: 'w780' | 'w1280' = 'w780'): string | null {
  const firstBackdropItem = universe.items.find((item) => item.mediaItem.backdropPath);
  return (
    toImageUrl(universe.bannerImage, 'tmdb', size) ||
    toImageUrl(universe.coverImage, 'tmdb', size) ||
    toImageUrl(firstBackdropItem?.mediaItem.backdropPath ?? null, firstBackdropItem?.mediaItem.source ?? null, size)
  );
}

function getVariant(index: number): 'primary' | 'secondary' | 'tertiary' {
  const variants: Array<'primary' | 'secondary' | 'tertiary'> = ['primary', 'secondary', 'tertiary', 'primary', 'secondary'];
  return variants[index % variants.length];
}

function variantTextClass(variant: 'primary' | 'secondary' | 'tertiary'): string {
  if (variant === 'secondary') return 'text-secondary';
  if (variant === 'tertiary') return 'text-tertiary';
  return 'text-primary';
}

export function UniversesContent({ initialUniverses = [] }: UniversesContentProps) {
  const router = useRouter();
  const [universes, setUniverses] = useState<Universe[]>(initialUniverses);
  const [loading, setLoading] = useState(initialUniverses.length === 0);
  const [error, setError] = useState<string | null>(null);

  const fetchUniverses = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/universes', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch universes');
      }
      setUniverses(data.collections || []);
    } catch (err) {
      console.error('Failed to fetch universes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch universes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUniverses();
  }, [fetchUniverses]);

  const heroImage = universes.length > 0 ? getUniverseHeroImage(universes[0], 'w1280') : null;

  useEffect(() => {
    const handlePageShow = () => {
      fetchUniverses();
    };
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePageShow);
    };
  }, [fetchUniverses]);

  return (
    <div className="bg-background text-on-background font-body selection:bg-primary/30">
      <main className="pt-8 pb-32">
        <section className="relative h-[614px] min-h-[500px] flex items-center px-6 md:px-12 overflow-hidden mx-4 md:mx-10 rounded-3xl">
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <Image className="w-full h-full object-cover opacity-60" alt="universe hero" src={heroImage} fill sizes="100vw" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
          </div>
          <div className="relative z-10 max-w-3xl">
            <span className="inline-block px-4 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest mb-6 font-label">EXPLORE THE ARCHIVE</span>
            <h1 className="text-6xl md:text-8xl font-headline font-extrabold tracking-tight text-on-background mb-6 leading-[0.9]">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-tertiary">Multiverse</span>
            </h1>
            <p className="text-on-surface-variant text-lg md:text-xl max-w-xl font-body leading-relaxed">
              Traverse across infinite dimensions. From neon-soaked streets to high-fantasy realms, track every legend born within these interconnected worlds.
            </p>
            <div className="flex gap-4 mt-8">
              <button className="bg-gradient-to-br from-primary to-primary-dim text-on-primary-fixed font-bold px-8 py-3 rounded-full hover:scale-105 transition-transform" type="button">Begin Journey</button>
              <button className="bg-surface-container-highest/40 backdrop-blur-md border border-outline-variant/20 text-on-surface font-bold px-8 py-3 rounded-full hover:bg-surface-container-highest/60 transition-colors" type="button">Manifesto</button>
            </div>
          </div>
        </section>

        <section className="px-6 md:px-12 mt-12 mb-10 overflow-x-auto">
          <div className="flex items-center gap-3 no-scrollbar">
            <span className="text-on-surface-variant font-bold text-sm mr-4 whitespace-nowrap">FILTER BY GENRE:</span>
            <button className="px-6 py-2 rounded-full bg-primary text-on-primary-fixed text-sm font-bold shadow-lg shadow-primary/20 whitespace-nowrap" type="button">All Realms</button>
            <button className="px-6 py-2 rounded-full bg-surface-container-high border border-outline-variant/15 text-on-surface-variant text-sm font-bold hover:border-primary/40 transition-all whitespace-nowrap" type="button">Sci-Fi</button>
            <button className="px-6 py-2 rounded-full bg-surface-container-high border border-outline-variant/15 text-on-surface-variant text-sm font-bold hover:border-primary/40 transition-all whitespace-nowrap" type="button">Fantasy</button>
            <button className="px-6 py-2 rounded-full bg-surface-container-high border border-outline-variant/15 text-on-surface-variant text-sm font-bold hover:border-primary/40 transition-all whitespace-nowrap" type="button">Cyberpunk</button>
            <button className="px-6 py-2 rounded-full bg-surface-container-high border border-outline-variant/15 text-on-surface-variant text-sm font-bold hover:border-primary/40 transition-all whitespace-nowrap" type="button">Mystery</button>
            <button className="px-6 py-2 rounded-full bg-surface-container-high border border-outline-variant/15 text-on-surface-variant text-sm font-bold hover:border-primary/40 transition-all whitespace-nowrap" type="button">Noir</button>
          </div>
        </section>

        <section className="px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {!loading && universes.map((universe, index) => {
            const variant = getVariant(index);
            const progress = universe.progress || 0;
            const image = getUniverseHeroImage(universe, 'w780');
            const total = universe.itemsTotal || universe.items.length;
            return (
              <div
                key={universe.id}
                className="group glass-card rounded-3xl overflow-hidden glow-hover transition-all duration-500 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/universes/${universe.slug || universe.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    router.push(`/universes/${universe.slug || universe.id}`);
                  }
                }}
              >
                <div className="relative h-64 overflow-hidden">
                  {image ? (
                    <Image className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={universe.name} src={image} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
                  )}
                  <div className="absolute top-4 right-4 bg-surface-container-lowest/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="text-xs font-bold">{progress}% completed</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`text-2xl font-headline font-bold text-on-surface ${variant === 'primary' ? 'group-hover:text-primary' : variant === 'secondary' ? 'group-hover:text-secondary' : 'group-hover:text-tertiary'} transition-colors`}>{universe.name}</h3>
                  </div>
                  <p className="text-on-surface-variant text-sm line-clamp-2 mb-6 font-body">{universe.description || 'No description available yet.'}</p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">
                      <span>Progress</span>
                      <span>{universe.itemsCompleted || 0} / {total} Completed</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-primary/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">{total} TITLES</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/universes/${universe.slug || universe.id}`);
                      }}
                      className={`${variantTextClass(variant)} hover:translate-x-1 transition-transform flex items-center gap-1 font-bold text-sm`}
                    >
                      EXPLORE <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <Link href="/universes/create" className="group border-2 border-dashed border-outline-variant/30 rounded-3xl flex flex-col items-center justify-center p-12 hover:border-primary/50 transition-colors bg-surface-container-low/20">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-3xl text-primary">add</span>
            </div>
            <h3 className="text-xl font-bold font-headline mb-2">Forge New Realm</h3>
            <p className="text-on-surface-variant text-center text-sm font-body">Contribute a new universe to the archive and begin its legacy.</p>
          </Link>

          {!loading && universes.length === 0 && (
            <div className="col-span-full rounded-2xl border border-outline-variant/20 bg-surface-container p-8 text-center">
              <p className="text-on-surface-variant text-sm">
                {error || 'No universes found right now.'}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
