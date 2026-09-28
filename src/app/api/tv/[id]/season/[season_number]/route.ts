import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/index';
import { userEpisodeProgress, episodes } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { resolveTvShow, resolveTvSeason } from '@/lib/media/tv-episode-resolver';

interface TMDBSeasonDetail {
  id: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  season_number: number;
  air_date: string | null;
  episodes?: Array<{
    id: number;
    name: string;
    overview: string | null;
    episode_number: number;
    air_date: string | null;
    runtime: number | null;
    still_path: string | null;
    vote_average: number;
    vote_count: number;
  }>;
}

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

    const season = (await response.json()) as TMDBSeasonDetail;

    // Get user session for watched status
    const session = await auth();
    const watchedEpisodes: { [key: number]: boolean } = {};

    if (session?.user?.id) {
      try {
        const userId = parseInt(session.user.id);

        // Resolve the canonical season row for this show, then read watch
        // status per episode number — never by external_id string, which can
        // match a duplicate stub row instead of the canonical one.
        const mediaItem = await resolveTvShow(showId);
        const seasonRow = await resolveTvSeason(mediaItem.id, showId, seasonNumber);

        const seasonEpisodes = await db
          .select({ id: episodes.id, episodeNumber: episodes.episodeNumber })
          .from(episodes)
          .where(eq(episodes.seasonId, seasonRow.id));

        const episodeIds = seasonEpisodes.map((row) => row.id);
        const progressRows = episodeIds.length
          ? await db
              .select({ episodeId: userEpisodeProgress.episodeId, isWatched: userEpisodeProgress.isWatched })
              .from(userEpisodeProgress)
              .where(and(
                eq(userEpisodeProgress.userId, userId),
                inArray(userEpisodeProgress.episodeId, episodeIds)
              ))
          : [];

        const watchedById = new Map(
          progressRows.map((row) => [row.episodeId, row.isWatched])
        );
        const idByEpisodeNumber = new Map(
          seasonEpisodes.map((row) => [row.episodeNumber, row.id])
        );

        for (const episode of season.episodes || []) {
          const dbEpisodeId = idByEpisodeNumber.get(episode.episode_number);
          watchedEpisodes[episode.episode_number] =
            dbEpisodeId !== undefined && watchedById.get(dbEpisodeId) === true;
        }
      } catch {
        // If database tables don't exist yet, just set all episodes as unwatched
        console.log('Database not ready, using default unwatched status');
        for (const episode of season.episodes || []) {
          watchedEpisodes[episode.episode_number] = false;
        }
      }
    }

    const result = {
      id: season.id,
      name: season.name,
      overview: season.overview,
      poster_path: season.poster_path,
      season_number: season.season_number,
      episode_count: season.episodes?.length || 0,
      air_date: season.air_date,
      episodes: (season.episodes || []).map((episode) => ({
        id: episode.id,
        name: episode.name,
        overview: episode.overview,
        episode_number: episode.episode_number,
        air_date: episode.air_date,
        runtime: episode.runtime,
        still_path: episode.still_path,
        vote_average: episode.vote_average,
        vote_count: episode.vote_count,
        watched: watchedEpisodes[episode.episode_number] || false,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Season detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch season details' }, { status: 500 });
  }
}