'use client';

import { useEffect } from 'react';

interface HeroDebugItem {
  id: number;
  title: string;
  mediaType: string;
  source: string;
  backdropPath: string | null;
  posterPath?: string | null;
  imageKind?: 'backdrop' | 'poster' | null;
}

interface HeroDebugLogProps {
  universeSlug: string;
  universeName: string;
  bannerImage: string | null;
  coverImage: string | null;
  firstBackdropItem: HeroDebugItem | null;
  resolvedHeroImage: string | null;
}

export function HeroDebugLog({
  universeSlug,
  universeName,
  bannerImage,
  coverImage,
  firstBackdropItem,
  resolvedHeroImage,
}: HeroDebugLogProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const chosenSource = bannerImage
      ? 'collections.bannerImage'
      : coverImage
        ? 'collections.coverImage'
        : firstBackdropItem?.imageKind === 'poster'
          ? `items.posterPath (${firstBackdropItem.mediaType})`
          : firstBackdropItem?.backdropPath
            ? `items.backdropPath (${firstBackdropItem.mediaType})`
          : 'none';

    console.groupCollapsed(`[Universe Hero Debug] ${universeSlug}`);
    console.log('Universe:', { name: universeName, slug: universeSlug });
    console.log('Candidate bannerImage:', bannerImage);
    console.log('Candidate coverImage:', coverImage);
    console.log('Selected fallback media item:', firstBackdropItem);
    console.log('Chosen source:', chosenSource);
    console.log('Resolved hero image URL:', resolvedHeroImage);
    console.groupEnd();
  }, [bannerImage, coverImage, firstBackdropItem, resolvedHeroImage, universeName, universeSlug]);

  return null;
}
