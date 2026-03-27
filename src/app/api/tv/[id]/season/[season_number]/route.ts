import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/index';
import { userEpisodeProgress } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; season_number: string }> }
) {
  const { id: idParam, season_number: seasonNumberParam } = await params;
  const numericIdMatch = idParam.match(/(\d+)$/);
  const showId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(idParam);
  const seasonNumber = parseInt(seasonNumberParam);

  if (isNaN(showId) || isNaN(seasonNumber)) {
    return NextResponse.json({ error: 'Invalid TV show or season ID' }, { status: 400 });
  }

  try {
    // Fetch season details from TMDB
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch season details');
    }

    const season = await response.json();

    // Get user session for watched status
    const session = await auth();
    let watchedEpisodes: { [key: number]: boolean } = {};

    if (session?.user?.id) {
      // Get watched episodes for this season
      // First, we need to find episodes that belong to this season and show
      // Since we don't have the episodes stored yet, we'll return empty watched status for now
      // This will be updated once we implement episode storage
      watchedEpisodes = {};
    }

    const result = {
      id: season.id,
      name: season.name,
      overview: season.overview,
      poster_path: season.poster_path,
      season_number: season.season_number,
      episode_count: season.episodes?.length || 0,
      air_date: season.air_date,
      episodes: (season.episodes || []).map((episode: any) => ({
        id: episode.id,
        name: episode.name,
        overview: episode.overview,
        episode_number: episode.episode_number,
        air_date: episode.air_date,
        runtime: episode.runtime,
        still_path: episode.still_path,
        vote_average: episode.vote_average,
        vote_count: episode.vote_count,
        // watched: watchedEpisodes[episode.episode_number] || false,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Season detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch season details' }, { status: 500 });
  }
}