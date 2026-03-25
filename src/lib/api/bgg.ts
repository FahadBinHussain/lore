import { XMLParser } from 'fast-xml-parser';

export interface BGGGame {
  id: string;
  name: string;
  year_published?: number;
  description?: string;
  image_url?: string;
  thumb_url?: string;
  min_players?: number;
  max_players?: number;
  min_playtime?: number;
  max_playtime?: number;
  categories?: string[];
  mechanics?: string[];
  designers?: string[];
  publishers?: string[];
  price?: string;
  msrp?: number;
  url?: string;
}

export interface BGGSearchResponse {
  games: BGGGame[];
  count: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export async function searchBoardGames(query: string, apiKey?: string): Promise<BGGGame[]> {
  const headers: Record<string, string> = {};

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(
    `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`,
    {
      headers,
      next: { revalidate: 3600 }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('BoardGameGeek API requires authentication. Please provide a valid API key.');
    }
    throw new Error('Failed to search board games');
  }

  const xmlText = await response.text();
  const games = parseBGGSearchXML(xmlText);
  return games;
}

export async function getBoardGameDetails(id: string, apiKey?: string): Promise<BGGGame> {
  const headers: Record<string, string> = {};

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(
    `https://boardgamegeek.com/xmlapi2/thing?id=${id}&stats=1`,
    {
      headers,
      next: { revalidate: 3600 }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('BoardGameGeek API requires authentication. Please provide a valid API key.');
    }
    throw new Error('Failed to get board game details');
  }

  const xmlText = await response.text();
  const game = parseBGGThingXML(xmlText);
  if (!game) {
    throw new Error('Board game not found');
  }

  return game;
}

export async function getHotBoardGames(apiKey?: string): Promise<BGGGame[]> {
  const headers: Record<string, string> = {};

  // Add authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(
    `https://boardgamegeek.com/xmlapi2/hot?type=boardgame`,
    {
      headers,
      next: { revalidate: 3600 }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('BoardGameGeek API requires authentication. Please provide a valid API key.');
    }
    throw new Error('Failed to get hot board games');
  }

  const xmlText = await response.text();
  const games = parseBGHotXML(xmlText);
  return games;
}

function parseBGGSearchXML(xmlText: string): BGGGame[] {
  const result = xmlParser.parse(xmlText);
  const items = result.items?.item || [];

  // Handle single item case
  const itemArray = Array.isArray(items) ? items : [items];

  const games: BGGGame[] = [];
  for (const item of itemArray) {
    const id = item['@_id'];
    const nameElement = item.name;
    const name = nameElement?.['@_value'] || '';

    if (id && name) {
      games.push({
        id: id.toString(),
        name,
        url: `https://boardgamegeek.com/boardgame/${id}`,
      });
    }
  }

  return games;
}

function parseBGGThingXML(xmlText: string): BGGGame | null {
  const result = xmlParser.parse(xmlText);
  const item = result.items?.item;

  if (!item) return null;

  const id = item['@_id'];
  const nameElement = item.name;
  const name = nameElement?.['@_value'] || '';

  // Get description
  const description = item.description || '';

  // Get year published
  const year_published = item.yearpublished ? parseInt(item.yearpublished['@_value'] || '0') : undefined;

  // Get player count
  const min_players = item.minplayers ? parseInt(item.minplayers['@_value'] || '0') : undefined;
  const max_players = item.maxplayers ? parseInt(item.maxplayers['@_value'] || '0') : undefined;

  // Get playtime
  const min_playtime = item.minplaytime ? parseInt(item.minplaytime['@_value'] || '0') : undefined;
  const max_playtime = item.maxplaytime ? parseInt(item.maxplaytime['@_value'] || '0') : undefined;

  // Get image
  const image_url = item.image || undefined;

  // Get thumbnail
  const thumb_url = item.thumbnail || undefined;

  // Get categories, mechanics, designers, publishers
  const categories: string[] = [];
  const mechanics: string[] = [];
  const designers: string[] = [];
  const publishers: string[] = [];

  const links = item.link || [];
  const linkArray = Array.isArray(links) ? links : [links];

  for (const link of linkArray) {
    const type = link['@_type'];
    const value = link['@_value'];

    if (value) {
      switch (type) {
        case 'boardgamecategory':
          categories.push(value);
          break;
        case 'boardgamemechanic':
          mechanics.push(value);
          break;
        case 'boardgamedesigner':
          designers.push(value);
          break;
        case 'boardgamepublisher':
          publishers.push(value);
          break;
      }
    }
  }

  return {
    id: id?.toString() || '',
    name,
    year_published,
    description,
    image_url,
    thumb_url,
    min_players,
    max_players,
    min_playtime,
    max_playtime,
    categories,
    mechanics,
    designers,
    publishers,
    url: `https://boardgamegeek.com/boardgame/${id}`,
  };
}

function parseBGHotXML(xmlText: string): BGGGame[] {
  const result = xmlParser.parse(xmlText);
  const items = result.items?.item || [];

  // Handle single item case
  const itemArray = Array.isArray(items) ? items : [items];

  const games: BGGGame[] = [];

  for (const item of itemArray) {
    const id = item['@_id'];
    const name = item.name?.['@_value'] || '';
    const year_published = item.yearpublished ? parseInt(item.yearpublished['@_value'] || '0') : undefined;
    const thumbnail = item.thumbnail?.['@_value'] || undefined;

    if (id && name) {
      games.push({
        id: id.toString(),
        name,
        year_published,
        thumb_url: thumbnail,
        url: `https://boardgamegeek.com/boardgame/${id}`,
      });
    }
  }

  return games;
}