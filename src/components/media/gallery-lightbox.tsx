'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface GalleryItem {
  src: string;
  full?: string;
  width?: number;
  height?: number;
}

interface GalleryLightboxProps {
  title: string;
  images: GalleryItem[];
  gridClassName?: string;
}

export function GalleryLightbox({
  title,
  images,
  gridClassName = 'grid grid-cols-2 md:grid-cols-4 gap-4',
}: GalleryLightboxProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isOpen = activeIndex !== null;

  const close = useCallback(() => setActiveIndex(null), []);
  const showPrev = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)),
    [images.length]
  );
  const showNext = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i + 1) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close, showPrev, showNext]);

  if (images.length === 0) return null;

  const active = isOpen ? images[activeIndex] : null;

  return (
    <>
      <div className={gridClassName}>
        {images.map((image, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveIndex(idx)}
            aria-label={`Open ${title} photo ${idx + 1} of ${images.length}`}
            className="relative aspect-video rounded-lg overflow-hidden bg-muted hover:scale-105 transition-transform duration-300 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <Image
              src={image.src}
              alt={`${title} photo ${idx + 1}`}
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photo viewer`}
          onClick={close}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 shrink-0">
            <p className="text-sm text-white/80 truncate">
              {title}
              <span className="text-white/50 ml-2 tabular-nums">
                {(activeIndex ?? 0) + 1} / {images.length}
              </span>
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close photo viewer"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <figure
            onClick={(e) => e.stopPropagation()}
            className="relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-16"
          >
            <img
              src={active.full ?? active.src}
              alt={`${title} photo ${(activeIndex ?? 0) + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrev}
                  aria-label="Previous photo"
                  className="absolute left-2 md:left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label="Next photo"
                  className="absolute right-2 md:right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </figure>

          {active.width && active.height && (
            <p
              onClick={(e) => e.stopPropagation()}
              className="text-center text-xs text-white/40 py-2 shrink-0 tabular-nums"
            >
              {active.width} × {active.height}
            </p>
          )}
        </div>
      )}
    </>
  );
}
