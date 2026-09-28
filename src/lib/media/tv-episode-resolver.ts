import { db } from '@/db/index';
import { mediaItems, seasons, episodes } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * TV episodes in this database have historically been keyed by several
 * `external_id` conventions depending on which code path created the row:
 *
 *  - `tmdb-episode-{tmdbEpisodeId}` / season `tmdb-tv-{showId}-s{n}`  (enriched import)
 *  - `{showId}-{s}-{e}`            / season `{showId}-{s}`            (watch-toggle + media/status cascade)
 *  - bare `{tmdbEpisodeId}`        / season `{tmdbSeasonId}`          (older import)
 *
 * Looking an episode up by its `external_id` string therefore misses the row
 * another path created and silently spawns a duplicate season + episode pair,
 * which strands watch progress on a stub row and breaks the completed-show
 * cascade (it counts episode rows, so a duplicated show can never complete).
 *
 * Every read/write path must resolve episodes by (media item, season number,
 * episode number) instead of by id string. That is what this module does.
 * When it has to create a row it uses the enriched `tmdb-episode-*` /
 * `tmdb-tv-*` convention so no new stub rows enter the database.
 */

interface TmdbEpisode {
  id: number;
  name?: string | null;
  overview?: string | null;
  episode_number: number;
  air_date?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
}

interface TmdbShow {
  name?: string | null;
  title?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  genres?: Array<{ name?: string | null }>;
  networks?: Array<{ name?: string | null }>;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  tagline?: string | null;
  popularity?: number | null;
}

async function fetchTmdbShow(showId: number): Promise<TmdbShow | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}?api_key=${process.env.TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!response.ok) return null;
    return (await response.json()) as TmdbShow;
  } catch {
    return null;
  }
}

async function fetchTmdbEpisode(showId: number, seasonNumber: number, episodeNumber: number): Promise<TmdbEpisode | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${process.env.TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!response.ok) return null;
    return (await response.json()) as TmdbEpisode;
  } catch {
    return null;
  }
}

/**
 * Find the canonical `media_items` row for a TMDB tv show, creating (and
 * enriching from TMDB) one when it does not exist yet. Placeholder rows left
 * behind by earlier imports are upgraded in place.
 */
export async function resolveTvShow(showId: number) {
  const rows = await db
    .select()
    .from(mediaItems)
    .where(and(
      eq(mediaItems.externalId, showId.toString()),
      eq(mediaItems.source, 'tmdb'),
      eq(mediaItems.mediaType, 'tv')
    ))
    .limit(1);

  if (rows.length > 0) {
    const existing = rows[0];
    if (existing.isPlaceholder) {
      const showData = await fetchTmdbShow(showId);
      if (showData) {
        const [updated] = await db
          .update(mediaItems)
          .set({
            title: showData.name || showData.title || existing.title,
            description: showData.overview || existing.description,
            posterPath: showData.poster_path || existing.posterPath,
            backdropPath: showData.backdrop_path || existing.backdropPath,
            releaseDate: showData.first_air_date || existing.releaseDate,
            rating: showData.vote_average ? String(showData.vote_average) : existing.rating,
            voteCount: showData.vote_count ?? existing.voteCount,
            genres: Array.isArray(showData.genres)
              ? showData.genres.map((g) => g?.name).filter((n): n is string => typeof n === "string")
              : existing.genres,
            networks: Array.isArray(showData.networks)
              ? showData.networks.map((n) => n?.name).filter((x): x is string => typeof x === "string")
              : existing.networks,
            seasons: showData.number_of_seasons || existing.seasons,
            totalEpisodes: showData.number_of_episodes || existing.totalEpisodes,
            status: showData.status || existing.status,
            isPlaceholder: false,
            tagline: showData.tagline || existing.tagline,
            popularity: showData.popularity ? String(showData.popularity) : existing.popularity,
            updatedAt: new Date(),
          })
          .where(eq(mediaItems.id, existing.id))
          .returning();
        return updated ?? existing;
      }
    }
    return existing;
  }

  const showData = await fetchTmdbShow(showId);
  const [created] = await db
    .insert(mediaItems)
    .values([{
      externalId: showId.toString(),
      source: 'tmdb',
      mediaType: 'tv',
      title: showData?.name || showData?.title || `TV Show ${showId}`,
      description: showData?.overview || null,
      posterPath: showData?.poster_path || null,
      backdropPath: showData?.backdrop_path || null,
      releaseDate: showData?.first_air_date || null,
      rating: showData?.vote_average ? String(showData.vote_average) : null,
      voteCount: showData?.vote_count ?? 0,
      genres: Array.isArray(showData?.genres)
        ? showData.genres.map((g) => g?.name).filter((n): n is string => typeof n === "string")
        : null,
      runtime: null,
      pageCount: null,
      developer: null,
      publisher: null,
      author: null,
      isbn: null,
      platforms: null,
      networks: Array.isArray(showData?.networks)
        ? showData.networks.map((n) => n?.name).filter((x): x is string => typeof x === "string")
        : null,
      seasons: showData?.number_of_seasons || null,
      totalEpisodes: showData?.number_of_episodes || null,
      status: showData?.status || null,
      isPlaceholder: !showData,
      tagline: showData?.tagline || null,
      popularity: showData?.popularity ? String(showData.popularity) : null,
      additionalData: null,
    }])
    .returning();

  return created;
}

