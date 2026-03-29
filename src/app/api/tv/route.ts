import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrendingTVShows, 
  getPopularTVShows, 
  getTopRatedTVShows,
  getOnTheAirTVShows,
  getAiringTodayTVShows,
  discoverTVShows,
  getTMDBImageUrl 
} from '@/lib/api/tmdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'trending';
  const timeWindow = searchParams.get('timeWindow') || 'week';
  const page = parseInt(searchParams.get('page') || '1');
  
  // Filter parameters
  const genre = searchParams.get('genre') || undefined;
  const year = searchParams.get('year') || undefined;
  const sortBy = searchParams.get('sortBy') || 'popularity.desc';
  const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
  const maxRating = searchParams.get('maxRating') ? parseFloat(searchParams.get('maxRating')!) : undefined;
  const firstAirDateFrom = searchParams.get('firstAirDateFrom') || undefined;
  const firstAirDateTo = searchParams.get('firstAirDateTo') || undefined;

  try {
    let shows;
    const today = new Date().toISOString().split('T')[0];
    
    if (category === 'discover') {
      shows = await discoverTVShows({
        page,
        genre,
        year,
        sortBy,
        minRating,
        maxRating,
        firstAirDateFrom,
        firstAirDateTo,
      });
    } else if (category === 'trending') {
      shows = await getTrendingTVShows(timeWindow as 'day' | 'week', page);
    } else if (category === 'popular') {
      shows = await getPopularTVShows(page);
    } else if (category === 'top_rated') {
      shows = await getTopRatedTVShows(page);
    } else if (category === 'now_playing' || category === 'on_the_air') {
      shows = await getOnTheAirTVShows(page);
    } else if (category === 'upcoming') {
      shows = await discoverTVShows({
        page,
        genre,
        year,
        sortBy: 'first_air_date.asc',
        minRating,
        maxRating,
        firstAirDateFrom: firstAirDateFrom || today,
        firstAirDateTo,
      });
    } else if (category === 'airing_today') {
      // Backward compatibility for older clients.
      shows = await getAiringTodayTVShows(page);
    } else {
      shows = await getTrendingTVShows('week', page);
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
