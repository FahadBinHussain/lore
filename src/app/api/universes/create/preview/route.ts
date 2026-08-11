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
import { AniListAnime, AniListManga, normalizeAnimeForApp, normalizeMangaForApp, searchAnime, searchManga } from '@/lib/api/anilist';
import { OpenLibraryBook, getOpenLibraryCoverUrl, searchBooks } from '@/lib/api/openlibrary';
import { BGGGame, getBoardGameDetails, searchBoardGames } from '@/lib/api/bgg';
import { ComicVineIssue, ComicVineVolume, getComicVineImageUrl, searchComicVolumes, searchComics } from '@/lib/api/comicvine';
import { ListenNotesPodcast, searchPodcasts } from '@/lib/api/listennotes';
import { MusicBrainzRecording, formatDuration, searchRecordings } from '@/lib/api/musicbrainz';
import { ThemeParkAttraction, searchAttractions } from '@/lib/api/themeparks';

type SupportedInputType =
  | 'movie'
  | 'tv'
  | 'game'
  | 'anime'
  | 'book'
  | 'manga'
  | 'comic'
  | 'boardgame'
  | 'soundtrack'
  | 'podcast'
  | 'themepark'
  | 'other';
type SupportedSource =
  | 'tmdb'
  | 'igdb'
  | 'anilist'
  | 'openlibrary'
  | 'comicvine'
  | 'bgg'
  | 'listennotes'
  | 'musicbrainz'
  | 'themeparks'
  | 'manual';
type UniverseMediaType =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'manga'
  | 'game'
  | 'book'
  | 'comic'
  | 'boardgame'
  | 'soundtrack'
  | 'podcast'
  | 'themepark';

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
  stream?: unknown;
}

interface UniversePreviewSummary {
  total: number;
  resolved: number;
  unresolved: number;
  animeRerouted: number;
}

interface PreviewResolverState {
  igdbAccessToken: string | null;
  knownGamePrefixes: string[];
  knownBookPrefixes: string[];
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

function normalizeInputType(value: unknown): SupportedInputType | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'movie') return 'movie';
  if (normalized === 'tv' || normalized === 'tvshow' || normalized === 'series') return 'tv';
  if (normalized === 'game' || normalized === 'videogame') return 'game';
  if (normalized === 'anime') return 'anime';
  if (normalized === 'book') return 'book';
  if (normalized === 'manga') return 'manga';
  if (normalized === 'comic') return 'comic';
  if (normalized === 'boardgame' || normalized === 'boardgames') return 'boardgame';
  if (normalized === 'soundtrack' || normalized === 'music') return 'soundtrack';
  if (normalized === 'podcast' || normalized === 'podcasts') return 'podcast';
  if (normalized === 'themepark' || normalized === 'attraction' || normalized === 'ride') return 'themepark';
  if (normalized === 'other' || normalized === 'misc' || normalized === 'miscellaneous') return 'other';
  return 'other';
}

function normalizeInputSource(value: unknown): SupportedSource | null {
  if (typeof value !== 'string') return 'manual';

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === '' || normalized === 'manual' || normalized === 'none' || normalized === 'na' || normalized === 'n/a') {
    return 'manual';
  }
  if (normalized === 'tmdb') return 'tmdb';
  if (normalized === 'igdb') return 'igdb';
  if (normalized === 'anilist' || normalized === 'ani') return 'anilist';
  if (normalized === 'openlibrary' || normalized === 'ol') return 'openlibrary';
  if (normalized === 'comicvine') return 'comicvine';
  if (normalized === 'bgg' || normalized === 'boardgamegeek') return 'bgg';
  if (normalized === 'listennotes' || normalized === 'listenapi') return 'listennotes';
  if (normalized === 'musicbrainz') return 'musicbrainz';
  if (normalized === 'themeparks' || normalized === 'themeparkswiki' || normalized === 'themeparkwiki') return 'themeparks';
  return 'manual';
}

