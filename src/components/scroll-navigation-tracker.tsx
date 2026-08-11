'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const SCROLL_STORAGE_PREFIX = 'lore:scroll:';
const RESTORE_WINDOW_MS = 2500;
const RESTORE_INTERVAL_MS = 120;

function toRouteKey(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

function getCurrentRouteKey(): string {
  if (typeof window === 'undefined') return '/';
  return toRouteKey(window.location.pathname, window.location.search.slice(1));
}

function shouldRestoreInitialScroll(): boolean {
  if (typeof window === 'undefined') return false;
  const navigation = window.performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === 'reload' || navigation?.type === 'back_forward';
}

export function ScrollNavigationTracker() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();

  const isPopNavigationRef = useRef(false);
  const isRestoringRef = useRef(false);
  const shouldRestoreInitialRef = useRef(shouldRestoreInitialScroll());
  const currentRouteKeyRef = useRef<string>(getCurrentRouteKey());

  const routeKey = useMemo(() => {
    const search = searchParams?.toString() || '';
    return toRouteKey(pathname, search);
  }, [pathname, searchParams]);

  useEffect(() => {
    currentRouteKeyRef.current = routeKey;
  }, [routeKey]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    let saveTimeoutId: number | null = null;

    if (window.history.scrollRestoration !== 'manual') {
      window.history.scrollRestoration = 'manual';
    }

    const saveRouteScroll = (key?: string) => {
      if (isRestoringRef.current) return;
      try {
        const route = key ?? currentRouteKeyRef.current;
        window.sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${route}`, String(window.scrollY || 0));
      } catch {
        // ignore storage errors (private mode / disabled storage)
      }
    };

    const handlePopState = () => {
      isPopNavigationRef.current = true;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) return;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${destination.pathname}${destination.search}${destination.hash}`;
      if (current === next) return;

      saveRouteScroll();
    };

    const handlePageHide = () => {
      saveRouteScroll();
    };

    const handleScroll = () => {
      if (isRestoringRef.current || saveTimeoutId !== null) return;
      saveTimeoutId = window.setTimeout(() => {
        saveTimeoutId = null;
        saveRouteScroll();
      }, 100);
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function patchedPushState(...args) {
      if (!isPopNavigationRef.current) {
        saveRouteScroll();
      }
      return originalPushState(...(args as Parameters<History['pushState']>));
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      if (!isPopNavigationRef.current) {
        saveRouteScroll();
      }
      return originalReplaceState(...(args as Parameters<History['replaceState']>));
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (saveTimeoutId !== null) window.clearTimeout(saveTimeoutId);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;
    let stopTimeoutId: number | null = null;
    let rafId: number | null = null;
    let fallbackTimeoutId: number | null = null;
    let stableAttempts = 0;

    const stopRestore = () => {
      isRestoringRef.current = false;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (stopTimeoutId !== null) window.clearTimeout(stopTimeoutId);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (fallbackTimeoutId !== null) window.clearTimeout(fallbackTimeoutId);
      intervalId = null;
      stopTimeoutId = null;
      rafId = null;
      fallbackTimeoutId = null;
    };

    const scrollTopNow = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    const shouldRestore = isPopNavigationRef.current || shouldRestoreInitialRef.current;
    shouldRestoreInitialRef.current = false;

    if (!shouldRestore) {
      scrollTopNow();
      rafId = window.requestAnimationFrame(scrollTopNow);
      fallbackTimeoutId = window.setTimeout(scrollTopNow, 50);
      return () => {
        stopRestore();
      };
    }

    let savedY = 0;
    try {
      const raw = window.sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${routeKey}`);
      const parsed = raw ? Number.parseInt(raw, 10) : 0;
      savedY = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      savedY = 0;
    }

    if (savedY <= 0) {
      scrollTopNow();
      isPopNavigationRef.current = false;
      return () => {
        stopRestore();
      };
    }

    isRestoringRef.current = true;

    const attemptRestore = () => {
      window.scrollTo({ top: savedY, left: 0, behavior: 'auto' });
      if (Math.abs(window.scrollY - savedY) <= 2) {
        stableAttempts += 1;
        if (stableAttempts >= 2) stopRestore();
      } else {
        stableAttempts = 0;
      }
    };

    attemptRestore();
    rafId = window.requestAnimationFrame(attemptRestore);
    fallbackTimeoutId = window.setTimeout(attemptRestore, 80);
    intervalId = window.setInterval(attemptRestore, RESTORE_INTERVAL_MS);
    stopTimeoutId = window.setTimeout(stopRestore, RESTORE_WINDOW_MS);

    isPopNavigationRef.current = false;

    return () => {
      stopRestore();
    };
  }, [routeKey]);

  return null;
}
