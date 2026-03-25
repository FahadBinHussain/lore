export interface ListenNotesEpisode {
  id: string;
  title: string;
  description: string;
  audio: string;
  audio_length_sec: number;
  pub_date_ms: number;
  thumbnail: string;
  listennotes_url: string;
  podcast: {
    id: string;
    title: string;
    publisher: string;
    image: string;
    thumbnail: string;
  };
}

export interface ListenNotesPodcast {
  id: string;
  title: string;
  description: string;
  image: string;
  thumbnail: string;
  publisher: string;
  total_episodes: number;
  listen_score: number;
  listen_score_global_rank: string;
}

export interface ListenNotesSearchResponse {
  results: Array<{
    id: string;
    title: string;
    description: string;
    image: string;
    thumbnail: string;
    publisher: string;
    total_episodes: number;
    listen_score: number;
    listen_score_global_rank: string;
  }>;
  count: number;
}

export async function searchPodcasts(query: string, offset: number = 0): Promise<ListenNotesSearchResponse> {
  const response = await fetch(
    `https://listen-api.listennotes.com/api/v2/search?q=${encodeURIComponent(query)}&type=podcast&offset=${offset}&safe_mode=1`,
    {
      headers: {
        'X-ListenAPI-Key': process.env.LISTEN_NOTES_API_KEY!,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search podcasts');
  }

  const data = await response.json();
  return {
    results: data.results || [],
    count: data.count || 0,
  };
}

export async function getPodcastDetails(id: string): Promise<ListenNotesPodcast> {
  const response = await fetch(
    `https://listen-api.listennotes.com/api/v2/podcasts/${id}`,
    {
      headers: {
        'X-ListenAPI-Key': process.env.LISTEN_NOTES_API_KEY!,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get podcast details');
  }

  return response.json();
}

export async function getPodcastEpisodes(id: string, offset: number = 0): Promise<{ episodes: ListenNotesEpisode[] }> {
  const response = await fetch(
    `https://listen-api.listennotes.com/api/v2/podcasts/${id}/episodes?offset=${offset}`,
    {
      headers: {
        'X-ListenAPI-Key': process.env.LISTEN_NOTES_API_KEY!,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get podcast episodes');
  }

  return response.json();
}