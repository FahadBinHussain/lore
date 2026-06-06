import { NextResponse } from 'next/server';
import { formatDuration, getRecordingDetails } from '@/lib/api/musicbrainz';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const recording = await getRecordingDetails(id);
    const artist = recording['artist-credit']?.map((credit) => credit.artist.name).filter(Boolean).join(', ') || null;
    const release = recording.releases?.[0];

    return NextResponse.json({
      id: recording.id,
      title: recording.title,
      mediaType: 'soundtrack',
      source: 'musicbrainz',
      image: null,
      description: artist ? `Recording by ${artist}.` : null,
      releaseDate: release?.date || null,
      subtitle: artist,
      externalUrl: getProviderSourceUrl('musicbrainz', 'soundtrack', recording.id),
      chips: recording.tags?.slice(0, 8).map((tag) => tag.name).filter(Boolean) || [],
      fields: [
        { label: 'Artist', value: artist },
        { label: 'Release', value: release?.title },
        { label: 'Duration', value: formatDuration(recording.length) },
      ],
    });
  } catch (error) {
    console.error('Soundtrack detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch soundtrack details' }, { status: 500 });
  }
}
