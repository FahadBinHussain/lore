import { NextResponse } from 'next/server';
import { formatDuration, getRecordingDetails, getReleaseGroupDetails } from '@/lib/api/musicbrainz';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

const MB_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!MB_UUID.test(id)) {
    return NextResponse.json(
      { error: `soundtrack id "${id}" is not a musicbrainz id — curated/manual soundtracks have no provider detail` },
      { status: 404 }
    );
  }

  try {
    // stored soundtrack bindings are mixed: 4 recordings + 10 release-groups (verified 2026-09-29)
    const recording = await getRecordingDetails(id);
    if (recording) {
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
    }

    const releaseGroup = await getReleaseGroupDetails(id);
    if (releaseGroup) {
      const artist = releaseGroup['artist-credit']?.map((credit) => credit.artist.name).filter(Boolean).join(', ') || null;
      const type = [releaseGroup['primary-type'], ...(releaseGroup['secondary-types'] || [])].filter(Boolean).join(', ') || null;

      return NextResponse.json({
        id: releaseGroup.id,
        title: releaseGroup.title,
        mediaType: 'soundtrack',
        source: 'musicbrainz',
        image: null,
        description: artist ? `Soundtrack by ${artist}.` : null,
        releaseDate: releaseGroup['first-release-date'] || null,
        subtitle: artist,
        externalUrl: `https://musicbrainz.org/release-group/${releaseGroup.id}`,
        chips: releaseGroup.tags?.slice(0, 8).map((tag) => tag.name).filter(Boolean) || [],
        fields: [
          { label: 'Artist', value: artist },
          { label: 'Type', value: type },
          { label: 'Releases', value: releaseGroup['release-count'] ?? null },
        ],
      });
    }

    return NextResponse.json(
      { error: `soundtrack ${id} not found in musicbrainz (checked recording and release-group)` },
      { status: 404 }
    );
  } catch (error) {
    console.error('Soundtrack detail API error:', error);
    return NextResponse.json({ error: 'musicbrainz lookup failed — see server log' }, { status: 502 });
  }
}
