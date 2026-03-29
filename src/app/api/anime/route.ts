import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrendingAnime, 
  getPopularAnime, 
  getTopRatedAnime, 
  getAiringAnime, 
  getUpcomingAnime,
  discoverAnime,
  searchAnime,
  normalizeAnimeForApp
} from '@/lib/api/anilist';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'trending';
  const timeWindow = searchParams.get('timeWindow') || 'week';
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search');
  
  // Filter parameters (used for discover)
  const genre = searchParams.get('genre') || undefined;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
  const sortBy = searchParams.get('sortBy') || 'POPULARITY_DESC';
  const minRating = searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!, 10) : undefined;
  const maxRating = searchParams.get('maxRating') ? parseInt(searchParams.get('maxRating')!, 10) : undefined;
  const format = searchParams.get('format') || undefined;
  const status = searchParams.get('status') || undefined;
  const season = searchParams.get('season') || undefined;

  try {
    let anime;

    // Handle search first
    if (search) {
      anime = await searchAnime(search, page);
      return NextResponse.json({
        results: anime.map(normalizeAnimeForApp),
        totalPages: 10, // AniList doesn't provide total pages in search
        currentPage: page,
      });
    }

    // Fetch based on category
    switch (category) {
      case 'trending':
        anime = timeWindow === 'day' ? await getAiringAnime(page) : await getTrendingAnime(page);
        break;
      case 'popular':
        anime = await getPopularAnime(page);
        break;
      case 'top_rated':
        anime = await getTopRatedAnime(page);
        break;
      case 'now_playing':
      case 'airing':
        anime = await getAiringAnime(page);
        break;
      case 'upcoming':
        anime = await getUpcomingAnime(page);
        break;
      case 'discover':
        anime = await discoverAnime({
          page,
          genre: genre ? [genre] : undefined,
          year,
          sortBy,
          minRating,
          maxRating,
          format,
          status,
          season,
        });
        break;
      default:
        anime = await getTrendingAnime(page);
    }

    return NextResponse.json({
      results: anime.map(normalizeAnimeForApp),
      totalPages: 10,
      currentPage: page,
    });
  } catch (error) {
    console.error('Failed to fetch anime from AniList:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime' },
      { status: 500 }
    );
  }
}
