import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/roles';
import {
  getMovieDetails,
  getTMDBImageUrl,
  getTVShowDetails,
  searchMovies,
  searchTVShows,
  TMDBMovie,
  TMDBTVShow,
} from '@/lib/api/tmdb';
import { getIGDBAccessToken, getIGDBCoverUrl, searchGames } from '@/lib/api/igdb';
import { AniListAnime, normalizeAnimeForApp, searchAnime } from '@/lib/api/anilist';

type SupportedInputType = 'movie' | 'tv' | 'game' | 'anime';
type SupportedSource = 'tmdb' | 'igdb' | 'anilist';
type UniverseMediaType = 'movie' | 'tv' | 'anime' | 'game';

interface UniversePasteItem {
  title: string;
  year?: number;
  type: SupportedInputType;
  source: SupportedSource;
}

interface UniverseResolvedItemData {
  title: string;
  externalId: string;
  source: string;
  mediaType: UniverseMediaType;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  rating: number | null;
  description: string | null;
  genres: string[];
  runtime: number | null;
  developer: string | null;
  publisher: string | null;
  platforms: string[];
  networks: string[];
  seasons: number | null;
  totalEpisodes: number | null;
  status: string | null;
  tagline: string | null;
  popularity: number | null;
  previewImage: string | null;
}

interface UniversePreviewItem {
  index: number;
  input: UniversePasteItem;
  status: 'resolved' | 'unresolved';
  selected: boolean;
  reason?: string;
  isJapaneseAnimation?: boolean;
  reroutedToAnime?: boolean;
  resolved?: UniverseResolvedItemData;
}

interface UniversePreviewRequestBody {
  items?: unknown;
}

interface IGDBCover {
  url?: string;
}

interface IGDBGenre {
  name?: string;
}

interface IGDBPlatform {
  name?: string;
}

interface IGDBInvolvedCompany {
  developer?: boolean;
  publisher?: boolean;
  company?: {
    name?: string;
  };
}

interface IGDBGameSearchResult {
  id: number;
  name: string;
  cover?: IGDBCover;
  first_release_date?: number;
  rating?: number;
  summary?: string;
  genres?: IGDBGenre[];
  platforms?: IGDBPlatform[];
  involved_companies?: IGDBInvolvedCompany[];
  storyline?: string;
}

interface TMDBTVShowWithOrigin extends TMDBTVShow {
  origin_country?: string[];
}

function normalizeTitleForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getYearFromDate(value?: string | null): number | undefined {
  if (!value) return undefined;
  const parsedYear = Number.parseInt(value.slice(0, 4), 10);
  return Number.isNaN(parsedYear) ? undefined : parsedYear;
}

function getYearFromUnix(seconds?: number): number | undefined {
  if (typeof seconds !== 'number') return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.getUTCFullYear();
}