function getDefaultSourceForType(type: SupportedInputType): SupportedSource {
  switch (type) {
    case 'movie':
    case 'tv':
      return 'tmdb';
    case 'game':
      return 'igdb';
    case 'anime':
    case 'manga':
      return 'anilist';
    case 'book':
      return 'openlibrary';
    case 'comic':
      return 'comicvine';
    case 'boardgame':
      return 'bgg';
    case 'podcast':
      return 'listennotes';
    case 'soundtrack':
      return 'musicbrainz';
    case 'themepark':
      return 'themeparks';
    default:
      return 'manual';
  }
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

function toIsoDateFromYear(year?: number): string | null {
  if (typeof year !== 'number' || !Number.isFinite(year)) return null;
  return `${Math.trunc(year)}-01-01`;
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

function pickBestBookMatch(results: OpenLibraryBook[], queryTitle: string, queryYear?: number): OpenLibraryBook | null {
  if (results.length === 0) return null;

  const scored = results.map((book) => ({
    book,
    score: calculateMatchScore(book.title, queryTitle, book.first_publish_year, queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.book ?? null;
}

function pickBestMangaMatch(results: AniListManga[], queryTitle: string, queryYear?: number): AniListManga | null {
  if (results.length === 0) return null;

  const scored = results.map((manga) => {
    const titles = [manga.title.romaji, manga.title.english, manga.title.native].filter(
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
    if (typeof manga.startDate?.year === 'number' && typeof queryYear === 'number') {
      const yearDiff = Math.abs(manga.startDate.year - queryYear);
      if (yearDiff === 0) yearScore = 20;
      else if (yearDiff === 1) yearScore = 10;
      else if (yearDiff === 2) yearScore = 5;
    }

    return {
      manga,
      score: bestTitleScore + yearScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.manga ?? null;
}

function pickBestComicMatch(results: ComicVineIssue[], queryTitle: string, queryYear?: number): ComicVineIssue | null {
  if (results.length === 0) return null;

  const scored = results.map((comic) => ({
    comic,
    score: calculateMatchScore(comic.name || comic.volume?.name || '', queryTitle, getYearFromDate(comic.cover_date), queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.comic ?? null;
}

function pickBestComicVolumeMatch(results: ComicVineVolume[], queryTitle: string, queryYear?: number): ComicVineVolume | null {
  if (results.length === 0) return null;

  const scored = results.map((volume) => ({
    volume,
    score: calculateMatchScore(volume.name, queryTitle, volume.start_year, queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.volume ?? null;
}

function pickBestBoardGameMatch(results: BGGGame[], queryTitle: string, queryYear?: number): BGGGame | null {
  if (results.length === 0) return null;

  const scored = results.map((game) => ({
    game,
    score: calculateMatchScore(game.name, queryTitle, game.year_published, queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.game ?? null;
}

function pickBestPodcastMatch(results: ListenNotesPodcast[], queryTitle: string): ListenNotesPodcast | null {
  if (results.length === 0) return null;

  const scored = results.map((podcast) => ({
    podcast,
    score: calculateMatchScore(podcast.title, queryTitle),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.podcast ?? null;
}

function pickBestRecordingMatch(results: MusicBrainzRecording[], queryTitle: string, queryYear?: number): MusicBrainzRecording | null {
  if (results.length === 0) return null;

  const scored = results.map((recording) => ({
    recording,
    score: calculateMatchScore(recording.title, queryTitle, getYearFromDate(recording.releases?.[0]?.date), queryYear),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.recording ?? null;
}

function pickBestAttractionMatch(results: ThemeParkAttraction[], queryTitle: string): ThemeParkAttraction | null {
  if (results.length === 0) return null;

  const scored = results.map((attraction) => ({
    attraction,
    score: calculateMatchScore(attraction.name, queryTitle),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.attraction ?? null;
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
  const parsedType = normalizeInputType(raw.type);
  const parsedSource = normalizeInputSource(raw.source);

  if (!title) return null;
  if (!parsedType || !parsedSource) return null;

  let year: number | undefined;
  if (typeof raw.year === 'number' && Number.isFinite(raw.year)) {
    year = Math.trunc(raw.year);
  } else if (typeof raw.year === 'string' && raw.year.trim().length > 0) {
    const parsedYear = Number.parseInt(raw.year.trim(), 10);
    if (!Number.isNaN(parsedYear)) {
      year = parsedYear;
    }
  }

  const rawSource = typeof raw.source === 'string' ? raw.source.trim().toLowerCase() : '';
  const source =
    parsedSource === 'manual' && rawSource !== 'manual'
      ? getDefaultSourceForType(parsedType)
      : parsedSource;

  return {
    title,
    year,
    type: parsedType,
    source,
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

function formatInputTypeLabel(inputType: SupportedInputType): string {
  if (inputType === 'other') return 'other';
  if (inputType === 'themepark') return 'theme park';
  if (inputType === 'boardgame') return 'board game';
  return inputType;
}

function buildResolverUnavailableReason(input: UniversePasteItem): string {
  const typeLabel = formatInputTypeLabel(input.type);
  if (input.source === 'manual') {
    return `No API resolver configured for ${typeLabel} items yet`;
  }
  return `No ${input.source.toUpperCase()} ${typeLabel} resolver yet`;
}

function getTMDBTypeBias(inputType: SupportedInputType, candidateType: 'movie' | 'tv') {
  if (inputType === candidateType) {
    return 8;
  }
  return 0;
}

function cleanQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const TITLE_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'to',
  'for',
  'with',
  'in',
  'on',
  'at',
  'from',
  'by',
]);

function getMeaningfulTitleTokens(value: string): string[] {
  return cleanQuery(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TITLE_STOP_WORDS.has(token));
}

function countTitleTokenOverlap(candidateTitle: string, queryTitle: string): number {
  const queryTokens = Array.from(new Set(getMeaningfulTitleTokens(queryTitle)));
  if (queryTokens.length === 0) return 0;

  const candidateTokens = new Set(getMeaningfulTitleTokens(candidateTitle));
  return queryTokens.filter((token) => candidateTokens.has(token)).length;
}

function getRequiredTokenOverlap(queryTitle: string): number {
  const tokenCount = getMeaningfulTitleTokens(queryTitle).length;
  if (tokenCount === 0) return 0;
  return Math.min(2, tokenCount);
}

function buildConfidenceAnchorsForGame(title: string): string[] {
  const anchors = new Set<string>([cleanQuery(title)]);

  const mawChapterMatch = title.match(/^Secrets of the Maw\s*:\s*(.+)$/i);
  if (mawChapterMatch?.[1]) {
    const chapter = cleanQuery(mawChapterMatch[1]);
    anchors.add(`Little Nightmares: ${chapter}`);
    anchors.add(`Little Nightmares ${chapter}`);
  }

  return Array.from(anchors);
}

function getBestAnchorOverlap(candidateTitle: string, anchors: string[]): { overlap: number; required: number } {
  let bestOverlap = 0;
  let bestRequired = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const anchor of anchors) {
    const overlap = countTitleTokenOverlap(candidateTitle, anchor);
    const required = getRequiredTokenOverlap(anchor);
    const score = overlap - Math.max(0, required - overlap) * 10;

    if (score > bestScore) {
      bestScore = score;
      bestOverlap = overlap;
      bestRequired = required;
    }
  }

  return { overlap: bestOverlap, required: bestRequired };
}

interface QueryMatchConfidence {
  score: number;
  tokenOverlap: number;
  requiredTokenOverlap: number;
  query: string;
}

function getBestQueryMatchConfidence(
  candidateTitle: string,
  candidateYear: number | undefined,
  queryTitles: string[],
  queryYear?: number
): QueryMatchConfidence {
  const normalizedQueries = Array.from(
    new Set(
      queryTitles
        .map((query) => cleanQuery(query))
        .filter((query) => query.length > 0)
    )
  );

  if (normalizedQueries.length === 0) {
    normalizedQueries.push(candidateTitle);
  }

  let best: QueryMatchConfidence = {
    score: Number.NEGATIVE_INFINITY,
    tokenOverlap: 0,
    requiredTokenOverlap: 0,
    query: normalizedQueries[0],
  };

  let bestRank = Number.NEGATIVE_INFINITY;

  for (const query of normalizedQueries) {
    const score = calculateMatchScore(candidateTitle, query, candidateYear, queryYear);
    const tokenOverlap = countTitleTokenOverlap(candidateTitle, query);
    const requiredTokenOverlap = getRequiredTokenOverlap(query);

    // Prefer higher score first, then stronger token overlap and lower missing-token penalty.
    const rank = score + tokenOverlap * 2 - Math.max(0, requiredTokenOverlap - tokenOverlap) * 25;

    if (rank > bestRank) {
      bestRank = rank;
      best = {
        score,
        tokenOverlap,
        requiredTokenOverlap,
        query,
      };
      continue;
    }

    if (rank === bestRank) {
      if (
        score > best.score ||
        (score === best.score && tokenOverlap > best.tokenOverlap)
      ) {
        best = {
          score,
          tokenOverlap,
          requiredTokenOverlap,
          query,
        };
      }
    }
  }

  return best;
}

function extractFranchisePrefix(title: string): string | null {
  const tokens = getMeaningfulTitleTokens(title);
  if (tokens.length === 0) return null;

  return tokens.slice(0, 2).join(' ');
}

function rememberFranchisePrefix(bucket: string[], title: string): void {
  const prefix = extractFranchisePrefix(title);
  if (!prefix) return;
  if (bucket.includes(prefix)) return;

  bucket.push(prefix);
  if (bucket.length > 8) {
    bucket.shift();
  }
}

function buildTMDBQueryCandidates(title: string): string[] {
  const candidates = new Set<string>();
  const push = (value: string) => {
    const normalized = cleanQuery(value);
    if (normalized.length > 0) {
      candidates.add(normalized);
    }
  };

  push(title);
  push(title.replace(/\b(the\s+series|series)\b/gi, ''));
  push(title.replace(/\([^)]*\)/g, ''));

  const colonParts = title.split(':');
  if (colonParts.length > 1) {
    push(colonParts[0]);
  }

  const dashParts = title.split(' - ');
  if (dashParts.length > 1) {
    push(dashParts[0]);
  }

  return Array.from(candidates);
}

function buildIGDBQueryCandidates(title: string, knownPrefixes: string[] = []): string[] {
  const candidates = new Set<string>();
  const push = (value: string) => {
    const normalized = cleanQuery(value);
    if (normalized.length >= 2) {
      candidates.add(normalized);
    }
  };

  push(title);
  const withoutParens = title.replace(/\([^)]*\)/g, '');
  const withoutSuffix = title.replace(/[:\-|].*$/, '');
  push(withoutParens);
  push(withoutSuffix);

  const tokens = getMeaningfulTitleTokens(title);
  for (const token of tokens) {
    push(token);
  }

  // Franchise alias fallback:
  // "Secrets of the Maw: The Depths" is catalogued in IGDB as "Little Nightmares: The Depths".
  const mawChapterMatch = title.match(/^Secrets of the Maw\s*:\s*(.+)$/i);
  if (mawChapterMatch?.[1]) {
    const chapter = cleanQuery(mawChapterMatch[1]);
    push(`Little Nightmares: ${chapter}`);
    push(`Little Nightmares ${chapter}`);
  }

  for (const prefix of knownPrefixes) {
    push(`${prefix} ${title}`);
    if (withoutParens !== title) {
      push(`${prefix} ${withoutParens}`);
    }
    if (withoutSuffix !== title) {
      push(`${prefix} ${withoutSuffix}`);
    }
  }

  return Array.from(candidates).slice(0, 14);
}

function buildOpenLibraryQueryCandidates(title: string, knownPrefixes: string[] = []): string[] {
  const candidates = new Set<string>();
  const push = (value: string) => {
    const normalized = cleanQuery(value);
    if (normalized.length >= 2) {
      candidates.add(normalized);
    }
  };

  push(title);
  const withoutParens = title.replace(/\([^)]*\)/g, '');
  const withoutSuffix = title.replace(/[:\-|].*$/, '');
  const normalizedIssue = title
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/issue\s*#\s*(\d+)/gi, 'issue $1')
    .replace(/\s+/g, ' ');
  const noIssueMarker = title.replace(/issue\s*#?\s*\d+/gi, '').replace(/\s+/g, ' ').trim();

  push(withoutParens);
  push(withoutSuffix);
  push(normalizedIssue);
  push(noIssueMarker);

  for (const prefix of knownPrefixes) {
    push(`${prefix} ${title}`);
    push(`${prefix} ${normalizedIssue}`);
    if (withoutSuffix !== title) {
      push(`${prefix} ${withoutSuffix}`);
    }
  }

  return Array.from(candidates).slice(0, 12);
}

async function searchTMDBWithFallback(title: string): Promise<{ movies: TMDBMovie[]; tvShows: TMDBTVShow[]; queries: string[] }> {
  const queries = buildTMDBQueryCandidates(title);
  const moviesById = new Map<number, TMDBMovie>();
  const tvById = new Map<number, TMDBTVShow>();

  for (const query of queries) {
    const [movieResponse, tvResponse] = await Promise.all([searchMovies(query), searchTVShows(query)]);

    for (const movie of movieResponse.results || []) {
      moviesById.set(movie.id, movie);
    }
    for (const tv of tvResponse.results || []) {
      tvById.set(tv.id, tv);
    }
  }

  return {
    movies: Array.from(moviesById.values()),
    tvShows: Array.from(tvById.values()),
    queries,
  };
}

async function searchIGDBWithFallback(
  title: string,
  accessToken: string,
  knownPrefixes: string[] = []
): Promise<{ games: IGDBGameSearchResult[]; queries: string[] }> {
  const queries = buildIGDBQueryCandidates(title, knownPrefixes);
  const gamesById = new Map<number, IGDBGameSearchResult>();

  for (const query of queries) {
    const games = (await searchGames(query, accessToken)) as IGDBGameSearchResult[];
    for (const game of games || []) {
      gamesById.set(game.id, game);
    }
  }

  return {
    games: Array.from(gamesById.values()),
    queries,
  };
}

async function searchOpenLibraryWithFallback(
  title: string,
  knownPrefixes: string[] = []
): Promise<{ books: OpenLibraryBook[]; queries: string[] }> {
  const queries = buildOpenLibraryQueryCandidates(title, knownPrefixes);
  const booksByKey = new Map<string, OpenLibraryBook>();

  for (const query of queries) {
    const response = await searchBooks(query, 1);
    for (const book of response.docs || []) {
      if (book?.key) {
        booksByKey.set(book.key, book);
      }
    }
  }

  return {
    books: Array.from(booksByKey.values()),
    queries,
  };
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
  const { movies, tvShows, queries } = await searchTMDBWithFallback(input.title);
  const bestMovie = pickBestMovieMatch(movies, input.title, input.year);
  const bestTV = pickBestTVMatch(tvShows, input.title, input.year);

  if (!bestMovie && !bestTV) {
    return unresolvedPreview(index, input, `No TMDB match found in movie or TV (tried: ${queries.join(' | ')})`);
  }

  const requiredTokenOverlap = getRequiredTokenOverlap(input.title);

  const movieBaseScore = bestMovie
    ? calculateMatchScore(bestMovie.title, input.title, getYearFromDate(bestMovie.release_date), input.year)
    : Number.NEGATIVE_INFINITY;
  const tvBaseScore = bestTV
    ? calculateMatchScore(bestTV.name, input.title, getYearFromDate(bestTV.first_air_date), input.year)
    : Number.NEGATIVE_INFINITY;

  const movieOverlap = bestMovie ? countTitleTokenOverlap(bestMovie.title, input.title) : 0;
  const tvOverlap = bestTV ? countTitleTokenOverlap(bestTV.name, input.title) : 0;

  const isMovieConfident =
    Boolean(bestMovie) &&
    movieBaseScore >= 35 &&
    movieOverlap >= requiredTokenOverlap;
  const isTVConfident =
    Boolean(bestTV) &&
    tvBaseScore >= 35 &&
    tvOverlap >= requiredTokenOverlap;

  if (!isMovieConfident && !isTVConfident) {
    return unresolvedPreview(index, input, `No confident TMDB match found in movie or TV (tried: ${queries.join(' | ')})`);
  }

  const movieScore = isMovieConfident
    ? movieBaseScore + getTMDBTypeBias(input.type, 'movie')
    : Number.NEGATIVE_INFINITY;
  const tvScore = isTVConfident
    ? tvBaseScore + getTMDBTypeBias(input.type, 'tv')
    : Number.NEGATIVE_INFINITY;

  if (bestMovie && movieScore >= tvScore) {
    return resolveTMDBMovieById(index, input, bestMovie.id);
  }

  if (bestTV && isTVConfident) {
    return resolveTMDBTVById(index, input, bestTV.id);
  }

  return unresolvedPreview(index, input, `No confident TMDB match found in movie or TV (tried: ${queries.join(' | ')})`);
}

async function resolveIGDBGame(
  index: number,
  input: UniversePasteItem,
  accessToken: string,
  state: PreviewResolverState
): Promise<UniversePreviewItem> {
  const { games, queries } = await searchIGDBWithFallback(input.title, accessToken, state.knownGamePrefixes);
  const confidenceQueries = [input.title, ...queries];
  const rankedGames = (games || [])
    .map((game) => ({
      game,
      confidence: getBestQueryMatchConfidence(
        game.name,
        getYearFromUnix(game.first_release_date),
        confidenceQueries,
        input.year
      ),
    }))
    .sort((a, b) => {
      if (b.confidence.score !== a.confidence.score) {
        return b.confidence.score - a.confidence.score;
      }
      if (b.confidence.tokenOverlap !== a.confidence.tokenOverlap) {
        return b.confidence.tokenOverlap - a.confidence.tokenOverlap;
      }
      return 0;
    });

  const bestEntry = rankedGames[0];
  const bestMatch = bestEntry?.game;
  const matchScore = bestEntry?.confidence.score ?? 0;
  const tokenOverlap = bestEntry?.confidence.tokenOverlap ?? 0;
  const requiredTokenOverlap = bestEntry?.confidence.requiredTokenOverlap ?? getRequiredTokenOverlap(input.title);
  const confidenceAnchors = buildConfidenceAnchorsForGame(input.title);
  const anchorOverlap = bestMatch ? getBestAnchorOverlap(bestMatch.name, confidenceAnchors) : { overlap: 0, required: getRequiredTokenOverlap(input.title) };

  if (
    !bestMatch ||
    tokenOverlap < requiredTokenOverlap ||
    anchorOverlap.overlap < anchorOverlap.required ||
    matchScore < 35
  ) {
    return unresolvedPreview(index, input, `No IGDB game match found (tried: ${queries.join(' | ')})`);
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
  rememberFranchisePrefix(state.knownGamePrefixes, bestMatch.name);

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

  const animeTitles = [bestAnime.title.romaji, bestAnime.title.english, bestAnime.title.native].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  let bestTitleScore = 0;
  let bestTokenOverlap = 0;
  for (const animeTitle of animeTitles) {
    bestTitleScore = Math.max(bestTitleScore, calculateMatchScore(animeTitle, input.title));
    bestTokenOverlap = Math.max(bestTokenOverlap, countTitleTokenOverlap(animeTitle, input.title));
  }

  let yearScore = 0;
  if (typeof bestAnime.seasonYear === 'number' && typeof input.year === 'number') {
    const yearDiff = Math.abs(bestAnime.seasonYear - input.year);
    if (yearDiff === 0) yearScore = 20;
    else if (yearDiff === 1) yearScore = 10;
    else if (yearDiff === 2) yearScore = 5;
  }

  const matchScore = bestTitleScore + yearScore;
  const requiredTokenOverlap = getRequiredTokenOverlap(input.title);

  if (matchScore < 35 || bestTokenOverlap < requiredTokenOverlap) {
    return unresolvedPreview(index, input, 'No confident AniList anime match found');
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

async function resolveOpenLibraryBook(
  index: number,
  input: UniversePasteItem,
  state: PreviewResolverState
): Promise<UniversePreviewItem> {
  const { books, queries } = await searchOpenLibraryWithFallback(input.title, state.knownBookPrefixes);
  const confidenceQueries = [input.title, ...queries];
  const rankedBooks = (books || [])
    .map((book) => ({
      book,
      confidence: getBestQueryMatchConfidence(
        book.title,
        typeof book.first_publish_year === 'number' ? book.first_publish_year : undefined,
        confidenceQueries,
        input.year
      ),
    }))
    .sort((a, b) => {
      if (b.confidence.score !== a.confidence.score) {
        return b.confidence.score - a.confidence.score;
      }
      if (b.confidence.tokenOverlap !== a.confidence.tokenOverlap) {
        return b.confidence.tokenOverlap - a.confidence.tokenOverlap;
      }
      return 0;
    });
  const bestEntry = rankedBooks[0];
  const bestBook = bestEntry?.book;

  if (!bestBook) {
    return unresolvedPreview(index, input, `No Open Library book match found (tried: ${queries.join(' | ')})`);
  }

  const matchScore = bestEntry?.confidence.score ?? 0;
  const tokenOverlap = bestEntry?.confidence.tokenOverlap ?? 0;
  const requiredTokenOverlap = bestEntry?.confidence.requiredTokenOverlap ?? getRequiredTokenOverlap(input.title);
  const originalTitleOverlap = countTitleTokenOverlap(bestBook.title, input.title);
  const originalRequiredOverlap = getRequiredTokenOverlap(input.title);

  if (
    matchScore < 35 ||
    tokenOverlap < requiredTokenOverlap ||
    originalTitleOverlap < originalRequiredOverlap
  ) {
    return unresolvedPreview(index, input, `No confident Open Library book match found (tried: ${queries.join(' | ')})`);
  }

  const externalId = bestBook.key.replace('/works/', '').replace(/^\/+/, '');
  if (!externalId) {
    return unresolvedPreview(index, input, 'Matched book is missing an Open Library work ID');
  }

  const coverLarge = getOpenLibraryCoverUrl(bestBook.cover_i, 'L');
  const coverMedium = getOpenLibraryCoverUrl(bestBook.cover_i, 'M');
  const subjects = (bestBook.subject || []).filter((subject): subject is string => Boolean(subject)).slice(0, 10);
  const description = subjects.length > 0 ? subjects.slice(0, 4).join(', ') : null;
  const primaryPublisher = (bestBook.publisher || []).find((publisher) => typeof publisher === 'string' && publisher.trim().length > 0) || null;
  rememberFranchisePrefix(state.knownBookPrefixes, bestBook.title);

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: bestBook.title,
      externalId,
      source: 'openlibrary',
      mediaType: 'book',
      posterPath: coverLarge,
      backdropPath: null,
      releaseDate: toIsoDateFromYear(bestBook.first_publish_year),
      rating: typeof bestBook.ratings_average === 'number' ? Number(bestBook.ratings_average.toFixed(1)) : null,
      description,
      genres: subjects,
      runtime: null,
      developer: null,
      publisher: primaryPublisher,
      platforms: [],
      networks: [],
      seasons: null,
      totalEpisodes: null,
      status: null,
      tagline: null,
      popularity: null,
      previewImage: coverMedium || coverLarge,
    },
  };
}

async function resolveAniListManga(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  const mangaResults = await searchManga(input.title, 1, 5);
  const bestManga = pickBestMangaMatch(mangaResults, input.title, input.year);

  if (!bestManga) {
    return unresolvedPreview(index, input, 'No AniList manga match found');
  }

  const mangaTitles = [bestManga.title.romaji, bestManga.title.english, bestManga.title.native].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  const bestTokenOverlap = Math.max(
    ...mangaTitles.map((title) => countTitleTokenOverlap(title, input.title)),
    0
  );

  if (bestTokenOverlap < getRequiredTokenOverlap(input.title)) {
    return unresolvedPreview(index, input, 'No confident AniList manga match found');
  }

  const normalizedManga = normalizeMangaForApp(bestManga);
  const releaseDate = bestManga.startDate?.year
    ? `${bestManga.startDate.year}-${`${bestManga.startDate.month ?? 1}`.padStart(2, '0')}-${`${bestManga.startDate.day ?? 1}`.padStart(2, '0')}`
    : null;

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: normalizedManga.title,
      externalId: normalizedManga.id.toString(),
      source: 'anilist',
      mediaType: 'manga',
      posterPath: normalizedManga.image || null,
      backdropPath: normalizedManga.banner || null,
      releaseDate,
      rating: typeof normalizedManga.rating === 'number' ? Number(normalizedManga.rating.toFixed(1)) : null,
      description: normalizedManga.description || null,
      genres: normalizedManga.genres || [],
      runtime: null,
      developer: null,
      publisher: null,
      platforms: [],
      networks: [],
      seasons: null,
      totalEpisodes: typeof normalizedManga.chapters === 'number' ? normalizedManga.chapters : null,
      status: normalizedManga.status || null,
      tagline: null,
      popularity: typeof normalizedManga.popularity === 'number' ? Number(normalizedManga.popularity.toFixed(2)) : null,
      previewImage: normalizedManga.image || null,
    },
  };
}

async function resolveComicVineComic(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  if (!process.env.COMICVINE_API_KEY) {
    return unresolvedPreview(index, input, 'Comic Vine API key is not configured');
  }

  const [comics, volumes] = await Promise.all([
    searchComics(input.title, 1),
    searchComicVolumes(input.title, 1),
  ]);
  const bestComic = pickBestComicMatch(comics.results || [], input.title, input.year);
  const bestVolume = pickBestComicVolumeMatch(volumes.results || [], input.title, input.year);
  const issueScore = bestComic
    ? calculateMatchScore(bestComic.name || bestComic.volume?.name || '', input.title, getYearFromDate(bestComic.cover_date), input.year)
    : Number.NEGATIVE_INFINITY;
  const volumeScore = bestVolume
    ? calculateMatchScore(bestVolume.name, input.title, bestVolume.start_year, input.year)
    : Number.NEGATIVE_INFINITY;

  if (!bestComic && !bestVolume) {
    return unresolvedPreview(index, input, 'No Comic Vine issue match found');
  }

  if (bestVolume && volumeScore >= issueScore) {
    return {
      index,
      input,
      status: 'resolved',
      selected: true,
      resolved: {
        title: bestVolume.name,
        externalId: `volume-${bestVolume.id}`,
        source: 'comicvine',
        mediaType: 'comic',
        posterPath: getComicVineImageUrl(bestVolume.image),
        backdropPath: null,
        releaseDate: toIsoDateFromYear(bestVolume.start_year),
        rating: null,
        description: bestVolume.description || null,
        genres: [],
        runtime: null,
        developer: null,
        publisher: bestVolume.publisher?.name || null,
        platforms: [],
        networks: [],
        seasons: null,
        totalEpisodes: null,
        status: null,
        tagline: bestVolume.publisher?.name || null,
        popularity: null,
        previewImage: getComicVineImageUrl(bestVolume.image),
      },
    };
  }

  if (!bestComic) {
    return unresolvedPreview(index, input, 'No Comic Vine issue match found');
  }

  return {
    index,
    input,
    status: 'resolved',
      selected: true,
    resolved: {
      title: bestComic.name || `${bestComic.volume?.name || input.title}${bestComic.issue_number ? ` #${bestComic.issue_number}` : ''}`,
      externalId: `issue-${bestComic.id}`,
      source: 'comicvine',
      mediaType: 'comic',
      posterPath: getComicVineImageUrl(bestComic.image),
      backdropPath: null,
      releaseDate: bestComic.cover_date || null,
      rating: null,
      description: bestComic.description || null,
      genres: [],
      runtime: null,
      developer: null,
      publisher: null,
      platforms: [],
      networks: bestComic.volume?.name ? [bestComic.volume.name] : [],
      seasons: null,
      totalEpisodes: null,
      status: null,
      tagline: bestComic.issue_number ? `Issue #${bestComic.issue_number}` : null,
      popularity: null,
      previewImage: getComicVineImageUrl(bestComic.image),
    },
  };
}

async function resolveBoardGameGeekItem(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  const games = await searchBoardGames(input.title, process.env.BGG_API_KEY);
  const bestGame = pickBestBoardGameMatch(games, input.title, input.year);

  if (!bestGame?.id) {
    return unresolvedPreview(index, input, 'No BoardGameGeek match found');
  }

  let details = bestGame;
  try {
    details = await getBoardGameDetails(bestGame.id, process.env.BGG_API_KEY);
  } catch {
    details = bestGame;
  }

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: details.name,
      externalId: details.id,
      source: 'bgg',
      mediaType: 'boardgame',
      posterPath: details.image_url || details.thumb_url || null,
      backdropPath: null,
      releaseDate: toIsoDateFromYear(details.year_published),
      rating: null,
      description: details.description || null,
      genres: [...(details.categories || []), ...(details.mechanics || [])].slice(0, 10),
      runtime: details.max_playtime || details.min_playtime || null,
      developer: details.designers?.[0] || null,
      publisher: details.publishers?.[0] || null,
      platforms: [],
      networks: [],
      seasons: null,
      totalEpisodes: null,
      status: null,
      tagline: details.min_players && details.max_players ? `${details.min_players}-${details.max_players} players` : null,
      popularity: null,
      previewImage: details.thumb_url || details.image_url || null,
    },
  };
}

async function resolveListenNotesPodcast(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  if (!process.env.LISTEN_NOTES_API_KEY) {
    return unresolvedPreview(index, input, 'Listen Notes API key is not configured');
  }

  const podcasts = await searchPodcasts(input.title);
  const bestPodcast = pickBestPodcastMatch(podcasts.results || [], input.title);

  if (!bestPodcast?.id) {
    return unresolvedPreview(index, input, 'No Listen Notes podcast match found');
  }

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: bestPodcast.title,
      externalId: bestPodcast.id,
      source: 'listennotes',
      mediaType: 'podcast',
      posterPath: bestPodcast.image || bestPodcast.thumbnail || null,
      backdropPath: null,
      releaseDate: null,
      rating: typeof bestPodcast.listen_score === 'number' ? bestPodcast.listen_score : null,
      description: bestPodcast.description || null,
      genres: [],
      runtime: null,
      developer: null,
      publisher: bestPodcast.publisher || null,
      platforms: [],
      networks: [],
      seasons: null,
      totalEpisodes: typeof bestPodcast.total_episodes === 'number' ? bestPodcast.total_episodes : null,
      status: null,
      tagline: bestPodcast.publisher || null,
      popularity: null,
      previewImage: bestPodcast.thumbnail || bestPodcast.image || null,
    },
  };
}

async function resolveMusicBrainzSoundtrack(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  const recordings = await searchRecordings(input.title, 10);
  const bestRecording = pickBestRecordingMatch(recordings, input.title, input.year);

  if (!bestRecording?.id) {
    return unresolvedPreview(index, input, 'No MusicBrainz recording match found');
  }

  const release = bestRecording.releases?.[0];
  const artist = bestRecording['artist-credit']?.map((credit) => credit.artist.name).filter(Boolean).join(', ') || null;

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: bestRecording.title,
      externalId: bestRecording.id,
      source: 'musicbrainz',
      mediaType: 'soundtrack',
      posterPath: null,
      backdropPath: null,
      releaseDate: release?.date || null,
      rating: null,
      description: artist ? `${bestRecording.title} by ${artist}${formatDuration(bestRecording.length) ? ` (${formatDuration(bestRecording.length)})` : ''}.` : null,
      genres: bestRecording.tags?.slice(0, 10).map((tag) => tag.name).filter(Boolean) || [],
      runtime: bestRecording.length ? Math.round(bestRecording.length / 60000) : null,
      developer: null,
      publisher: artist,
      platforms: [],
      networks: release?.title ? [release.title] : [],
      seasons: null,
      totalEpisodes: null,
      status: null,
      tagline: artist,
      popularity: null,
      previewImage: null,
    },
  };
}

async function resolveThemeParksItem(index: number, input: UniversePasteItem): Promise<UniversePreviewItem> {
  const attractions = await searchAttractions(input.title);
  const bestAttraction = pickBestAttractionMatch(attractions, input.title);

  if (!bestAttraction?.id) {
    return unresolvedPreview(index, input, 'No ThemeParks.wiki attraction match found');
  }

  return {
    index,
    input,
    status: 'resolved',
    selected: true,
    resolved: {
      title: bestAttraction.name,
      externalId: bestAttraction.id,
      source: 'themeparks',
      mediaType: 'themepark',
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      rating: null,
      description: bestAttraction.description || `${bestAttraction.name} at ${bestAttraction.parkName}.`,
      genres: [],
      runtime: null,
      developer: null,
      publisher: bestAttraction.parkName || null,
      platforms: [],
      networks: [],
      seasons: null,
      totalEpisodes: null,
      status: bestAttraction.status || null,
      tagline: bestAttraction.parkName || null,
      popularity: null,
      previewImage: null,
    },
  };
}

function buildPreviewSummary(items: UniversePreviewItem[], total: number): UniversePreviewSummary {
  return {
    total,
    resolved: items.filter((item) => item.status === 'resolved').length,
    unresolved: items.filter((item) => item.status === 'unresolved').length,
    animeRerouted: items.filter((item) => item.reroutedToAnime).length,
  };
}

function shouldUseStreamingPreview(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export async function resolvePreviewItem(
  index: number,
  item: UniversePasteItem,
  state: PreviewResolverState
): Promise<UniversePreviewItem> {
  try {
    if (item.source === 'tmdb' && (item.type === 'movie' || item.type === 'tv')) {
      return await resolveTMDBItem(index, item);
    }

    if (item.source === 'igdb' && item.type === 'game') {
      const accessToken = state.igdbAccessToken || (await getIGDBAccessToken());
      state.igdbAccessToken = accessToken;
      return await resolveIGDBGame(index, item, accessToken, state);
    }

    if (item.source === 'anilist' && item.type === 'anime') {
      return await resolveAniListAnime(index, item);
    }

    if (item.source === 'anilist' && item.type === 'manga') {
      return await resolveAniListManga(index, item);
    }

    if (item.source === 'openlibrary' && item.type === 'book') {
      return await resolveOpenLibraryBook(index, item, state);
    }

    if (item.source === 'comicvine' && item.type === 'comic') {
      return await resolveComicVineComic(index, item);
    }

    if (item.source === 'bgg' && item.type === 'boardgame') {
      return await resolveBoardGameGeekItem(index, item);
    }

    if (item.source === 'listennotes' && item.type === 'podcast') {
      return await resolveListenNotesPodcast(index, item);
    }

    if (item.source === 'musicbrainz' && item.type === 'soundtrack') {
      return await resolveMusicBrainzSoundtrack(index, item);
    }

    if (item.source === 'themeparks' && item.type === 'themepark') {
      return await resolveThemeParksItem(index, item);
    }

    return unresolvedPreview(index, item, buildResolverUnavailableReason(item));
  } catch (error) {
    console.error('Failed to resolve universe item:', item, error);
    return unresolvedPreview(index, item, 'Failed to resolve item from provider API');
  }
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

    const useStreamingPreview = shouldUseStreamingPreview(body.stream);
    const resolverState: PreviewResolverState = {
      igdbAccessToken: null,
      knownGamePrefixes: [],
      knownBookPrefixes: [],
    };

    if (useStreamingPreview) {
      const encoder = new TextEncoder();
      const total = parsedItems.length;

      const stream = new ReadableStream({
        async start(controller) {
          const resolvedItems: UniversePreviewItem[] = [];
          const write = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          write({ type: 'start', total });

          for (let index = 0; index < parsedItems.length; index += 1) {
            const resolvedItem = await resolvePreviewItem(index, parsedItems[index], resolverState);
            resolvedItems.push(resolvedItem);
            write({
              type: 'item',
              item: resolvedItem,
              processed: index + 1,
              summary: buildPreviewSummary(resolvedItems, total),
            });
          }

          write({
            type: 'done',
            items: resolvedItems,
            summary: buildPreviewSummary(resolvedItems, total),
          });
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const resolvedItems: UniversePreviewItem[] = [];
    for (let index = 0; index < parsedItems.length; index += 1) {
      resolvedItems.push(await resolvePreviewItem(index, parsedItems[index], resolverState));
    }

    return NextResponse.json({
      items: resolvedItems,
      summary: buildPreviewSummary(resolvedItems, parsedItems.length),
    });
  } catch (error) {
    console.error('Failed to preview universe items:', error);
    return NextResponse.json({ error: 'Failed to preview items' }, { status: 500 });
  }
}

