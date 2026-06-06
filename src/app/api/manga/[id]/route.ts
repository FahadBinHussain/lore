import { NextResponse } from 'next/server';
import { getMangaDetails, normalizeMangaForApp } from '@/lib/api/anilist';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

function toIsoDate(date?: { year: number | null; month: number | null; day: number | null } | null) {
  if (!date?.year) return null;
  const month = `${date.month ?? 1}`.padStart(2, '0');
  const day = `${date.day ?? 1}`.padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);

  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'Invalid manga ID' }, { status: 400 });
  }

  try {
    const manga = await getMangaDetails(numericId);
    if (!manga) {
      return NextResponse.json({ error: 'Manga not found' }, { status: 404 });
    }

    const item = normalizeMangaForApp(manga);

    return NextResponse.json({
      id: String(item.id),
      title: item.title,
      mediaType: 'manga',
      source: 'anilist',
      image: item.image || null,
      description: item.description || null,
      releaseDate: toIsoDate(item.startDate),
      rating: item.rating,
      subtitle: item.format || null,
      externalUrl: getProviderSourceUrl('anilist', 'manga', String(item.id)),
      chips: item.genres || [],
      fields: [
        { label: 'Status', value: item.status },
        { label: 'Chapters', value: item.chapters },
        { label: 'Volumes', value: item.volumes },
        { label: 'Popularity', value: item.popularity },
      ],
    });
  } catch (error) {
    console.error('Manga detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch manga details' }, { status: 500 });
  }
}
