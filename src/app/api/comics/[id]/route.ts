import { NextResponse } from 'next/server';
import { getComicDetails, getComicVineImageUrl, getComicVolumeDetails } from '@/lib/api/comicvine';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isVolume = id.startsWith('volume-');
  const numericId = Number.parseInt(id.replace(/^(issue|volume)-/, ''), 10);

  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'Invalid comic ID' }, { status: 400 });
  }

  try {
    if (isVolume) {
      const volume = await getComicVolumeDetails(numericId);

      return NextResponse.json({
        id: `volume-${volume.id}`,
        title: volume.name,
        mediaType: 'comic',
        source: 'comicvine',
        image: getComicVineImageUrl(volume.image),
        description: volume.description || null,
        releaseDate: volume.start_year ? `${volume.start_year}-01-01` : null,
        subtitle: volume.publisher?.name || null,
        externalUrl: getProviderSourceUrl('comicvine', 'comic', `volume-${volume.id}`),
        fields: [
          { label: 'Publisher', value: volume.publisher?.name },
          { label: 'Start year', value: volume.start_year },
        ],
      });
    }

    const comic = await getComicDetails(numericId);

    return NextResponse.json({
      id: id.startsWith('issue-') ? id : String(comic.id),
      title: comic.name || `${comic.volume?.name || 'Comic'} #${comic.issue_number || comic.id}`,
      mediaType: 'comic',
      source: 'comicvine',
      image: getComicVineImageUrl(comic.image),
      description: comic.description || null,
      releaseDate: comic.cover_date || null,
      subtitle: comic.volume?.name ? `${comic.volume.name}${comic.issue_number ? ` #${comic.issue_number}` : ''}` : null,
      externalUrl: getProviderSourceUrl('comicvine', 'comic', String(comic.id)),
      chips: comic.person_credits?.slice(0, 6).map((person) => person.name).filter(Boolean) || [],
      fields: [
        { label: 'Volume', value: comic.volume?.name },
        { label: 'Issue', value: comic.issue_number },
        { label: 'Creators', value: comic.person_credits?.slice(0, 6).map((person) => `${person.name}${person.role ? ` (${person.role})` : ''}`).join(', ') },
      ],
    });
  } catch (error) {
    console.error('Comic detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch comic details' }, { status: 500 });
  }
}
