import { NextRequest, NextResponse } from 'next/server';
import { searchBoardGames, BGGGame } from '@/lib/api/bgg';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  try {
    let games: BGGGame[];

    if (query) {
      games = await searchBoardGames(query);
    } else {
      // For now, return empty array when no query
      games = [];
    }

    const results = games.map((g: BGGGame) => ({
      id: g.id,
      title: typeof g.name === 'string' ? g.name : g.name.value,
      image: g.thumbnail || g.image,
      year: g.yearpublished?.value,
      players: g.minplayers && g.maxplayers ? `${g.minplayers.value}-${g.maxplayers.value}` : undefined,
      playtime: g.playingtime?.value ? `${g.playingtime.value} min` : undefined,
      categories: g.boardgamecategory?.slice(0, 3).map((c: any) => c.value).join(', '),
      mechanics: g.boardgamemechanic?.slice(0, 3).map((m: any) => m.value).join(', '),
      designers: g.boardgamedesigner?.slice(0, 3).map((d: any) => d.value).join(', '),
      publishers: g.boardgamepublisher?.slice(0, 3).map((p: any) => p.value).join(', '),
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