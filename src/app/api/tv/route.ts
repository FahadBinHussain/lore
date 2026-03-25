import { NextRequest, NextResponse } from 'next/server';
import { getTrendingTVShows, getPopularTVShows, getTMDBImageUrl } from '@/lib/api/tmdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'trending';
  const timeWindow = searchParams.get('timeWindow') || 'week';
  const page = parseInt(searchParams.get('page') || '1');

  try {
    let shows;
    
    if (category === 'trending') {
      shows = await getTrendingTVShows(timeWindow as 'day' | 'week', page);
    } else {
      shows = await getPopularTVShows(page);
    }

    const results = shows.results.map(s => ({
      id: s.id,
      title: s.name,
      image: getTMDBImageUrl(s.poster_path),
      year: s.first_air_date?.split('-')[0],
      rating: s.vote_average,
      description: s.overview,
      seasons: s.number_of_seasons,
      episodes: s.number_of_episodes,
    }));

    return NextResponse.json({ 
      results,
      page: shows.page,
      totalPages: shows.total_pages,
      totalResults: shows.total_results,
    });
  } catch (error) {
    console.error('TV Shows API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch TV shows' }, { status: 500 });
  }
}