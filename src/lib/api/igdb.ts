const IGDB_BASE_URL = 'https://api.igdb.com/v4';

export interface IGDBGame {
  id: number;
  name: string;
  slug?: string;
  url?: string;
  summary?: string;
  storyline?: string;
  cover?: { id: number; url: string };
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  hypes?: number;
  follows?: number;
  created_at?: number;
  updated_at?: number;
  checksum?: string;
  game_type?: number;
  age_ratings?: number[];
  alternative_names?: number[];
  artworks?: number[];
  bundles?: number[];
  collections?: number[];
  dlcs?: number[];
  expansions?: number[];
  external_games?: number[];
  franchises?: number[];
  game_engines?: number[];
  game_localizations?: number[];
  game_modes?: number[];
  genres?: Array<{ id: number; name: string }>;
  involved_companies?: Array<{
    id: number;
    company: { id: number; name: string; logo?: { url: string } };
    developer?: boolean;
    publisher?: boolean;
  }>;
  keywords?: number[];
  language_supports?: number[];
  multiplayer_modes?: number[];
  platforms?: Array<{ id: number; name: string; platform_logo?: { url: string } }>;
  player_perspectives?: number[];
  release_dates?: number[];
  screenshots?: number[];
  similar_games?: number[];
  tags?: number[];
  themes?: number[];
  videos?: number[];
  websites?: number[];
  status?: { name: string };
  collection?: { name: string };
}

export async function getIGDBAccessToken(): Promise<string> {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.IGDB_CLIENT_ID!,
      client_secret: process.env.IGDB_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get IGDB access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function searchGames(query: string, accessToken: string): Promise<IGDBGame[]> {
  let body: string;
  
  if (query.trim()) {
    // Search for specific games
    body = `search "${query}"; fields id, name, summary, cover.url, first_release_date, rating, genres.name, involved_companies.company.name, involved_companies.developer, platforms.name, storyline; limit 20;`;
  } else {
    // Get popular games when no search query
    body = `fields id, name, summary, cover.url, first_release_date, rating, genres.name, involved_companies.company.name, involved_companies.developer, platforms.name, storyline; sort rating desc; where rating > 80 & cover != null; limit 20;`;
  }
  
  const response = await fetch(`${IGDB_BASE_URL}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID!,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error('Failed to search games');
  }

  return response.json();
}

export async function getGameDetails(id: number, accessToken: string): Promise<IGDBGame> {
  const response = await fetch(`${IGDB_BASE_URL}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID!,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: `where id = ${id}; fields id, name, summary, cover.url, first_release_date, rating, genres.name, involved_companies.company.name, involved_companies.developer, platforms.name, storyline;`,
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error('Failed to get game details');
  }

  const games = await response.json();
  return games[0];
}

export function getIGDBCoverUrl(url: string | undefined, size: string = 'cover_big'): string | null {
  if (!url) return null;
  const fullUrl = url.startsWith('//') ? `https:${url}` : url;
  return fullUrl.replace('thumb', size);
}
