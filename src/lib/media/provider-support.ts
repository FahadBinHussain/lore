export type MediaProviderItem = {
  mediaType?: string | null;
  source?: string | null;
  externalId?: string | null;
  isPlaceholder?: boolean | null;
};

const API_BACKED_SOURCES_BY_TYPE: Record<string, string> = {
  movie: 'tmdb',
  tv: 'tmdb',
  anime: 'anilist',
  game: 'igdb',
  book: 'openlibrary',
};

export function isApiBackedMediaItem(mediaItem: MediaProviderItem): boolean {
  if (mediaItem.isPlaceholder) return false;

  const mediaType = mediaItem.mediaType?.trim().toLowerCase();
  const source = mediaItem.source?.trim().toLowerCase();
  const externalId = mediaItem.externalId?.trim();
  if (!mediaType || !source || !externalId) return false;

  return API_BACKED_SOURCES_BY_TYPE[mediaType] === source;
}

export function getMediaDetailHref(mediaItem: MediaProviderItem): string | null {
  if (!isApiBackedMediaItem(mediaItem)) return null;

  const externalId = mediaItem.externalId?.trim();
  if (!externalId) return null;

  switch (mediaItem.mediaType?.trim().toLowerCase()) {
    case 'movie':
      return `/movies/${externalId}`;
    case 'tv':
      return `/tv/${externalId}`;
    case 'anime':
      return `/anime/${externalId}`;
    case 'game':
      return `/games/${externalId}`;
    case 'book':
      return `/books/${externalId}`;
    default:
      return null;
  }
}

export function getTimelineItemState(mediaItem: MediaProviderItem): 'trackable' | 'curated' {
  return isApiBackedMediaItem(mediaItem) ? 'trackable' : 'curated';
}
