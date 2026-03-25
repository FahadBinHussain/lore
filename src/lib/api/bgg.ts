export interface BGGGame {
  id: string;
  name: {
    type: string;
    value: string;
  };
  yearpublished?: {
    value: string;
  };
  description: string;
  thumbnail?: string;
  image?: string;
  minplayers?: {
    value: string;
  };
  maxplayers?: {
    value: string;
  };
  playingtime?: {
    value: string;
  };
  minplaytime?: {
    value: string;
  };
  maxplaytime?: {
    value: string;
  };
  boardgamecategory?: Array<{
    value: string;
  }>;
  boardgamemechanic?: Array<{
    value: string;
  }>;
  boardgamedesigner?: Array<{
    value: string;
  }>;
  boardgamepublisher?: Array<{
    value: string;
  }>;
}

export interface BGGSearchResponse {
  items: {
    item: BGGGame | BGGGame[];
  };
}

export async function searchBoardGames(query: string): Promise<BGGGame[]> {
  const response = await fetch(
    `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to search board games');
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.getElementsByTagName('item');

  const games: BGGGame[] = [];
  for (let i = 0; i < Math.min(items.length, 20); i++) {
    const item = items[i];
    const game: BGGGame = {
      id: item.getAttribute('id') || '',
      name: {
        type: item.getElementsByTagName('name')[0]?.getAttribute('type') || 'primary',
        value: item.getElementsByTagName('name')[0]?.getAttribute('value') || ''
      },
      yearpublished: item.getElementsByTagName('yearpublished')[0] ? {
        value: item.getElementsByTagName('yearpublished')[0].getAttribute('value') || ''
      } : undefined,
      description: '',
      thumbnail: item.getElementsByTagName('thumbnail')[0]?.textContent || undefined,
      image: item.getElementsByTagName('image')[0]?.textContent || undefined,
    };
    games.push(game);
  }

  return games;
}

export async function getBoardGameDetails(id: string): Promise<BGGGame> {
  const response = await fetch(
    `https://boardgamegeek.com/xmlapi2/thing?id=${id}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error('Failed to get board game details');
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const item = xmlDoc.getElementsByTagName('item')[0];

  const game: BGGGame = {
    id: item.getAttribute('id') || '',
    name: {
      type: item.getElementsByTagName('name')[0]?.getAttribute('type') || 'primary',
      value: item.getElementsByTagName('name')[0]?.getAttribute('value') || ''
    },
    yearpublished: item.getElementsByTagName('yearpublished')[0] ? {
      value: item.getElementsByTagName('yearpublished')[0].getAttribute('value') || ''
    } : undefined,
    description: item.getElementsByTagName('description')[0]?.textContent || '',
    thumbnail: item.getElementsByTagName('thumbnail')[0]?.textContent || undefined,
    image: item.getElementsByTagName('image')[0]?.textContent || undefined,
    minplayers: item.getElementsByTagName('minplayers')[0] ? {
      value: item.getElementsByTagName('minplayers')[0].getAttribute('value') || ''
    } : undefined,
    maxplayers: item.getElementsByTagName('maxplayers')[0] ? {
      value: item.getElementsByTagName('maxplayers')[0].getAttribute('value') || ''
    } : undefined,
    playingtime: item.getElementsByTagName('playingtime')[0] ? {
      value: item.getElementsByTagName('playingtime')[0].getAttribute('value') || ''
    } : undefined,
    minplaytime: item.getElementsByTagName('minplaytime')[0] ? {
      value: item.getElementsByTagName('minplaytime')[0].getAttribute('value') || ''
    } : undefined,
    maxplaytime: item.getElementsByTagName('maxplaytime')[0] ? {
      value: item.getElementsByTagName('maxplaytime')[0].getAttribute('value') || ''
    } : undefined,
    boardgamecategory: Array.from(item.getElementsByTagName('link')).filter(link => link.getAttribute('type') === 'boardgamecategory').map(link => ({
      value: link.getAttribute('value') || ''
    })),
    boardgamemechanic: Array.from(item.getElementsByTagName('link')).filter(link => link.getAttribute('type') === 'boardgamemechanic').map(link => ({
      value: link.getAttribute('value') || ''
    })),
    boardgamedesigner: Array.from(item.getElementsByTagName('link')).filter(link => link.getAttribute('type') === 'boardgamedesigner').map(link => ({
      value: link.getAttribute('value') || ''
    })),
    boardgamepublisher: Array.from(item.getElementsByTagName('link')).filter(link => link.getAttribute('type') === 'boardgamepublisher').map(link => ({
      value: link.getAttribute('value') || ''
    })),
  };

  return game;
}