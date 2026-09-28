'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Check, ExternalLink, X } from 'lucide-react';

export interface ArtworkItem {
  id: string;
  title: string;
  year: number | null;
  imageUrl: string | null;
  sourceUrl: string;
  width?: number | null;
  height?: number | null;
  explored?: boolean;
}

interface ArtworkLightboxProps {
  artistName: string;
  images: ArtworkItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onToggleExplored?: () => void;
}

export function ArtworkLightbox({ artistName, images, index, onIndexChange, onClose, onToggleExplored }: ArtworkLightboxProps) {
  const [loadedIndex, setLoadedIndex] = useState<number | null>(null);

  const prev = useCallback(() => onIndexChange((index - 1 + images.length) % images.length), [index, images.length, onIndexChange]);
  const next = useCallback(() => onIndexChange((index + 1) % images.length), [index, images.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'e' && onToggleExplored) onToggleExplored();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, onClose, prev, next, onToggleExplored]);

  const active = images[index];
  if (!active) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${active.title} by ${artistName}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none animate-in fade-in duration-500" />
      {active.imageUrl ? (
        <img
          src={active.imageUrl}
          alt={`${active.title}${active.year ? ` (${active.year})` : ''}`}
          onClick={(e) => e.stopPropagation()}
          onLoad={() => setLoadedIndex(index)}
          className={`relative max-h-[86vh] max-w-[92vw] w-auto h-auto object-contain rounded-lg shadow-2xl select-none transition-opacity duration-300 ${loadedIndex === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <p className="relative text-muted-foreground">No image available for this work.</p>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer (Esc)"
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
      >
        <X className="w-5 h-5" />
      </button>

      {images.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous artwork (Left arrow)" className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-200 text-white">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next artwork (Right arrow)" className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-200 text-white">
            <ChevronRight className="w-7 h-7" />
          </button>
        </>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex max-w-[92vw] items-center gap-3 px-4 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs text-white/80 tabular-nums select-none">
        <span className="max-w-[38vw] truncate font-medium text-white">{active.title}</span>
        {active.year && <span className="text-white/60">{active.year}</span>}
        {active.width && active.height && <span className="hidden text-white/40 sm:inline">{active.width} × {active.height}</span>}
        <span className="text-white/50">{index + 1} / {images.length}</span>
        {onToggleExplored && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExplored(); }}
            aria-pressed={Boolean(active.explored)}
            aria-label={active.explored ? 'Mark not explored (E)' : 'Mark explored (E)'}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-all duration-200 hover:scale-110 ${active.explored ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' : 'bg-white/10 text-white/70 hover:bg-white/25 hover:text-white'}`}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            {active.explored ? 'Explored' : 'Mark explored'} <span className="hidden text-white/40 sm:inline">(E)</span>
          </button>
        )}
        <a href={active.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open original source page" className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-white/70 transition-all duration-200 hover:scale-110 hover:bg-white/25 hover:text-white">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>,
    document.body
  );
}
