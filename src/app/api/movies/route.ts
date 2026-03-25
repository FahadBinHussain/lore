import { NextRequest, NextResponse } from 'next/server';
import { getTrendingMovies, getPopularMovies, getTMDBImageUrl } from '@/lib/api/tmdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'trending';
  const timeWindow = searchParams.get('timeWindow') || 'week';
  const page = parseInt(searchParams.get('page') || '1');

  try {
    let movies;
    
    if (category === 'trending') {
      movies = await getTrendingMovies(timeWindow as 'day' | 'week', page);
    } else {
      movies = await getPopularMovies(page);
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