'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ExternalLink, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';
import { ArtworkLightbox } from '@/components/media/artwork-lightbox';

type Artist = { id?: number; slug: string; name: string; imageUrl?: string | null; biography?: string; birthYear?: number | null; deathYear?: number | null; sourceUrl?: string; artworkCount?: number | null; lastSyncedAt?: string | null };
type Painting = { id: string; title: string; year: number | null; imageUrl: string | null; sourceUrl: string; width?: number | null; height?: number | null; explored?: boolean };

const STALE_DAYS = 30;

function staleDays(lastSyncedAt?: string | null): number | null {
  if (!lastSyncedAt) return null;
  const ms = Date.now() - new Date(lastSyncedAt).getTime();
  return Math.floor(ms / 86_400_000);
}

function lifeSpan(birth?: number | null, death?: number | null): string {
  const alive = death !== null && death !== undefined && death >= 9000;
  const b = birth ?? null;
  const d = alive ? null : death ?? null;
  if (b && d) return `${b} – ${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return 'Contemporary artist';
}

export default function ArtistDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [paintings, setPaintings] = useState<Painting[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [explored, setExplored] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [exploredCount, setExploredCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { fetch(`/api/artists/${encodeURIComponent(slug)}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setArtist(d.artist); setPaintings(d.paintings || []); setTotal(d.total ?? (d.paintings || []).length); setTruncated(Boolean(d.truncated)); setExplored(d.isExplored); setIsAuto(Boolean(d.isAuto)); setExploredCount(d.exploredCount ?? 0); }).catch((e) => setError(e.message)); }, [slug]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const r = await fetch(`/api/artists/${encodeURIComponent(slug)}?offset=${paintings.length}`);
    const d = await r.json();
    setLoadingMore(false);
    if (!r.ok) return setError(d.error);
    setPaintings((prev) => [...prev, ...(d.paintings || [])]);
    setTruncated(Boolean(d.truncated));
  }, [slug, paintings.length]);

  const toggleArtist = useCallback(async () => {
    setSaving(true);
    const r = await fetch(`/api/artists/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isExplored: !explored, artistId: artist?.id, name: artist?.name }) });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) return setError(d.error);
    setExplored(!explored);
    setIsAuto(false);
  }, [slug, explored, artist]);

  const toggleArtwork = useCallback(async (painting: Painting) => {
    const next = !painting.explored;
    setPaintings((prev) => prev.map((p) => (p.id === painting.id ? { ...p, explored: next } : p)));
    setExploredCount((c) => c + (next ? 1 : -1));
    const r = await fetch(`/api/artists/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId: Number(painting.id), isExplored: next }) });
    const d = await r.json();
    if (!r.ok) {
      setPaintings((prev) => prev.map((p) => (p.id === painting.id ? { ...p, explored: !next } : p)));
      setExploredCount((c) => c + (next ? -1 : 1));
      return setError(d.error);
    }
    setExploredCount(d.explored);
    setTotal(d.total);
    setExplored(d.artistExplored);
    setIsAuto(d.artistIsAuto);
  }, [slug]);

  if (error) return <main className="container mx-auto max-w-5xl px-4 py-12"><div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive">{error}</div></main>;
  if (!artist) return <main className="container mx-auto max-w-5xl px-4 py-12 text-muted-foreground">Loading artist…</main>;
  const stale = staleDays(artist.lastSyncedAt);
  const noWorks = total === 0;
  const allExplored = total > 0 && exploredCount >= total;
  return (
    <main className="container mx-auto max-w-7xl px-4 py-10">
      <Link href="/artists" className="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Artists</Link>
      <Card className="mb-10 overflow-hidden">
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:p-8">
          <div className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl bg-muted">{artist.imageUrl ? <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Palette className="h-16 w-16 text-muted-foreground/40" /></div>}</div>
          <div className="flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3"><h1 className="text-4xl font-bold">{artist.name}</h1>{explored && <Badge className={isAuto ? 'animate-pulse' : ''}>{isAuto ? 'Explored · auto' : 'Explored'}</Badge>}{stale !== null && stale >= STALE_DAYS && <Badge variant="destructive" className="animate-pulse">STALE · synced {stale}d ago</Badge>}</div>
            <p className="mb-5 text-muted-foreground">{lifeSpan(artist.birthYear, artist.deathYear)}</p>
            {artist.biography && <p className="mb-5 max-w-3xl whitespace-pre-line text-muted-foreground">{artist.biography}</p>}
            <div className="flex flex-wrap gap-3">
              <Button onClick={toggleArtist} disabled={saving}><Sparkles className="mr-2 h-4 w-4 animate-pulse" />{explored ? 'Mark unexplored' : 'Mark explored'}</Button>
              {artist.sourceUrl && <a href={artist.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted">WikiArt <ExternalLink className="h-4 w-4" /></a>}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">Works <span className="text-base font-normal text-muted-foreground">({total})</span></h2>
        {total > 0 && (
          <span className={`rounded-md border px-2 py-1 text-xs tabular-nums ${allExplored ? 'border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-600' : 'border-primary/40 bg-primary/10 text-primary'}`}>
            {exploredCount} / {total} explored{allExplored && !explored ? ' — artist auto-marked' : ''}
          </span>
        )}
        {truncated && (
          <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-600 transition-all hover:scale-105 disabled:opacity-60">
            {loadingMore ? 'Loading…' : `Showing ${paintings.length} of ${total} — load more`}
          </button>
        )}
        {noWorks && <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">NO WORKS ON SOURCE — WikiArt reports 0 paintings for this artist (site-side restriction, not a sync failure)</span>}
      </div>
      {noWorks ? (
        <p className="text-muted-foreground">This artist row exists, but the source catalog has no displayable paintings. Nothing to track here yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {paintings.map((painting, idx) => (
            <div key={painting.id} className="group relative">
              <button type="button" onClick={() => setOpenIndex(idx)} className="w-full text-left cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Card className={`group h-full overflow-hidden transition-all ${painting.explored ? 'border-emerald-500/50 opacity-70 hover:opacity-100' : 'hover:border-primary/50'}`}>
                  <div className="aspect-[4/3] bg-muted">{painting.imageUrl ? <img src={painting.imageUrl} alt={painting.title} loading="lazy" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Palette className="h-8 w-8 text-muted-foreground/40" /></div>}</div>
                  <CardContent className="p-3"><p className="truncate text-sm font-medium">{painting.title}</p><p className="text-xs text-muted-foreground">{painting.year ?? '—'}</p></CardContent>
                </Card>
              </button>
              <button
                type="button"
                onClick={() => toggleArtwork(painting)}
                aria-pressed={Boolean(painting.explored)}
                aria-label={painting.explored ? `Mark ${painting.title} not explored` : `Mark ${painting.title} explored`}
                className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-all duration-200 hover:scale-110 active:scale-95 ${painting.explored ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' : 'border-white/40 bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {openIndex !== null && paintings[openIndex] && (
        <ArtworkLightbox artistName={artist.name} images={paintings} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} onToggleExplored={() => toggleArtwork(paintings[openIndex])} />
      )}
    </main>
  );
}
