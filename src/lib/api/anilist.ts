// AniList GraphQL API Integration

const ANILIST_API_URL = 'https://graphql.anilist.co';

export interface AniListImage {
  large: string | null;
  medium: string | null;
}

export interface AniListTitle {
  romaji: string;
  english: string | null;
  native: string | null;
}

export interface AniListStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface AniListTrailer {
  id: string;
  site: string;
  thumbnail: string | null;
}

export interface AniListDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListAnime {
  id: number;
  title: AniListTitle;
  type: string;
  format: string;
  status: string;
  description: string | null;
  startDate: AniListDate;
  endDate: AniListDate;
  season: string | null;
  seasonYear: number | null;
  episodes: number | null;
  duration: number | null;
  coverImage: AniListImage;
  bannerImage: string | null;
  genres: string[];
  averageScore: number | null;
  popularity: number | null;
  favourites: number | null;
  studios: {
    nodes: AniListStudio[];
  };
  trailer: AniListTrailer | null;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
    timeUntilAiring: number;
  } | null;
  relations: {
    edges: {
      id: number;
      relationType: string;
      node: {
        id: number;
        title: AniListTitle;
        type: string;
        format: string;
        status: string;
        coverImage: AniListImage;
      };
    }[];
  };
  characters: {
    edges: {
      id: number;
      role: string;
      node: {
        id: number;
        name: {
          full: string;
        };
        image: AniListImage;
      };
    }[];
  };
  recommendations: {
    nodes: {
      id: number;
      mediaRecommendation: {
        id: number;
        title: AniListTitle;
        coverImage: AniListImage;
      };
    }[];
  };
}

// GraphQL Queries
const PAGE_SIZE = 20;

// Trending Anime Query
const TRENDING_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Popular Anime Query
const POPULAR_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Top Rated Anime Query
const TOP_RATED_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: SCORE_DESC, averageScore_greater: 70) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Currently Airing Anime Query
const AIRING_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        nextAiringEpisode {
          airingAt
          episode
          timeUntilAiring
        }
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Upcoming Anime Query
const UPCOMING_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, status_not: RELEASING, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Discover Anime Query (with filters)
const DISCOVER_ANIME_QUERY = `
  query (
    $page: Int
    $perPage: Int
    $sort: [MediaSort]
    $genre_in: [String]
    $seasonYear: Int
    $season: MediaSeason
    $status: MediaStatus
    $format: MediaFormat
    $averageScore_greater: Int
    $averageScore_lesser: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        type: ANIME
        sort: $sort
        genre_in: $genre_in
        seasonYear: $seasonYear
        season: $season
        status: $status
        format: $format
        averageScore_greater: $averageScore_greater
        averageScore_lesser: $averageScore_lesser
      ) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        nextAiringEpisode {
          airingAt
          episode
          timeUntilAiring
        }
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Search Anime Query
const SEARCH_ANIME_QUERY = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        startDate {
          year
          month
          day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        averageScore
        popularity
        favourites
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
`;

// Single Anime Detail Query - EXACTLY matching raw API response
const ANIME_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      type
      format
      status
      description
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      season
      seasonYear
      episodes
      duration
      coverImage {
        large
        medium
      }
      bannerImage
      genres
      averageScore
      popularity
      favourites
      studios(isMain: true) {
        nodes {
          id
          name
          isAnimationStudio
        }
      }
      trailer {
        id
        site
        thumbnail
      }
      nextAiringEpisode {
        airingAt
        episode
        timeUntilAiring
      }
      relations {
        edges {
          id
          relationType
          node {
            id
            title {
              romaji
              english
            }
            type
            format
            status
            coverImage {
              large
              medium
            }
          }
        }
      }
      characters(sort: ROLE) {
        edges {
          id
          role
          node {
            id
            name {
              full
            }
            image {
              large
              medium
            }
          }
        }
      }
      recommendations(sort: RATING_DESC) {
        nodes {
          id
          mediaRecommendation {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
              medium
            }
          }
        }
      }
    }
  }
