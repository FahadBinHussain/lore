import { NextRequest, NextResponse } from 'next/server';
import { searchPodcasts } from '@/lib/api/listennotes';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    let podcasts;

    if (query) {
      podcasts = await searchPodcasts(query, offset);
    } else {
      // For now, return empty array when no query
      podcasts = { results: [], count: 0 };
    }

    const results = podcasts.results.map(p => ({
      id: p.id,
      title: p.title,
      image: p.image || p.thumbnail,
      publisher: p.publisher,
      totalEpisodes: p.total_episodes,
      description: p.description,
      rating: p.listen_score,
    }));

    return NextResponse.json({
      results,
      totalResults: podcasts.count,
    });
  } catch (error) {
    console.error('Podcasts API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch podcasts' }, { status: 500 });
  }
}