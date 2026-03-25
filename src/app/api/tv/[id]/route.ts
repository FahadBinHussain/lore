import { NextRequest, NextResponse } from 'next/server';
import { getTVShowDetails, getTMDBImageUrl } from '@/lib/api/tmdb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid TV show ID' }, { status: 400 });
  }

  try {
    const show = await getTVShowDetails(id);

    const result = {
      id: show.id,
      name: show.name,
      original_name: show.original_name,
      overview: show.overview,
      poster_path: show.poster_path,
      backdrop_path: show.backdrop_path,
      first_air_date: show.first_air_date,
      last_air_date: show.last_air_date,
      vote_average: show.vote_average,
      vote_count: show.vote_count,
      genres: show.genres || [],
      number_of_episodes: show.number_of_episodes || 0,
      number_of_seasons: show.number_of_seasons || 0,
      tagline: show.tagline || '',
      status: show.status || '',
      type: show.type || '',
      original_language: show.original_language || '',
      popularity: show.popularity || 0,
      networks: show.networks || [],
      seasons: show.seasons || [],
      credits: show.credits ? {
        cast: show.credits.cast.slice(0, 10).map(c => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
        })),
        crew: show.credits.crew.filter(c => 
          ['Creator', 'Director', 'Writer', 'Executive Producer'].includes(c.job)
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
    console.error('TV show detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch TV show details' }, { status: 500 });
  }
}