`;

// Generic fetch function for AniList GraphQL API
async function fetchAniList(query: string, variables: Record<string, any>) {
  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'AniList API error');
  }

  return data.data;
}

// API Functions
export async function getTrendingAnime(page: number = 1, perPage: number = PAGE_SIZE) {
  const data = await fetchAniList(TRENDING_ANIME_QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getPopularAnime(page: number = 1, perPage: number = PAGE_SIZE) {
  const data = await fetchAniList(POPULAR_ANIME_QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getTopRatedAnime(page: number = 1, perPage: number = PAGE_SIZE) {
  const data = await fetchAniList(TOP_RATED_ANIME_QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getAiringAnime(page: number = 1, perPage: number = PAGE_SIZE) {
  const data = await fetchAniList(AIRING_ANIME_QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getUpcomingAnime(page: number = 1, perPage: number = PAGE_SIZE) {
  const data = await fetchAniList(UPCOMING_ANIME_QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function discoverAnime(params: {
  page?: number;
  perPage?: number;
  sortBy?: string;
  genre?: string[];
  year?: number;
  season?: string;
  status?: string;
  format?: string;
  minRating?: number;
  maxRating?: number;
}) {
  const {
    page = 1,
    perPage = PAGE_SIZE,
    sortBy = 'POPULARITY_DESC',
    genre,
    year,
    season,
    status,
    format,
    minRating,
    maxRating,
  } = params;

  const data = await fetchAniList(DISCOVER_ANIME_QUERY, {
    page,
    perPage,
    sort: [sortBy],
    genre_in: genre && genre.length > 0 ? genre : undefined,
    seasonYear: year,
    season,
    status,
    format,
    averageScore_greater: minRating,
    averageScore_lesser: maxRating,
  });

  return data?.Page?.media || [];
}

export async function searchAnime(search: string, page: number = 1, perPage: number = PAGE_SIZE) {
  const data = await fetchAniList(SEARCH_ANIME_QUERY, { search, page, perPage });
  return data?.Page?.media || [];
}

export async function getAnimeDetails(id: number) {
  const data = await fetchAniList(ANIME_DETAIL_QUERY, { id });
  return data?.Media;
}

// Format helper for display - uses exact raw API field names
export function formatAnimeTitle(anime: AniListAnime): string {
  return anime.title.english || anime.title.romaji || anime.title.native || 'Unknown Title';
}

export function formatAnimeYear(anime: AniListAnime): string {
  if (anime.seasonYear) return anime.seasonYear.toString();
  if (anime.startDate?.year) return anime.startDate.year.toString();
  return '';
}

export function getAnimeFormatBadge(format: string): string {
  switch (format) {
    case 'TV': return 'TV';
    case 'TV_SHORT': return 'TV Short';
    case 'MOVIE': return 'Movie';
    case 'SPECIAL': return 'Special';
    case 'OVA': return 'OVA';
    case 'ONA': return 'ONA';
    case 'MUSIC': return 'Music';
    default: return format;
  }
}

export function getAnimeStatusBadge(status: string): string {
  switch (status) {
    case 'RELEASING': return 'Airing';
    case 'FINISHED': return 'Finished';
    case 'NOT_YET_RELEASED': return 'Upcoming';
    case 'CANCELLED': return 'Cancelled';
    case 'HIATUS': return 'Hiatus';
    default: return status;
  }
}

// Normalize anime data for the API response (matches frontend AnimeItem interface)
export function normalizeAnimeForApp(anime: AniListAnime) {
  return {
    // Exact fields from raw API
    id: anime.id,
    title: formatAnimeTitle(anime),
    image: anime.coverImage?.large || anime.coverImage?.medium,
    year: formatAnimeYear(anime),
    rating: anime.averageScore, // 0-100 scale directly from API
    description: anime.description,
    episodes: anime.episodes,
    duration: anime.duration,
    format: anime.format,
    status: anime.status,
    genres: anime.genres || [],
    banner: anime.bannerImage,
    // studios is an object with nodes array
    studios: anime.studios?.nodes?.map((s: AniListStudio) => s.name) || [],
    trailer: anime.trailer,
    season: anime.season,
    seasonYear: anime.seasonYear,
    popularity: anime.popularity,
    favourites: anime.favourites,
    nextEpisode: anime.nextAiringEpisode,
    // Nested objects for detail page
    startDate: anime.startDate,
    endDate: anime.endDate,
    type: anime.type,
  };
}