function toIsoDateFromUnix(seconds?: number): string | null {
  if (typeof seconds !== 'number') return null;

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIsoDateFromAniList(anime: AniListAnime): string | null {
  const year = anime.startDate?.year;
  if (!year) return null;

  const month = `${anime.startDate?.month ?? 1}`.padStart(2, '0');
  const day = `${anime.startDate?.day ?? 1}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateMatchScore(candidateTitle: string, queryTitle: string, candidateYear?: number, queryYear?: number) {
  const normalizedCandidate = normalizeTitleForMatch(candidateTitle);
  const normalizedQuery = normalizeTitleForMatch(queryTitle);

  let score = 0;

  if (normalizedCandidate === normalizedQuery) {
    score += 100;
  } else if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    score += 40;
  }

  if (typeof candidateYear === 'number' && typeof queryYear === 'number') {
    const yearDiff = Math.abs(candidateYear - queryYear);
    if (yearDiff === 0) score += 20;
    else if (yearDiff === 1) score += 10;
    else if (yearDiff === 2) score += 5;
  }

  return score;
}

function pickBestMovieMatch(results: TMDBMovie[], queryTitle: string, queryYear?: number): TMDBMovie | null {
  if (results.length === 0) return null;

  const scored = results.map((item) => ({
    item,
    score: calculateMatchScore(item.title, queryTitle, getYearFromDate(item.release_date), queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item ?? null;
}

function pickBestTVMatch(results: TMDBTVShow[], queryTitle: string, queryYear?: number): TMDBTVShow | null {
  if (results.length === 0) return null;

  const scored = results.map((item) => ({
    item,
    score: calculateMatchScore(item.name, queryTitle, getYearFromDate(item.first_air_date), queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item ?? null;
}

function pickBestAnimeMatch(results: AniListAnime[], queryTitle: string, queryYear?: number): AniListAnime | null {
  if (results.length === 0) return null;

  const scored = results.map((anime) => {
    const titles = [anime.title.romaji, anime.title.english, anime.title.native].filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    );

    let bestTitleScore = 0;
    for (const title of titles) {
      const titleScore = calculateMatchScore(title, queryTitle);
      if (titleScore > bestTitleScore) {
        bestTitleScore = titleScore;
      }
    }

    let yearScore = 0;
    if (typeof anime.seasonYear === 'number' && typeof queryYear === 'number') {
      const yearDiff = Math.abs(anime.seasonYear - queryYear);
      if (yearDiff === 0) yearScore = 20;
      else if (yearDiff === 1) yearScore = 10;
      else if (yearDiff === 2) yearScore = 5;
    }

    return {
      anime,
      score: bestTitleScore + yearScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.anime ?? null;
}

function pickBestGameMatch(results: IGDBGameSearchResult[], queryTitle: string, queryYear?: number): IGDBGameSearchResult | null {
  if (results.length === 0) return null;

  const scored = results.map((game) => ({
    game,
    score: calculateMatchScore(game.name, queryTitle, getYearFromUnix(game.first_release_date), queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.game ?? null;
}

function isJapaneseAnimation(show: TMDBTVShowWithOrigin) {
  const hasAnimationGenre = Array.isArray(show.genres) && show.genres.some((genre) => genre.name === 'Animation');
  const hasJapanOrigin = Array.isArray(show.origin_country) && show.origin_country.includes('JP');
  return hasAnimationGenre && hasJapanOrigin;
}

function parseUniversePasteItem(value: unknown): UniversePasteItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const rawType = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
  const rawSource = typeof raw.source === 'string' ? raw.source.trim().toLowerCase() : '';

  if (!title) return null;
  if (!['movie', 'tv', 'game', 'anime'].includes(rawType)) return null;
  if (!['tmdb', 'igdb', 'anilist'].includes(rawSource)) return null;

  let year: number | undefined;
  if (typeof raw.year === 'number' && Number.isFinite(raw.year)) {
    year = Math.trunc(raw.year);
  } else if (typeof raw.year === 'string' && raw.year.trim().length > 0) {
    const parsedYear = Number.parseInt(raw.year.trim(), 10);
    if (!Number.isNaN(parsedYear)) {
      year = parsedYear;
    }
  }

  return {
    title,
    year,
    type: rawType as SupportedInputType,
    source: rawSource as SupportedSource,
  };
}

function unresolvedPreview(
  index: number,
  input: UniversePasteItem,
  reason: string,
  extras?: Pick<UniversePreviewItem, 'isJapaneseAnimation' | 'reroutedToAnime'>
): UniversePreviewItem {
  return {
    index,
    input,
    status: 'unresolved',
    selected: false,
    reason,
    ...extras,
  };
}

function getTMDBTypeBias(inputType: SupportedInputType, candidateType: 'movie' | 'tv') {
  if (inputType === candidateType) {
    return 8;
  }
  return 0;
}

async function resolveTMDBMovieById(
  index: number,
  input: UniversePasteItem,
  movieId: number
): Promise<UniversePreviewItem> {
  const details = await getMovieDetails(movieId);
  const genres = (details.genres || []).map((genre) => genre.name).filter(Boolean);

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: details.title,
      externalId: details.id.toString(),
      source: 'tmdb',
      mediaType: 'movie',
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate: details.release_date || null,
      rating: typeof details.vote_average === 'number' ? Number(details.vote_average.toFixed(1)) : null,
      description: details.overview || null,
      genres,
      runtime: typeof details.runtime === 'number' ? details.runtime : null,
      developer: null,
      publisher: null,
      platforms: [],
      networks: [],
      seasons: null,
      totalEpisodes: null,
      status: details.status || null,
      tagline: details.tagline || null,
      popularity: typeof details.popularity === 'number' ? Number(details.popularity.toFixed(2)) : null,
      previewImage: getTMDBImageUrl(details.poster_path, 'w185'),
    },
  };
}

async function resolveTMDBTVById(
  index: number,
  input: UniversePasteItem,
  tvId: number
): Promise<UniversePreviewItem> {
  const details = (await getTVShowDetails(tvId)) as TMDBTVShowWithOrigin;
  const genres = (details.genres || []).map((genre) => genre.name).filter(Boolean);
  const japaneseAnimation = isJapaneseAnimation(details);

  if (japaneseAnimation) {
    const animeResults = await searchAnime(details.name || input.title, 1, 5);
    const bestAnime = pickBestAnimeMatch(
      animeResults,
      details.name || input.title,
      input.year ?? getYearFromDate(details.first_air_date)
    );

    if (!bestAnime) {
      return unresolvedPreview(index, input, 'Japanese animation detected but no AniList match was found', {
        isJapaneseAnimation: true,
        reroutedToAnime: true,
      });
    }

    const normalizedAnime = normalizeAnimeForApp(bestAnime);

    return {
      index,
      input,
      status: 'resolved',
      selected: true,
      isJapaneseAnimation: true,
      reroutedToAnime: true,
      resolved: {
        title: normalizedAnime.title,
        externalId: normalizedAnime.id.toString(),
        source: 'anilist',
        mediaType: 'anime',
        posterPath: normalizedAnime.image || null,
        backdropPath: normalizedAnime.banner || null,
        releaseDate: toIsoDateFromAniList(bestAnime),
        rating: typeof normalizedAnime.rating === 'number' ? Number(normalizedAnime.rating.toFixed(1)) : null,
        description: normalizedAnime.description || null,
        genres: normalizedAnime.genres || [],
        runtime: typeof normalizedAnime.duration === 'number' ? normalizedAnime.duration : null,
        developer: null,
        publisher: null,
        platforms: [],
        networks: normalizedAnime.studios || [],
        seasons: 1,
        totalEpisodes: typeof normalizedAnime.episodes === 'number' ? normalizedAnime.episodes : null,
        status: normalizedAnime.status || null,
        tagline: null,
        popularity: typeof normalizedAnime.popularity === 'number' ? Number(normalizedAnime.popularity.toFixed(2)) : null,
        previewImage: normalizedAnime.image || null,
      },
    };
  }

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: details.name,
      externalId: details.id.toString(),
      source: 'tmdb',
      mediaType: 'tv',
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate: details.first_air_date || null,
      rating: typeof details.vote_average === 'number' ? Number(details.vote_average.toFixed(1)) : null,
      description: details.overview || null,
      genres,
      runtime: null,
      developer: null,
      publisher: null,
      platforms: [],
      networks: (details.networks || []).map((network) => network.name).filter(Boolean),
      seasons: typeof details.number_of_seasons === 'number' ? details.number_of_seasons : null,
      totalEpisodes: typeof details.number_of_episodes === 'number' ? details.number_of_episodes : null,
      status: details.status || null,
      tagline: details.tagline || null,
      popularity: typeof details.popularity === 'number' ? Number(details.popularity.toFixed(2)) : null,
      previewImage: getTMDBImageUrl(details.poster_path, 'w185'),
    },
  };
}

async function resolveTMDBItem(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  const [movieResponse, tvResponse] = await Promise.all([
    searchMovies(input.title),
    searchTVShows(input.title),
  ]);

  const bestMovie = pickBestMovieMatch(movieResponse.results || [], input.title, input.year);
  const bestTV = pickBestTVMatch(tvResponse.results || [], input.title, input.year);

  if (!bestMovie && !bestTV) {
    return unresolvedPreview(index, input, 'No TMDB match found in movie or TV');
  }

  const movieScore = bestMovie
    ? calculateMatchScore(bestMovie.title, input.title, getYearFromDate(bestMovie.release_date), input.year) +
      getTMDBTypeBias(input.type, 'movie')
    : Number.NEGATIVE_INFINITY;
  const tvScore = bestTV
    ? calculateMatchScore(bestTV.name, input.title, getYearFromDate(bestTV.first_air_date), input.year) +
      getTMDBTypeBias(input.type, 'tv')
    : Number.NEGATIVE_INFINITY;

  if (bestMovie && (!bestTV || movieScore > tvScore || (movieScore === tvScore && input.type === 'movie'))) {
    return resolveTMDBMovieById(index, input, bestMovie.id);
  }

  if (bestTV) {
    return resolveTMDBTVById(index, input, bestTV.id);
  }

  return resolveTMDBMovieById(index, input, bestMovie!.id);
}

async function resolveIGDBGame(index: number, input: UniversePasteItem, accessToken: string): Promise<UniversePreviewItem> {
  const results = (await searchGames(input.title, accessToken)) as IGDBGameSearchResult[];
  const bestMatch = pickBestGameMatch(results || [], input.title, input.year);

  if (!bestMatch) {
    return unresolvedPreview(index, input, 'No IGDB game match found');
  }

  const genres = (bestMatch.genres || []).map((genre) => genre.name).filter((name): name is string => Boolean(name));
  const platforms = (bestMatch.platforms || [])
    .map((platform) => platform.name)
    .filter((name): name is string => Boolean(name));

  const developer =
    bestMatch.involved_companies?.find((company) => company.developer)?.company?.name?.trim() || null;
  const publisher =
    bestMatch.involved_companies?.find((company) => company.publisher)?.company?.name?.trim() || null;

  const coverUrl = getIGDBCoverUrl(bestMatch.cover?.url);

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: bestMatch.name,
      externalId: bestMatch.id.toString(),
      source: 'igdb',
      mediaType: 'game',
      posterPath: coverUrl,
      backdropPath: null,
      releaseDate: toIsoDateFromUnix(bestMatch.first_release_date),
      rating: typeof bestMatch.rating === 'number' ? Number((bestMatch.rating / 10).toFixed(1)) : null,
      description: bestMatch.summary || bestMatch.storyline || null,
      genres,
      runtime: null,
      developer,
      publisher,
      platforms,
      networks: [],
      seasons: null,
      totalEpisodes: null,
      status: null,
      tagline: null,
      popularity: null,
      previewImage: coverUrl,
    },
  };
}

async function resolveAniListAnime(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  const animeResults = await searchAnime(input.title, 1, 5);
  const bestAnime = pickBestAnimeMatch(animeResults, input.title, input.year);

  if (!bestAnime) {
    return unresolvedPreview(index, input, 'No AniList anime match found');
  }

  const normalizedAnime = normalizeAnimeForApp(bestAnime);

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: normalizedAnime.title,
      externalId: normalizedAnime.id.toString(),
      source: 'anilist',
      mediaType: 'anime',
      posterPath: normalizedAnime.image || null,
      backdropPath: normalizedAnime.banner || null,
      releaseDate: toIsoDateFromAniList(bestAnime),
      rating: typeof normalizedAnime.rating === 'number' ? Number(normalizedAnime.rating.toFixed(1)) : null,
      description: normalizedAnime.description || null,
      genres: normalizedAnime.genres || [],
      runtime: typeof normalizedAnime.duration === 'number' ? normalizedAnime.duration : null,
      developer: null,
      publisher: null,
      platforms: [],
      networks: normalizedAnime.studios || [],
      seasons: 1,
      totalEpisodes: typeof normalizedAnime.episodes === 'number' ? normalizedAnime.episodes : null,
      status: normalizedAnime.status || null,
      tagline: null,
      popularity: typeof normalizedAnime.popularity === 'number' ? Number(normalizedAnime.popularity.toFixed(2)) : null,
      previewImage: normalizedAnime.image || null,
    },
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as UniversePreviewRequestBody;

    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'Invalid payload: items must be an array' }, { status: 400 });
    }

    const parsedItems = body.items
      .map(parseUniversePasteItem)
      .filter((item): item is UniversePasteItem => item !== null);

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'No valid items found in payload' }, { status: 400 });
    }

    let igdbAccessToken: string | null = null;

    const resolvedItems: UniversePreviewItem[] = [];
    for (let index = 0; index < parsedItems.length; index += 1) {
      const item = parsedItems[index];

      try {
        if (item.source === 'tmdb' && (item.type === 'movie' || item.type === 'tv')) {
          resolvedItems.push(await resolveTMDBItem(index, item));
          continue;
        }

        if (item.source === 'igdb' && item.type === 'game') {
          const accessToken: string = igdbAccessToken || (await getIGDBAccessToken());
          igdbAccessToken = accessToken;
          resolvedItems.push(await resolveIGDBGame(index, item, accessToken));
          continue;
        }

        if (item.source === 'anilist' && item.type === 'anime') {
          resolvedItems.push(await resolveAniListAnime(index, item));
          continue;
        }

        resolvedItems.push(
          unresolvedPreview(index, item, `Unsupported source/type combination: ${item.source}:${item.type}`)
        );
      } catch (error) {
        console.error('Failed to resolve universe item:', item, error);
        resolvedItems.push(unresolvedPreview(index, item, 'Failed to resolve item from provider API'));
      }
    }

    const summary = {
      total: resolvedItems.length,
      resolved: resolvedItems.filter((item) => item.status === 'resolved').length,
      unresolved: resolvedItems.filter((item) => item.status === 'unresolved').length,
      animeRerouted: resolvedItems.filter((item) => item.reroutedToAnime).length,
    };

    return NextResponse.json({
      items: resolvedItems,
      summary,
    });
  } catch (error) {
    console.error('Failed to preview universe items:', error);
    return NextResponse.json({ error: 'Failed to preview items' }, { status: 500 });
  }
}
