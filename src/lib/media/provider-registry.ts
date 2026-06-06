export const MEDIA_TYPES = [
  'movie',
  'tv',
  'anime',
  'manga',
  'game',
  'book',
  'comic',
  'boardgame',
  'soundtrack',
  'podcast',
  'themepark',
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export type ProviderStage = 'active' | 'recommended' | 'optional';

export type ProviderDefinition = {
  id: string;
  label: string;
  mediaTypes: readonly MediaType[];
  stage: ProviderStage;
  trackable: boolean;
  requiresKey: boolean;
  moneyRisk: boolean;
  notes: string;
};

export type MediaProviderItem = {
  mediaType?: string | null;
  source?: string | null;
  externalId?: string | null;
  isPlaceholder?: boolean | null;
};

export const MEDIA_PROVIDER_REGISTRY = [
  {
    id: 'tmdb',
    label: 'TMDB',
    mediaTypes: ['movie', 'tv'],
    stage: 'active',
    trackable: true,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Primary movie and TV metadata source.',
  },
  {
    id: 'anilist',
    label: 'AniList',
    mediaTypes: ['anime', 'manga'],
    stage: 'active',
    trackable: true,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Primary anime source; manga can be enabled after matching routes exist.',
  },
  {
    id: 'igdb',
    label: 'IGDB',
    mediaTypes: ['game'],
    stage: 'active',
    trackable: true,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Primary game metadata source through Twitch credentials.',
  },
  {
    id: 'openlibrary',
    label: 'Open Library',
    mediaTypes: ['book'],
    stage: 'active',
    trackable: true,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Primary open book metadata source.',
  },
  {
    id: 'comicvine',
    label: 'Comic Vine',
    mediaTypes: ['comic'],
    stage: 'active',
    trackable: true,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Primary comic issue metadata source; non-commercial terms apply.',
  },
  {
    id: 'bgg',
    label: 'BoardGameGeek',
    mediaTypes: ['boardgame'],
    stage: 'active',
    trackable: true,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Primary board game metadata source; registered app bearer token required for API use.',
  },
  {
    id: 'listennotes',
    label: 'Listen Notes',
    mediaTypes: ['podcast'],
    stage: 'active',
    trackable: true,
    requiresKey: true,
    moneyRisk: true,
    notes: 'Primary podcast source while Podcast Index credentials are not configured; paid/commercial risk.',
  },
  {
    id: 'musicbrainz',
    label: 'MusicBrainz',
    mediaTypes: ['soundtrack'],
    stage: 'active',
    trackable: true,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Primary soundtrack/recording metadata source.',
  },
  {
    id: 'themeparks',
    label: 'ThemeParks.wiki',
    mediaTypes: ['themepark'],
    stage: 'active',
    trackable: true,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Primary theme park attraction/live data source.',
  },
  {
    id: 'wikidata',
    label: 'Wikidata',
    mediaTypes: MEDIA_TYPES,
    stage: 'recommended',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Recommended cross-media graph/backbone for universes and external id joins.',
  },
  {
    id: 'tvmaze',
    label: 'TVmaze',
    mediaTypes: ['tv'],
    stage: 'recommended',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Recommended TV fallback for episodes, schedules, and show detail.',
  },
  {
    id: 'podcastindex',
    label: 'Podcast Index',
    mediaTypes: ['podcast'],
    stage: 'recommended',
    trackable: false,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Recommended podcast default once API credentials are configured.',
  },
  {
    id: 'googlebooks',
    label: 'Google Books',
    mediaTypes: ['book'],
    stage: 'recommended',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Recommended fallback for book search, ISBNs, and covers.',
  },
  {
    id: 'jikan',
    label: 'Jikan',
    mediaTypes: ['anime', 'manga'],
    stage: 'recommended',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Recommended MyAnimeList fallback; respect public rate limits.',
  },
  {
    id: 'mangadex',
    label: 'MangaDex',
    mediaTypes: ['manga', 'comic'],
    stage: 'recommended',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Recommended manga/manhwa metadata source.',
  },
  {
    id: 'queuetimes',
    label: 'Queue-Times',
    mediaTypes: ['themepark'],
    stage: 'recommended',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Recommended fallback for theme park live wait times.',
  },
  {
    id: 'rawg',
    label: 'RAWG',
    mediaTypes: ['game'],
    stage: 'optional',
    trackable: false,
    requiresKey: true,
    moneyRisk: true,
    notes: 'Optional game discovery/art fallback; review commercial and free-tier limits.',
  },
  {
    id: 'fanarttv',
    label: 'Fanart.tv',
    mediaTypes: ['movie', 'tv'],
    stage: 'optional',
    trackable: false,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Optional artwork enrichment layer.',
  },
  {
    id: 'trakt',
    label: 'Trakt',
    mediaTypes: ['movie', 'tv'],
    stage: 'optional',
    trackable: false,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Optional watch-history and list sync source.',
  },
  {
    id: 'lastfm',
    label: 'Last.fm',
    mediaTypes: ['soundtrack'],
    stage: 'optional',
    trackable: false,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Optional music scrobble/popularity source.',
  },
  {
    id: 'listenbrainz',
    label: 'ListenBrainz',
    mediaTypes: ['soundtrack'],
    stage: 'optional',
    trackable: false,
    requiresKey: false,
    moneyRisk: false,
    notes: 'Optional listening history and recommendation source.',
  },
  {
    id: 'discogs',
    label: 'Discogs',
    mediaTypes: ['soundtrack'],
    stage: 'optional',
    trackable: false,
    requiresKey: true,
    moneyRisk: false,
    notes: 'Optional physical release/discography enrichment.',
  },
] as const satisfies readonly ProviderDefinition[];

const PRIMARY_PROVIDER_BY_TYPE: Partial<Record<MediaType, string>> = {
  movie: 'tmdb',
  tv: 'tmdb',
  anime: 'anilist',
  manga: 'anilist',
  game: 'igdb',
  book: 'openlibrary',
  comic: 'comicvine',
  boardgame: 'bgg',
  soundtrack: 'musicbrainz',
  podcast: 'listennotes',
  themepark: 'themeparks',
};

const DETAIL_ROUTE_BY_TYPE: Partial<Record<MediaType, (externalId: string) => string>> = {
  movie: (externalId) => `/movies/${externalId}`,
  tv: (externalId) => `/tv/${externalId}`,
  anime: (externalId) => `/anime/${externalId}`,
  manga: (externalId) => `/manga/${externalId}`,
  game: (externalId) => `/games/${externalId}`,
  book: (externalId) => `/books/${externalId}`,
  comic: (externalId) => `/comics/${externalId}`,
  boardgame: (externalId) => `/boardgames/${externalId}`,
  soundtrack: (externalId) => `/soundtracks/${externalId}`,
  podcast: (externalId) => `/podcasts/${externalId}`,
  themepark: (externalId) => `/themeparks/${externalId}`,
};

export function normalizeMediaType(value: unknown): MediaType | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'tvshow' || normalized === 'series') return 'tv';
  if (normalized === 'videogame') return 'game';
  if (normalized === 'attraction' || normalized === 'ride') return 'themepark';
  if (normalized === 'music') return 'soundtrack';
  if (normalized === 'boardgames') return 'boardgame';
  if (normalized === 'podcasts') return 'podcast';

  return (MEDIA_TYPES as readonly string[]).includes(normalized)
    ? (normalized as MediaType)
    : null;
}

