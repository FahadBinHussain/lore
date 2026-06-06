import { NextResponse } from 'next/server';
import { getBoardGameDetails } from '@/lib/api/bgg';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const game = await getBoardGameDetails(id, process.env.BGG_API_KEY);

    return NextResponse.json({
      id: game.id,
      title: game.name,
      mediaType: 'boardgame',
      source: 'bgg',
      image: game.image_url || game.thumb_url || null,
      description: game.description || null,
      releaseDate: game.year_published ? `${game.year_published}-01-01` : null,
      subtitle: game.designers?.slice(0, 3).join(', ') || null,
      externalUrl: game.url || getProviderSourceUrl('bgg', 'boardgame', game.id),
      chips: [...(game.categories || []), ...(game.mechanics || [])].slice(0, 8),
      fields: [
        { label: 'Players', value: game.min_players && game.max_players ? `${game.min_players}-${game.max_players}` : null },
        { label: 'Playtime', value: game.min_playtime && game.max_playtime ? `${game.min_playtime}-${game.max_playtime} min` : game.min_playtime ? `${game.min_playtime} min` : null },
        { label: 'Designers', value: game.designers?.slice(0, 6).join(', ') },
        { label: 'Publishers', value: game.publishers?.slice(0, 6).join(', ') },
      ],
    });
  } catch (error) {
    console.error('Board game detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch board game details' }, { status: 500 });
  }
}
