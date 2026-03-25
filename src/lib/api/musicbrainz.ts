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

export async function searchRecordings(query: string, limit: number = 20): Promise<MusicBrainzRecording[]> {
  const response = await fetch(
    `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to search recordings');
  }

  const data = await response.json();
  return data.recordings || [];
}

export async function getRecordingDetails(id: string): Promise<MusicBrainzRecording> {
  const response = await fetch(
    `https://musicbrainz.org/ws/2/recording/${id}?inc=artist-credits+releases+tags&fmt=json`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to get recording details');
  }

  return response.json();
}

export function formatDuration(ms: number | undefined): string {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}