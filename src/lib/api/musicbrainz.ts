export interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number;
  'artist-credit'?: Array<{
    artist: {
      id: string;
      name: string;
    };
  }>;
  releases?: Array<{
    id: string;
    title: string;
    date?: string;
  }>;
  tags?: Array<{
    count: number;
    name: string;
  }>;
}

export interface MusicBrainzSearchResponse {
  recordings: MusicBrainzRecording[];
  count: number;
}

const MB_HEADERS = {
  'User-Agent': 'LoreMediaTracker/1.0 (https://github.com/FahadBinHussain/lore)',
  Accept: 'application/json',
};

// musicbrainz answers 403/503 to bursts (its rate limit is ~1 req/s) — one courtesy
// retry after a beat, then fail loudly. A missing User-Agent gets 403 outright.
async function mbFetch(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetch(url, { headers: MB_HEADERS, next: { revalidate: 3600 } });
    const throttled = response.status === 403 || response.status === 429 || response.status === 503;
    if (throttled && attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      continue;
    }
    return response;
  }
  throw new Error('unreachable');
}

export async function searchRecordings(query: string, limit: number = 20): Promise<MusicBrainzRecording[]> {
  const response = await mbFetch(
    `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`
  );

  if (!response.ok) {
    console.error('MusicBrainz API error:', response.status, response.statusText);
    throw new Error('Failed to search recordings');
  }

  const data = await response.json();
  return data.recordings || [];
}

export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'release-count'?: number;
  'artist-credit'?: Array<{
    artist: {
      id: string;
      name: string;
    };
  }>;
  tags?: Array<{
    count: number;
    name: string;
  }>;
}

export async function getRecordingDetails(id: string): Promise<MusicBrainzRecording | null> {
  const response = await mbFetch(
    `https://musicbrainz.org/ws/2/recording/${id}?inc=artist-credits+releases+tags&fmt=json`
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to get recording details (HTTP ${response.status})`);

  return response.json();
}

export async function getReleaseGroupDetails(id: string): Promise<MusicBrainzReleaseGroup | null> {
  const response = await mbFetch(
    `https://musicbrainz.org/ws/2/release-group/${id}?inc=artist-credits+tags&fmt=json`
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to get release group details (HTTP ${response.status})`);

  return response.json();
}

export function formatDuration(ms: number | undefined): string {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}