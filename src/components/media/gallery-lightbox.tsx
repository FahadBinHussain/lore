'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef<HTMLElement | null>(null);

  const isOpen = activeIndex !== null;

  const openImage = useCallback((idx: number, el: HTMLElement | null) => {
    triggerRef.current = el;
    setActiveIndex(idx);
  }, []);

  const close = useCallback(() => {
    setActiveIndex(null);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    triggerRef.current = null;
  }, []);

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
            onClick={(e) => openImage(idx, e.currentTarget)}
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

      {active &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} photo viewer`}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <img
              src={active.full ?? active.src}
              alt={`${title} photo ${(activeIndex ?? 0) + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[92vw] w-auto h-auto object-contain rounded-lg shadow-2xl select-none"
            />

            <button
              type="button"
              onClick={close}
              aria-label="Close photo viewer (Esc)"
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showPrev();
                  }}
                  aria-label="Previous photo (Left arrow)"
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showNext();
                  }}
                  aria-label="Next photo (Right arrow)"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-200 text-white"
                >
                  <ChevronRight className="w-7 h-7" />
                </button>
              </>
            )}

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs text-white/80 tabular-nums select-none">
              <span className="max-w-[40vw] truncate">{title}</span>
              <span className="text-white/50">
                {(activeIndex ?? 0) + 1} / {images.length}
              </span>
              {active.width && active.height && (
                <span className="text-white/40">
                  {active.width} × {active.height}
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
