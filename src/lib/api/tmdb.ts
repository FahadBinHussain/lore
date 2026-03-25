const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: TMDBGenre[];
  runtime?: number;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  production_companies?: TMDBProductionCompany[];
  credits?: TMDBCredits;
  adult?: boolean;
  original_language?: string;
  popularity?: number;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: TMDBGenre[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  tagline?: string;
  status?: string;
  type?: string;
  original_language?: string;
  popularity?: number;
  networks?: { id: number; name: string; logo_path: string | null }[];
  credits?: TMDBCredits;
  seasons?: TMDBSeason[];
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string;
}

export interface TMDBSearchResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export function getTMDBImageUrl(path: string | null, size: string = 'w500'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export async function searchMovies(query: string, page: number = 1): Promise<TMDBSearchResponse<TMDBMovie>> {
  const response = await fetch(
    `${TMDB_BASE_URL}/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to search movies');
  }
  
  return response.json();
}

export async function searchTVShows(query: string, page: number = 1): Promise<TMDBSearchResponse<TMDBTVShow>> {
  const response = await fetch(
    `${TMDB_BASE_URL}/search/tv?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to search TV shows');
  }
  
  return response.json();
}

export async function getMovieDetails(id: number): Promise<TMDBMovie> {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get movie details');
  }
  
  return response.json();
}

export async function getTVShowDetails(id: number): Promise<TMDBTVShow> {
  const response = await fetch(
    `${TMDB_BASE_URL}/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get TV show details');
  }
  
  return response.json();
}

export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week', page: number = 1): Promise<TMDBSearchResponse<TMDBMovie>> {
  const response = await fetch(
    `${TMDB_BASE_URL}/trending/movie/${timeWindow}?api_key=${process.env.TMDB_API_KEY}&page=${page}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get trending movies');
  }
  
  return response.json();
}

export async function getTrendingTVShows(timeWindow: 'day' | 'week' = 'week', page: number = 1): Promise<TMDBSearchResponse<TMDBTVShow>> {
  const response = await fetch(
    `${TMDB_BASE_URL}/trending/tv/${timeWindow}?api_key=${process.env.TMDB_API_KEY}&page=${page}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get trending TV shows');
  }
  
  return response.json();
}

export async function getPopularMovies(page: number = 1): Promise<TMDBSearchResponse<TMDBMovie>> {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/popular?api_key=${process.env.TMDB_API_KEY}&page=${page}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get popular movies');
  }
  
  return response.json();
}

export async function getPopularTVShows(page: number = 1): Promise<TMDBSearchResponse<TMDBTVShow>> {
  const response = await fetch(
    `${TMDB_BASE_URL}/tv/popular?api_key=${process.env.TMDB_API_KEY}&page=${page}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get popular TV shows');
  }
  
  return response.json();
}
