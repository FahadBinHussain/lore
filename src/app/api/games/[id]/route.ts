import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for IGDB access tokens
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

  if (!response.ok) {
    throw new Error('Failed to get IGDB access token');
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

async function igdbQuery(endpoint: string, query: string, accessToken: string): Promise<any[]> {
  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID!,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    body: query,
  });

  if (!response.ok) {
    console.error(`IGDB ${endpoint} error: ${response.status}`);
    return [];
  }

  return response.json();
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

    // Fetch game with ALL needed fields in ONE call
    const games = await igdbQuery('games',
      `where id = ${id}; fields 
        id,name,slug,url,summary,storyline,cover.url,
        first_release_date,rating,rating_count,
        aggregated_rating,aggregated_rating_count,
        total_rating,total_rating_count,
        hypes,follows,created_at,updated_at,checksum,game_type,
        genres.name,themes.name,game_modes.name,player_perspectives.name,
        platforms.name,platform_logo.url,
        involved_companies.company.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.logo.url,
        screenshots.url,artworks.url,
        game_videos.name,game_videos.video_id,
        websites.url,websites.category,
        similar_games.id,similar_games.name,similar_games.cover.url,similar_games.first_release_date,
        dlcs.id,dlcs.name,
        expansions.id,expansions.name,
        bundles.id,bundles.name,
        collections.id,collections.name,
        keywords.name,
        alternative_names.name,
        game_engines.name,game_engines.logo.url,
        age_ratings.organization,age_ratings.rating_category,age_ratings.rating_content_descriptions.description,
        release_dates.date,release_dates.region,release_dates.platform.name,release_dates.category,release_dates.status,
        external_games.name,external_games.url,external_games.category,
        language_supports.language.name,language_supports.language_support_type.name,
        game_localizations.name,game_localizations.region,
        multiplayer_modes.campaigncoop,multiplayer_modes.lancoop,multiplayer_modes.offlinecoop,
        multiplayer_modes.onlinecoop,multiplayer_modes.splitscreen;
        limit 1;`,
      accessToken
    );

    if (!games || games.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = games[0];

    // Helper to get high-quality image URL
    const hq = (url?: string): string | null => {
      if (!url) return null;
      let full = url.startsWith('//') ? `https:${url}` : url;
      return full.replace('/t_thumb/', '/t_1080p/')
                 .replace('/t_cover_small/', '/t_cover_big/')
                 .replace('/t_logo_med/', '/t_logo_big/');
    };

    // Process inline data (no separate API calls needed)
    const developers = (game.involved_companies || [])
      .filter((ic: any) => ic.developer && ic.company)
      .map((ic: any) => ({
        id: ic.company.id,
        name: ic.company.name,
        logo_url: hq(ic.company.logo?.url),
      }));

    const publishers = (game.involved_companies || [])
      .filter((ic: any) => ic.publisher && ic.company)
      .map((ic: any) => ({
        id: ic.company.id,
        name: ic.company.name,
        logo_url: hq(ic.company.logo?.url),
      }));

    const platforms = (game.platforms || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      logo_url: hq(p.platform_logo?.url),
    }));

    const screenshots = (game.screenshots || [])
      .map((s: any) => ({ url: hq(s.url) }))
      .filter((s: any) => s.url)
      .slice(0, 10);

    const artworks = (game.artworks || [])
      .map((a: any) => ({ url: hq(a.url) }))
      .filter((a: any) => a.url)
      .slice(0, 8);

    const videos = (game.game_videos || [])
      .map((v: any) => ({ video_id: v.video_id, name: v.name }))
      .slice(0, 5);

    const ageRatings = (game.age_ratings || []).map((ar: any) => ({
      rating: ar.rating_category,
      category: ar.organization === 1 ? 'ESRB' : ar.organization === 2 ? 'PEGI' : `Org ${ar.organization}`,
      content_descriptions: (ar.rating_content_descriptions || []).map((cd: any) => cd.description).filter(Boolean),
    }));

    const result = {
      id: game.id,
      name: game.name,
      slug: game.slug,
      url: game.url,
      summary: game.summary || '',
      storyline: game.storyline || '',
      cover_url: hq(game.cover?.url),
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
      genres: game.genres || [],
      themes: game.themes || [],
      game_modes: game.game_modes || [],
      player_perspectives: game.player_perspectives || [],
      platforms,
      developers,
      publishers,
      game_engines: (game.game_engines || []).map((e: any) => ({
        id: e.id, name: e.name, logo_url: hq(e.logo?.url),
      })),
      screenshots,
      artworks,
      videos,
      websites: game.websites || [],
      similar_games: (game.similar_games || []).map((sg: any) => ({
        id: sg.id, name: sg.name, cover_url: hq(sg.cover?.url), first_release_date: sg.first_release_date,
      })).slice(0, 8),
      dlcs: (game.dlcs || []).slice(0, 6),
      expansions: (game.expansions || []).slice(0, 6),
      bundles: (game.bundles || []).slice(0, 6),
      collections: (game.collections || []).slice(0, 6),
      age_ratings: ageRatings,
      release_dates: (game.release_dates || []).slice(0, 10),
      external_games: game.external_games || [],
      keywords: game.keywords || [],
      tags: game.tags || [],
      multiplayer_modes: game.multiplayer_modes || [],
      language_supports: (game.language_supports || []).slice(0, 10),
      game_localizations: (game.game_localizations || []).slice(0, 10),
      alternative_names: game.alternative_names || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Game detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch game details' }, { status: 500 });
  }
}
