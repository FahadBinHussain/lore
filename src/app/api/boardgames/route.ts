import { NextRequest, NextResponse } from 'next/server';
import { searchBoardGames, getHotBoardGames, BGGGame } from '@/lib/api/bgg';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  // Get API key from environment variable only
  const apiKey = process.env.BGG_API_KEY;

  try {
    let games: BGGGame[] = [];

    if (query && query.trim()) {
      games = await searchBoardGames(query, apiKey);
    } else {
      // Fetch hot/popular board games when no query is provided
      games = await getHotBoardGames(apiKey);
    }

    const results = games.map((g: BGGGame) => ({
      id: g.id,
      title: g.name,
      image: g.image_url || g.thumb_url,
      year: g.year_published?.toString(),
      players: g.min_players && g.max_players ? `${g.min_players}-${g.max_players}` : undefined,
      playtime: g.min_playtime && g.max_playtime ? `${g.min_playtime}-${g.max_playtime} min` : g.min_playtime ? `${g.min_playtime} min` : undefined,
      categories: g.categories?.slice(0, 3).join(', '),
      mechanics: g.mechanics?.slice(0, 3).join(', '),
      designers: g.designers?.slice(0, 3).join(', '),
      publishers: g.publishers?.slice(0, 3).join(', '),
      description: g.description,
    }));

    return NextResponse.json({
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Board Games API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch board games' }, { status: 500 });
  }
}