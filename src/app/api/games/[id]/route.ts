import { NextRequest, NextResponse } from 'next/server';

interface IgdbItem {
  id: number;
  name?: string;
  url?: string;
  logo?: { url: string };
}

interface InvolvedCompany {
  company: number;
  developer: boolean;
  publisher: boolean;
}

interface IgdbGameDetail extends IgdbItem {
  slug?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  hypes?: number;
  follows?: number;
  created_at?: number;
  updated_at?: number;
  checksum?: string;
  game_type?: number;
  tags?: number[];
  involved_companies?: InvolvedCompany[];
  genres?: number[];
  themes?: number[];
  game_modes?: number[];
  player_perspectives?: number[];
  platforms?: number[];
  screenshots?: number[];
  artworks?: number[];
  videos?: number[];
  websites?: number[];
  keywords?: number[];
  game_engines?: number[];
  similar_games?: number[];
  dlcs?: number[];
  expansions?: number[];
  bundles?: number[];
  collections?: number[];
  alternative_names?: number[];
  release_dates?: number[];
  external_games?: number[];
  age_ratings?: number[];
  language_supports?: number[];
  game_localizations?: number[];
  multiplayer_modes?: number[];
  cover?: number;
}

interface PlatformItem extends IgdbItem {
  platform_logo?: { url: string };
}

interface AgeRatingItem extends IgdbItem {
  organization: number;
  rating_category: number;
  rating_content_descriptions?: Array<{ description: string }>;
}

interface VideoItem extends IgdbItem {
  video_id: string;
}

interface SimilarGameItem extends IgdbItem {
  cover?: { url: string };
}

