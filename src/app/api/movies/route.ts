import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrendingMovies, 
  getPopularMovies, 
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  discoverMovies,
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
  const releaseDateFrom = searchParams.get('releaseDateFrom') || undefined;
  const releaseDateTo = searchParams.get('releaseDateTo') || undefined;

  try {
    let movies;
    
    if (category === 'discover') {
      movies = await discoverMovies({
        page,
        genre,
        year,
        sortBy,
        minRating,
        maxRating,
        releaseDateFrom,
        releaseDateTo,
      });
    } else if (category === 'trending') {
      movies = await getTrendingMovies(timeWindow as 'day' | 'week', page);
    } else if (category === 'popular') {
      movies = await getPopularMovies(page);
    } else if (category === 'top_rated') {
      movies = await getTopRatedMovies(page);
    } else if (category === 'now_playing') {
      movies = await getNowPlayingMovies(page);
    } else if (category === 'upcoming') {
      movies = await getUpcomingMovies(page);
    } else {
      movies = await getTrendingMovies('week', page);
    }

    const results = movies.results.map(m => ({
      id: m.id,
      title: m.title,
      image: getTMDBImageUrl(m.poster_path),
      year: m.release_date?.split('-')[0],
      rating: m.vote_average,
      description: m.overview,
    }));

    return NextResponse.json({ 
      results,
      page: movies.page,
      totalPages: movies.total_pages,
      totalResults: movies.total_results,
    });
  } catch (error) {
    console.error('Movies API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch movies' }, { status: 500 });
  }
}