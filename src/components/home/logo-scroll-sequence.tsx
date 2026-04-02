'use client';

import { useEffect, useRef, useState } from 'react';

type FrameSource = ImageBitmap | HTMLImageElement;

const MAX_RENDER_DPR = 2;
const LOAD_CONCURRENCY = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFrameDimensions(frame: FrameSource) {
  if ('naturalWidth' in frame) {
    return {
      width: frame.naturalWidth,
      height: frame.naturalHeight,
    };
  }

  return {
    width: frame.width,
    height: frame.height,
  };
}

async function loadFrameSource(url: string): Promise<FrameSource | null> {
  if ('createImageBitmap' in window) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (response.ok) {
        const blob = await response.blob();
        return await createImageBitmap(blob);
      }
    } catch {
      // Fallback to HTMLImageElement decoding when ImageBitmap decoding fails.
    }
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
  });
}

function disposeFrameSource(frame: FrameSource | null) {
  if (!frame) return;

  if ('close' in frame && typeof frame.close === 'function') {
    frame.close();
  }
}

export function LogoScrollSequence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameSourcesRef = useRef<Array<FrameSource | null>>([]);
  const frameUrlsRef = useRef<string[]>([]);
  const currentFrameRef = useRef(-1);
  const sectionTopRef = useRef(0);
  const scrollDistanceRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const [frameUrls, setFrameUrls] = useState<string[]>([]);

  const ensureCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
    const pixelWidth = Math.floor(width * dpr);
    const pixelHeight = Math.floor(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    if (!contextRef.current) {
      contextRef.current = canvas.getContext('2d', { alpha: true, desynchronized: true });
      if (contextRef.current) {
        contextRef.current.imageSmoothingEnabled = true;
        contextRef.current.imageSmoothingQuality = 'high';
      }
    }

    const ctx = contextRef.current;
    if (!ctx) return null;

    return { width, height, dpr, ctx };
  };

  const drawFrame = (frameIndex: number) => {
    const frameSource = frameSourcesRef.current[frameIndex];
    if (!frameSource) return;

    const canvasState = ensureCanvas();
    if (!canvasState) return;

    const { width, height, dpr, ctx } = canvasState;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const { width: frameWidth, height: frameHeight } = getFrameDimensions(frameSource);
    if (frameWidth === 0 || frameHeight === 0) return;

    const imageAspect = frameWidth / frameHeight;
    const canvasAspect = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > canvasAspect) {
      drawHeight = height;
      drawWidth = drawHeight * imageAspect;
      offsetX = (width - drawWidth) / 2;
    } else {
      drawWidth = width;
      drawHeight = drawWidth / imageAspect;
      offsetY = (height - drawHeight) / 2;
    }

    ctx.drawImage(frameSource, offsetX, offsetY, drawWidth, drawHeight);
    currentFrameRef.current = frameIndex;
  };

  const updateSectionMetrics = () => {
    const container = containerRef.current;
    if (!container) return;

    const heroSection = container.closest('section');
    if (!heroSection) return;

    const sectionTop = heroSection.getBoundingClientRect().top + window.scrollY;
    const scrollDistance = Math.max(1, heroSection.scrollHeight - window.innerHeight);

    sectionTopRef.current = sectionTop;
    scrollDistanceRef.current = scrollDistance;
  };

  const getTargetFrame = () => {
    const totalFrames = frameUrlsRef.current.length;
    if (totalFrames === 0) return -1;

    const progress = clamp(
      (window.scrollY - sectionTopRef.current) / scrollDistanceRef.current,
      0,
      1
    );

    return Math.round(progress * (totalFrames - 1));
  };

  const getBestAvailableFrame = (targetFrame: number) => {
    const frames = frameSourcesRef.current;
    if (targetFrame < 0 || targetFrame >= frames.length) return -1;
    if (frames[targetFrame]) return targetFrame;

    for (let offset = 1; offset < frames.length; offset += 1) {
      const previous = targetFrame - offset;
      if (previous >= 0 && frames[previous]) {
        return previous;
      }

      const next = targetFrame + offset;
      if (next < frames.length && frames[next]) {
        return next;
      }
    }

    return -1;
  };

  useEffect(() => {
    let isMounted = true;

    const loadSequence = async () => {
      try {
        const response = await fetch('/api/scroll-sequence', { cache: 'no-store' });
        if (!response.ok) return;

        const data = (await response.json()) as { frames?: string[] };
        if (!isMounted) return;

        setFrameUrls(Array.isArray(data.frames) ? data.frames : []);
      } catch (error) {
        console.error('Failed to load scroll-sequence frames:', error);
      }
    };

    loadSequence();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (frameUrls.length === 0) return;

    let isCanceled = false;
    frameUrlsRef.current = frameUrls;
    frameSourcesRef.current = new Array(frameUrls.length).fill(null);
    currentFrameRef.current = -1;

    const loadFrameAtIndex = async (index: number) => {
      const source = await loadFrameSource(frameUrls[index]);
      if (isCanceled) {
        disposeFrameSource(source);
        return;
      }

      frameSourcesRef.current[index] = source;

      if (index === 0) {
        drawFrame(0);
        return;
      }

      const targetFrame = getTargetFrame();
      if (targetFrame === index) {
        drawFrame(index);
      }
    };

    const preloadFrames = async () => {
      await loadFrameAtIndex(0);

      let nextIndex = 1;
      const workers = Array.from({ length: LOAD_CONCURRENCY }, async () => {
        while (!isCanceled && nextIndex < frameUrls.length) {
          const index = nextIndex;
          nextIndex += 1;
          await loadFrameAtIndex(index);
        }
      });

      await Promise.all(workers);
    };

    const renderLoop = () => {
      rafRef.current = window.requestAnimationFrame(renderLoop);

      const targetFrame = getTargetFrame();
      if (targetFrame < 0) return;

      const frame = getBestAvailableFrame(targetFrame);
      if (frame < 0 || frame === currentFrameRef.current) return;

      drawFrame(frame);
    };

    const handleResize = () => {
      updateSectionMetrics();
      if (currentFrameRef.current >= 0) {
        drawFrame(currentFrameRef.current);
      }
    };

    updateSectionMetrics();
    handleResize();
    preloadFrames();
    rafRef.current = window.requestAnimationFrame(renderLoop);

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      isCanceled = true;

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);

      for (const source of frameSourcesRef.current) {
        disposeFrameSource(source);
      }

      frameSourcesRef.current = [];
      frameUrlsRef.current = [];
      contextRef.current = null;
    };
  }, [frameUrls]);

  if (frameUrls.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 z-[1] pointer-events-none"
    >
      <canvas ref={canvasRef} className="w-full h-full opacity-70 sm:opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-background/15 to-background/45" />
    </div>
  );
}
