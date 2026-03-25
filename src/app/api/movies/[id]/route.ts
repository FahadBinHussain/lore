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
    // Fetch movie details with additional data
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,similar,recommendations,external_ids,release_dates,images`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch movie details');
    }

    const movie = await response.json();

    // Get content rating (US rating if available)
    const contentRating = movie.release_dates?.results?.find(
      (r: { iso_3166_1: string }) => r.iso_3166_1 === 'US'
    )?.release_dates?.[0]?.certification || null;

    // Get trailers and teasers
    const videos = movie.videos?.results || [];
    const trailers = videos.filter(
      (v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube'
    );
    const teasers = videos.filter(
      (v: { type: string; site: string }) => v.type === 'Teaser' && v.site === 'YouTube'
    );
    const clips = videos.filter(
      (v: { type: string; site: string }) => v.type === 'Clip' && v.site === 'YouTube'
    );

    // Get similar and recommendations (limit to 6 each)
    const similar = (movie.similar?.results || []).slice(0, 6).map((s: any) => ({
      id: s.id,
      title: s.title,
      poster_path: s.poster_path,
      vote_average: s.vote_average,
      release_date: s.release_date,
    }));

    const recommendations = (movie.recommendations?.results || []).slice(0, 6).map((r: any) => ({
      id: r.id,
      title: r.title,
      poster_path: r.poster_path,
      vote_average: r.vote_average,
      release_date: r.release_date,
    }));

    // Get backdrop images
    const backdrops = (movie.images?.backdrops || []).slice(0, 8);

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
      adult: movie.adult || false,
      homepage: movie.homepage || '',
      imdb_id: movie.imdb_id || '',
      spoken_languages: movie.spoken_languages || [],
      production_countries: movie.production_countries || [],
      production_companies: movie.production_companies || [],
      content_rating: contentRating,
      external_ids: {
        imdb_id: movie.external_ids?.imdb_id || movie.imdb_id || null,
        facebook_id: movie.external_ids?.facebook_id || null,
        instagram_id: movie.external_ids?.instagram_id || null,
        twitter_id: movie.external_ids?.twitter_id || null,
      },
      videos: {
        trailers,
        teasers,
        clips,
      },
      similar,
      recommendations,
      backdrops,
      credits: movie.credits ? {
        cast: movie.credits.cast.slice(0, 20).map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
          order: c.order,
        })),
        crew: movie.credits.crew.filter((c: any) => 
          ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 'Cinematography', 'Original Music Composer'].includes(c.job)
        ).slice(0, 10).map((c: any) => ({
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
