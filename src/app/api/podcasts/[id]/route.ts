import { NextResponse } from 'next/server';
import { getPodcastDetails } from '@/lib/api/listennotes';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.LISTEN_NOTES_API_KEY) {
    return NextResponse.json({ error: 'Listen Notes API key is not configured' }, { status: 503 });
  }

  const { id } = await params;

  try {
    const podcast = await getPodcastDetails(id);

    return NextResponse.json({
      id: podcast.id,
      title: podcast.title,
      mediaType: 'podcast',
      source: 'listennotes',
      image: podcast.image || podcast.thumbnail || null,
      description: podcast.description || null,
      releaseDate: null,
      rating: podcast.listen_score || null,
      subtitle: podcast.publisher || null,
      externalUrl: getProviderSourceUrl('listennotes', 'podcast', podcast.id),
      fields: [
        { label: 'Publisher', value: podcast.publisher },
        { label: 'Episodes', value: podcast.total_episodes },
        { label: 'Listen score', value: podcast.listen_score },
        { label: 'Global rank', value: podcast.listen_score_global_rank },
      ],
    });
  } catch (error) {
    console.error('Podcast detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch podcast details' }, { status: 500 });
  }
}
