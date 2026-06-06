export interface ComicVineIssue {
  id: number;
  name: string;
  issue_number: string;
  volume: {
    id: number;
    name: string;
  };
  cover_date: string;
  description: string;
  image?: {
    original_url: string;
  };
  person_credits?: Array<{
    id: number;
    name: string;
    role: string;
  }>;
}

export interface ComicVineVolume {
  id: number;
  name: string;
  description: string;
  start_year: number;
  image?: {
    original_url: string;
  };
  publisher?: {
    id: number;
    name: string;
  };
}

export interface ComicVineSearchResponse {
  results: ComicVineIssue[];
  number_of_total_results: number;
}

export async function searchComics(query: string, page: number = 1): Promise<ComicVineSearchResponse> {
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await fetch(
    `https://comicvine.gamespot.com/api/issues/?api_key=${process.env.COMICVINE_API_KEY}&format=json&filter=name:${query}&limit=${limit}&offset=${offset}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to search comics');
  }

  return response.json();
}

export async function searchComicVolumes(query: string, page: number = 1): Promise<{ results: ComicVineVolume[]; number_of_total_results: number }> {
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await fetch(
    `https://comicvine.gamespot.com/api/volumes/?api_key=${process.env.COMICVINE_API_KEY}&format=json&filter=name:${query}&limit=${limit}&offset=${offset}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to search comic volumes');
  }

  return response.json();
}

export async function getComicDetails(id: number): Promise<ComicVineIssue> {
  const response = await fetch(
    `https://comicvine.gamespot.com/api/issue/4000-${id}/?api_key=${process.env.COMICVINE_API_KEY}&format=json`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to get comic details');
  }

  const data = await response.json();
  return data.results;
}

export async function getComicVolumeDetails(id: number): Promise<ComicVineVolume> {
  const response = await fetch(
    `https://comicvine.gamespot.com/api/volume/4050-${id}/?api_key=${process.env.COMICVINE_API_KEY}&format=json`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to get comic volume details');
  }

  const data = await response.json();
  return data.results;
}

export function getComicVineImageUrl(image: { original_url: string } | undefined): string | null {
  return image?.original_url || null;
}

export async function getRecentComics(page: number = 1): Promise<ComicVineSearchResponse> {
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await fetch(
    `https://comicvine.gamespot.com/api/issues/?api_key=${process.env.COMICVINE_API_KEY}&format=json&sort=cover_date:desc&limit=${limit}&offset=${offset}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recent comics');
  }

  return response.json();
}