interface ImageItem extends IgdbItem {
  url: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.IGDB_CLIENT_ID!,
      client_secret: process.env.IGDB_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) throw new Error('Failed to get IGDB access token');

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken();

    // Single IGDB query with all fields
    const gameResponse = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body: `where id = ${id}; fields *; limit 1;`,
    });

    if (!gameResponse.ok) {
      throw new Error(`IGDB error: ${gameResponse.status}`);
    }

    const games = (await gameResponse.json()) as IgdbGameDetail[];
    if (!games || games.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = games[0];

    // Batch fetch related data by type
    const batchFetch = async (endpoint: string, ids: number[] | undefined, fields = 'id,name') => {
      if (!ids?.length) return [];
      const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': process.env.IGDB_CLIENT_ID!,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'text/plain',
        },
        body: `where id = (${ids.join(',')}); fields ${fields}; limit 500;`,
      });
      return res.ok ? res.json() : [];
    };

    // Fetch only the related data that has IDs
    const [
      genres, themes, gameModes, playerPerspectives, platforms, companies, screenshots, artworks,
      videos, websites, keywords, gameEngines, similarGames, dlcs, expansions, bundles, collections,
      alternativeNames, releaseDates, externalGames, ageRatings, languageSupports, gameLocalizations,
      multiplayerModes, cover,
    ] = (await Promise.all([
      batchFetch('genres', game.genres),
      batchFetch('themes', game.themes),
      batchFetch('game_modes', game.game_modes),
      batchFetch('player_perspectives', game.player_perspectives),
      batchFetch('platforms', game.platforms, 'id,name,platform_logo.url'),
      batchFetch('companies', game.involved_companies?.map((ic) => ic.company).filter(Boolean) || [], 'id,name,logo.url'),
      batchFetch('screenshots', game.screenshots, 'id,url'),
      batchFetch('artworks', game.artworks, 'id,url'),
      batchFetch('game_videos', game.videos, 'id,name,video_id'),
      batchFetch('websites', game.websites, 'id,url,category'),
      batchFetch('keywords', game.keywords, 'id,name'),
      batchFetch('game_engines', game.game_engines, 'id,name,logo.url'),
      batchFetch('games', game.similar_games, 'id,name,cover.url'),
      batchFetch('games', game.dlcs, 'id,name'),
      batchFetch('games', game.expansions, 'id,name'),
      batchFetch('games', game.bundles, 'id,name'),
      batchFetch('collections', game.collections, 'id,name'),
      batchFetch('alternative_names', game.alternative_names, 'id,name'),
      batchFetch('release_dates', game.release_dates, 'id,date,region,platform,category,status'),
      batchFetch('external_games', game.external_games, 'id,name,url,category'),
      batchFetch('age_ratings', game.age_ratings, 'id,organization,rating_category,rating_content_descriptions.description'),
      batchFetch('language_supports', game.language_supports, 'id,language.name,language_support_type.name'),
      batchFetch('game_localizations', game.game_localizations, 'id,name,region'),
      batchFetch('multiplayer_modes', game.multiplayer_modes, 'id,campaigncoop,lancoop,offlinecoop,onlinecoop,splitscreen'),
      game.cover ? batchFetch('covers', [game.cover], 'id,url') : Promise.resolve([]),
    ])) as [
      IgdbItem[], IgdbItem[], IgdbItem[], IgdbItem[], PlatformItem[], IgdbItem[], ImageItem[], ImageItem[],
      VideoItem[], IgdbItem[], IgdbItem[], IgdbItem[], SimilarGameItem[], IgdbItem[], IgdbItem[], IgdbItem[],
      IgdbItem[], IgdbItem[], IgdbItem[], IgdbItem[], AgeRatingItem[], IgdbItem[], IgdbItem[],
      IgdbItem[], ImageItem[],
    ];

    // Build lookup maps
    const companiesMap = new Map<number, IgdbItem>(companies.map((item) => [item.id, item]));

    // Process cover
    const coverUrl = cover?.[0]?.url
      ? `https:${cover[0].url}`.replace('/t_thumb/', '/t_1080p/')
      : null;

    // Process developers/publishers
    const developers = (game.involved_companies || [])
      .filter((ic) => ic.developer)
      .map((ic) => {
        const c = companiesMap.get(ic.company);
        return c && c.logo ? { id: c.id, name: c.name ?? '', logo_url: `https:${c.logo.url}` } : null;
      }).filter(Boolean);

    const publishers = (game.involved_companies || [])
      .filter((ic) => ic.publisher)
      .map((ic) => {
        const c = companiesMap.get(ic.company);
        return c && c.logo ? { id: c.id, name: c.name ?? '', logo_url: `https:${c.logo.url}` } : null;
      }).filter(Boolean);

    // Process platforms
    const processedPlatforms = platforms.map((p) => ({
      id: p.id,
      name: p.name ?? '',
      logo_url: p.platform_logo?.url ? `https:${p.platform_logo.url}` : null,
    }));

    // Process screenshots/artworks
    const processImages = (items: ImageItem[], field: 'url' = 'url') =>
      items.map((i) => ({ url: i[field]?.startsWith('//') ? `https:${i[field]}` : i[field] })).filter((i) => i.url);

    // Process age ratings
    const ageRatingData = ageRatings.map((ar) => ({
      rating: ar.rating_category,
      category: ar.organization === 1 ? 'ESRB' : ar.organization === 2 ? 'PEGI' : `Org ${ar.organization}`,
      content_descriptions: (ar.rating_content_descriptions || []).map((cd) => cd.description).filter(Boolean),
    }));

    return NextResponse.json({
      id: game.id,
      name: game.name,
      slug: game.slug,
      url: game.url,
      summary: game.summary || '',
      storyline: game.storyline || '',
      cover_url: coverUrl,
      first_release_date: game.first_release_date,
      rating: game.rating,
      rating_count: game.rating_count,
      aggregated_rating: game.aggregated_rating,
      aggregated_rating_count: game.aggregated_rating_count,
      total_rating: game.total_rating,
      total_rating_count: game.total_rating_count,
      hypes: game.hypes || 0,
      follows: game.follows || 0,
      created_at: game.created_at,
      updated_at: game.updated_at,
      checksum: game.checksum,
      game_type: game.game_type,
      genres,
      themes,
      game_modes: gameModes,
      player_perspectives: playerPerspectives,
      platforms: processedPlatforms,
      developers,
      publishers,
      game_engines: gameEngines.map((e) => ({ id: e.id, name: e.name ?? '', logo_url: e.logo?.url ? `https:${e.logo.url}` : null })),
      screenshots: processImages(screenshots).slice(0, 10),
      artworks: processImages(artworks).slice(0, 8),
      videos: videos.slice(0, 5).map((v) => ({ video_id: v.video_id, name: v.name ?? '' })),
      websites,
      similar_games: similarGames.slice(0, 8).map((sg) => ({
        id: sg.id, name: sg.name ?? '',
        cover_url: sg.cover?.url ? `https:${sg.cover.url}` : null,
      })),
      dlcs: dlcs.slice(0, 6),
      expansions: expansions.slice(0, 6),
      bundles: bundles.slice(0, 6),
      collections: collections.slice(0, 6),
      age_ratings: ageRatingData,
      release_dates: releaseDates.slice(0, 10),
      external_games: externalGames,
      keywords,
      tags: game.tags || [],
      multiplayer_modes: multiplayerModes,
      language_supports: languageSupports.slice(0, 10),
      game_localizations: gameLocalizations.slice(0, 10),
      alternative_names: alternativeNames,
    });
  } catch (error) {
    console.error('Game detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch game details' }, { status: 500 });
  }
}
