import { NextRequest, NextResponse } from 'next/server';
import { searchGames, getIGDBAccessToken, getIGDBCoverUrl } from '@/lib/api/igdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  try {
    const accessToken = await getIGDBAccessToken();
    let games;

    if (query) {
      // Search for games
      games = await searchGames(query, accessToken);
    } else {
      // Get popular games (default search for empty query)
      games = await searchGames('', accessToken);
    }

    const results = games.map(g => ({
      id: g.id,
      title: g.name,
      image: getIGDBCoverUrl(g.cover?.url),
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear().toString() : undefined,
      rating: g.rating,
      description: g.summary,
      genres: g.genres?.map(genre => genre.name).slice(0, 3).join(', '),
      developer: g.involved_companies?.find(company => company.developer)?.company.name,
      platforms: g.platforms?.map(platform => platform.name).slice(0, 3).join(', '),
    }));

    return NextResponse.json({
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Games API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch games' }, { status: 500 });
  }
}