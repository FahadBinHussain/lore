'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Palette, Search, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Artist = { id?: number; slug: string; name: string; imageUrl?: string | null; isExplored?: boolean };

export default function ArtistsPage() {
  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/artists${query.trim() ? `?q=${encodeURIComponent(query)}` : ''}`).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setArtists(data.artists || []); }).catch((e) => setError(e.message)); }, [query]);
  return <main className="container mx-auto max-w-7xl px-4 py-10">
    <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5 animate-pulse" /><span className="text-sm font-semibold uppercase tracking-widest">Artist tracker</span></div><h1 className="text-4xl font-bold">Explore artists</h1><p className="mt-2 text-muted-foreground">Track artists you’ve explored and browse their WikiArt catalog.</p></div>
      <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search WikiArt artists" className="w-full rounded-xl border bg-background px-10 py-3 outline-none focus:ring-2 focus:ring-primary" /></div>
    </div>
    {error && <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{artists.map((artist) => <Link href={`/artists/${artist.slug}`} key={`${artist.slug}-${artist.id || 'remote'}`}><Card className="group h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-primary/50"><div className="aspect-square bg-muted">{artist.imageUrl ? <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Palette className="h-12 w-12 text-muted-foreground/40" /></div>}</div><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{artist.name}</p>{artist.isExplored && <Badge variant="secondary">Explored</Badge>}</div></CardContent></Card></Link>)}</div>
  </main>;
}
