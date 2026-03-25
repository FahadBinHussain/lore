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
    // Fetch TV show details with additional data
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,similar,recommendations,external_ids,content_ratings,images`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch TV show details');
    }

    const show = await response.json();

    // Get content rating (US rating if available)
    const contentRating = show.content_ratings?.results?.find(
      (r: { iso_3166_1: string }) => r.iso_3166_1 === 'US'
    )?.rating || null;

    // Get trailers and teasers
    const videos = show.videos?.results || [];
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
    const similar = (show.similar?.results || []).slice(0, 6).map((s: any) => ({
      id: s.id,
      name: s.name,
      poster_path: s.poster_path,
      vote_average: s.vote_average,
      first_air_date: s.first_air_date,
    }));

    const recommendations = (show.recommendations?.results || []).slice(0, 6).map((r: any) => ({
      id: r.id,
      name: r.name,
      poster_path: r.poster_path,
      vote_average: r.vote_average,
      first_air_date: r.first_air_date,
    }));

    // Get backdrop images
    const backdrops = (show.images?.backdrops || []).slice(0, 8);

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
      in_production: show.in_production || false,
      homepage: show.homepage || '',
      spoken_languages: show.spoken_languages || [],
      origin_country: show.origin_country || [],
      production_companies: show.production_companies || [],
      networks: show.networks || [],
      seasons: show.seasons || [],
      content_rating: contentRating,
      external_ids: {
        imdb_id: show.external_ids?.imdb_id || null,
        tvdb_id: show.external_ids?.tvdb_id || null,
        facebook_id: show.external_ids?.facebook_id || null,
        instagram_id: show.external_ids?.instagram_id || null,
        twitter_id: show.external_ids?.twitter_id || null,
      },
      videos: {
        trailers,
        teasers,
        clips,
      },
      similar,
      recommendations,
      backdrops,
      credits: show.credits ? {
        cast: show.credits.cast.slice(0, 20).map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
          order: c.order,
        })),
        crew: show.credits.crew.filter((c: any) => 
          ['Creator', 'Director', 'Writer', 'Executive Producer', 'Producer', 'Screenplay'].includes(c.job)
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
    console.error('TV show detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch TV show details' }, { status: 500 });
  }
}