export function normalizeProviderId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!normalized) return null;

  if (normalized === 'themoviedb') return 'tmdb';
  if (normalized === 'open-library') return 'openlibrary';
  if (normalized === 'boardgamegeek') return 'bgg';
  if (normalized === 'themeparkswiki' || normalized === 'themeparkwiki') return 'themeparks';
  if (normalized === 'podcast-index') return 'podcastindex';
  if (normalized === 'google-books') return 'googlebooks';
  if (normalized === 'fanart') return 'fanarttv';

  return normalized;
}

export function getProviderDefinition(provider: string | null | undefined) {
  const normalized = normalizeProviderId(provider);
  if (!normalized) return null;
  return MEDIA_PROVIDER_REGISTRY.find((entry) => entry.id === normalized) || null;
}

export function getPrimaryProviderForMediaType(mediaType: unknown): string | null {
  const normalizedType = normalizeMediaType(mediaType);
  if (!normalizedType) return null;
  return PRIMARY_PROVIDER_BY_TYPE[normalizedType] || null;
}

export function isTrackableMediaSource(mediaType: unknown, provider: unknown): boolean {
  const normalizedType = normalizeMediaType(mediaType);
  const normalizedProvider = normalizeProviderId(provider);
  if (!normalizedType || !normalizedProvider) return false;
  return PRIMARY_PROVIDER_BY_TYPE[normalizedType] === normalizedProvider;
}

