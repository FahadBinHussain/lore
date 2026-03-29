import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrendingAnime, 
  getPopularAnime, 
  getTopRatedAnime, 
  getAiringAnime, 
  getUpcomingAnime,
  searchAnime,
  normalizeAnimeForApp
} from '@/lib/api/anilist';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'trending';
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search');

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
        anime = await getTrendingAnime(page);
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
        anime = await getPopularAnime(page);
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