/**
 * Rank duplicate season rows so the enriched import wins over the
 * toggle/cascade stub. Higher score wins.
 */
function seasonRank(row: typeof seasons.$inferSelect, showId: number, seasonNumber: number) {
  let score = 0;
  // Enriched imports carry the real episode count; stubs carry 0.
  if ((row.episodeCount ?? 0) > 0) score += 2;
  // The `{showId}-{season}` shape is only ever produced by the create-if-missing
  // paths, so it is never the canonical row when a rival exists.
  if (row.externalId !== `${showId}-${seasonNumber}`) score += 1;
  return score;
}

/**
 * Find the season row for a show, preferring the enriched import when several
 * conventions coexist. Creates one with the canonical `tmdb-tv-*` id when
 * missing, optionally seeded with TMDB season metadata.
 */
export async function resolveTvSeason(
  mediaItemId: number,
  showId: number,
  seasonNumber: number,
  seed?: {
    name?: string | null;
    overview?: string | null;
    posterPath?: string | null;
    airDate?: string | null;
    episodeCount?: number | null;
  }
) {
  const rows = await db
    .select()
    .from(seasons)
    .where(and(
      eq(seasons.mediaItemId, mediaItemId),
      eq(seasons.seasonNumber, seasonNumber)
    ));

  if (rows.length > 0) {
    if (rows.length > 1) {
      rows.sort(
        (a, b) =>
          seasonRank(b, showId, seasonNumber) - seasonRank(a, showId, seasonNumber) ||
          a.id - b.id
      );
    }
    return rows[0];
  }

  const [created] = await db
    .insert(seasons)
    .values({
      mediaItemId,
      externalId: `tmdb-tv-${showId}-s${seasonNumber}`,
      source: 'tmdb',
      seasonNumber,
      name: seed?.name || `Season ${seasonNumber}`,
      overview: seed?.overview || null,
      posterPath: seed?.posterPath || null,
      airDate: seed?.airDate || null,
      episodeCount: seed?.episodeCount ?? 0,
    })
    .returning();

  return created;
}

/**
 * Find the episode row for a season keyed by episode number (never by
 * `external_id` string). Creates an enriched canonical row when missing.
 */
export async function resolveTvEpisode(
  seasonId: number,
  showId: number,
  seasonNumber: number,
  episodeNumber: number
) {
  const rows = await db
    .select()
    .from(episodes)
    .where(and(
      eq(episodes.seasonId, seasonId),
      eq(episodes.episodeNumber, episodeNumber)
    ))
    .limit(1);

  if (rows.length > 0) return rows[0];

  const tmdbEpisode = await fetchTmdbEpisode(showId, seasonNumber, episodeNumber);

  const [created] = await db
    .insert(episodes)
    .values({
      seasonId,
      externalId: tmdbEpisode
        ? `tmdb-episode-${tmdbEpisode.id}`
        : `${showId}-${seasonNumber}-${episodeNumber}`,
      source: 'tmdb',
      episodeNumber,
      name: tmdbEpisode?.name || `Episode ${episodeNumber}`,
      overview: tmdbEpisode?.overview || null,
      stillPath: tmdbEpisode?.still_path || null,
      airDate: tmdbEpisode?.air_date || null,
      runtime: tmdbEpisode?.runtime || null,
      rating: tmdbEpisode?.vote_average != null ? String(tmdbEpisode.vote_average) : null,
      voteCount: tmdbEpisode?.vote_count ?? null,
    })
    .returning();

  return created;
}