export function getMediaDetailHref(mediaItem: MediaProviderItem): string | null {
  if (!isTrackableMediaSource(mediaItem.mediaType, mediaItem.source)) return null;

  const mediaType = normalizeMediaType(mediaItem.mediaType);
  const externalId = mediaItem.externalId?.trim();
  if (!mediaType || !externalId) return null;

  const routeFactory = DETAIL_ROUTE_BY_TYPE[mediaType];
  return routeFactory ? routeFactory(externalId) : null;
}

export function getProviderSourceUrl(provider: unknown, mediaType: unknown, externalId: unknown): string | null {
  const normalizedProvider = normalizeProviderId(provider);
  const normalizedType = normalizeMediaType(mediaType);
  const normalizedId = typeof externalId === 'string' ? externalId.trim() : String(externalId ?? '').trim();
  if (!normalizedProvider || !normalizedType || !normalizedId) return null;

  switch (normalizedProvider) {
    case 'tmdb':
      return normalizedType === 'tv'
        ? `https://www.themoviedb.org/tv/${normalizedId}`
        : `https://www.themoviedb.org/movie/${normalizedId}`;
    case 'anilist':
      return normalizedType === 'manga'
        ? `https://anilist.co/manga/${normalizedId}`
        : `https://anilist.co/anime/${normalizedId}`;
    case 'igdb':
      return `https://www.igdb.com/games/${normalizedId}`;
    case 'openlibrary':
      return normalizedId.startsWith('/')
        ? `https://openlibrary.org${normalizedId}`
        : `https://openlibrary.org/${normalizedId}`;
    case 'comicvine':
      if (normalizedId.startsWith('volume-')) {
        return `https://comicvine.gamespot.com/api/volume/4050-${normalizedId.replace(/^volume-/, '')}/`;
      }
      if (normalizedId.startsWith('issue-')) {
        return `https://comicvine.gamespot.com/api/issue/4000-${normalizedId.replace(/^issue-/, '')}/`;
      }
      return `https://comicvine.gamespot.com/api/issue/4000-${normalizedId}/`;
    case 'bgg':
      return `https://boardgamegeek.com/boardgame/${normalizedId}`;
    case 'musicbrainz':
      return `https://musicbrainz.org/recording/${normalizedId}`;
    case 'themeparks':
      return `https://api.themeparks.wiki/v1/entity/${normalizedId}`;
    case 'listennotes':
      return `https://www.listennotes.com/podcasts/${normalizedId}/`;
    case 'wikidata':
      return `https://www.wikidata.org/wiki/${normalizedId}`;
    case 'tvmaze':
      return `https://www.tvmaze.com/shows/${normalizedId}`;
    case 'mangadex':
      return `https://mangadex.org/title/${normalizedId}`;
    default:
      return null;
  }
}
