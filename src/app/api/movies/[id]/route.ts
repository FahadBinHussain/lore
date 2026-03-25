import { NextRequest, NextResponse } from 'next/server';
import { getMovieDetails, getTMDBImageUrl } from '@/lib/api/tmdb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 });
  }

  try {
    const movie = await getMovieDetails(id);

    const result = {
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      genres: movie.genres || [],
      runtime: movie.runtime || 0,
      tagline: movie.tagline || '',
      status: movie.status || '',
      budget: movie.budget || 0,
      revenue: movie.revenue || 0,
      original_language: movie.original_language || '',
      popularity: movie.popularity || 0,
      credits: movie.credits ? {
        cast: movie.credits.cast.slice(0, 10).map(c => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
        })),
        crew: movie.credits.crew.filter(c => 
          ['Director', 'Writer', 'Screenplay', 'Producer'].includes(c.job)
        ).slice(0, 5).map(c => ({
          id: c.id,
          name: c.name,
          job: c.job,
          department: c.department,
          profile_path: c.profile_path,
        })),
      } : { cast: [], crew: [] },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Movie detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch movie details' }, { status: 500 });
  }
}