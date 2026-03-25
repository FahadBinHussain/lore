import { NextRequest, NextResponse } from 'next/server';

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
    // Get IGDB access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.IGDB_CLIENT_ID!,
        client_secret: process.env.IGDB_CLIENT_SECRET!,
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get IGDB access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch game details with comprehensive data - all available fields
    const gameResponse = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body: `where id = ${id}; fields *;`,
    });

    if (!gameResponse.ok) {
      const errorText = await gameResponse.text();
      console.error(`IGDB API error: ${gameResponse.status} - ${errorText}`);
      throw new Error(`Failed to fetch game details: ${gameResponse.status}`);
    }

    const games = await gameResponse.json();
    
    if (!games || games.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = games[0];

    // Debug: Log what we got from IGDB
    console.log('IGDB Raw Game Data Keys:', Object.keys(game).sort());
    console.log('Genres (raw IDs):', game.genres);
    console.log('Platforms (raw IDs):', game.platforms);
    console.log('Cover (raw ID):', game.cover);
    console.log('DLCs (raw IDs):', game.dlcs);
    console.log('Expansions (raw IDs):', game.expansions);
    console.log('Age ratings (raw IDs):', game.age_ratings);

    // Helper function to fetch related data
    const fetchRelatedData = async (endpoint: string, ids: number[], fields: string = 'id,name') => {
      if (!ids || ids.length === 0) return [];

      try {
        const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
          method: 'POST',
          headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID!,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'text/plain',
          },
          body: `where id = (${ids.join(',')}); fields ${fields}; limit 500;`,
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Fetched ${endpoint} for IDs [${ids.join(',')}]:`, data.length, 'items');
          if (endpoint === 'age_ratings' && data.length > 0) {
            console.log('Sample age rating data:', JSON.stringify(data[0], null, 2));
          }
          return data;
        }
        console.error(`Failed to fetch ${endpoint}:`, response.status, await response.text());
        return [];
      } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error);
        return [];
      }
    };

    // Fetch ALL related data in parallel
    const [
      genresData,
      themesData,
      gameModesData,
      playerPerspectivesData,
      platformsData,
      companiesData,
      ageRatingsData,
      artworksData,
      screenshotsData,
      videosData,
      websitesData,
      externalGamesData,
      releaseDatesData,
      similarGamesData,
      keywordsData,
      gameEnginesData,
      bundlesData,
      dlcsData,
      expansionsData,
      collectionsData,
      alternativeNamesData,
      languageSupportsData,
      gameLocalizationsData,
      multiplayerModesData,
      coverData,
    ] = await Promise.all([
      fetchRelatedData('genres', game.genres),
      fetchRelatedData('themes', game.themes),
      fetchRelatedData('game_modes', game.game_modes),
      fetchRelatedData('player_perspectives', game.player_perspectives),
      fetchRelatedData('platforms', game.platforms, 'id,name,platform_logo.url'),
      fetchRelatedData('companies', game.involved_companies?.map((ic: any) => ic.company).filter(Boolean) || [], 'id,name,logo.url'),
      fetchRelatedData('age_ratings', game.age_ratings, 'id,organization,rating_category,rating_content_descriptions'),
      fetchRelatedData('artworks', game.artworks, 'id,url'),
      fetchRelatedData('screenshots', game.screenshots, 'id,url'),
      fetchRelatedData('game_videos', game.videos, 'id,name,video_id'),
      fetchRelatedData('websites', game.websites, 'id,url,category'),
      fetchRelatedData('external_games', game.external_games, 'id,name,url,category'),
      fetchRelatedData('release_dates', game.release_dates, 'id,date,region,platform,category,status'),
      fetchRelatedData('games', game.similar_games, 'id,name,cover.url'),
      fetchRelatedData('keywords', game.keywords, 'id,name'),
      fetchRelatedData('game_engines', game.game_engines, 'id,name,logo.url'),
      fetchRelatedData('games', game.bundles, 'id,name'),
      fetchRelatedData('games', game.dlcs, 'id,name'),
      fetchRelatedData('games', game.expansions, 'id,name'),
      fetchRelatedData('collections', game.collections, 'id,name'),
      fetchRelatedData('alternative_names', game.alternative_names, 'id,name'),
      fetchRelatedData('language_supports', game.language_supports, 'id,language.name,language_support_type.name'),
      fetchRelatedData('game_localizations', game.game_localizations, 'id,name,region'),
      fetchRelatedData('multiplayer_modes', game.multiplayer_modes, 'id,campaigncoop,dropin,lancoop,offlinecoop,offlinecoopmax,offlinemax,onlinecoop,onlinecoopmax,onlinemax,platform,splitscreen,splitscreenonline'),
      game.cover ? fetchRelatedData('covers', [game.cover], 'id,url') : Promise.resolve([]),
    ]);

    // Collect all rating content description IDs
    const allContentDescIds = ageRatingsData.flatMap((ar: any) => ar.rating_content_descriptions || []).filter(Boolean);
    const contentDescriptionsData = allContentDescIds.length > 0 ? await fetchRelatedData('age_rating_content_descriptions', allContentDescIds, 'id,description') : [];
    const genresMap = new Map(genresData.map((g: any) => [g.id, g]));
    const themesMap = new Map(themesData.map((t: any) => [t.id, t]));
    const gameModesMap = new Map(gameModesData.map((gm: any) => [gm.id, gm]));
    const playerPerspectivesMap = new Map(playerPerspectivesData.map((pp: any) => [pp.id, pp]));
    const platformsMap = new Map(platformsData.map((p: any) => [p.id, p]));
    const companiesMap = new Map(companiesData.map((c: any) => [c.id, c]));
    const contentDescriptionsMap = new Map(contentDescriptionsData.map((cd: any) => [cd.id, cd]));
    const ageRatingsMap = new Map(ageRatingsData.map((ar: any) => [ar.id, ar]));
    const artworksMap = new Map(artworksData.map((a: any) => [a.id, a]));
    const screenshotsMap = new Map(screenshotsData.map((s: any) => [s.id, s]));
    const videosMap = new Map(videosData.map((v: any) => [v.id, v]));
    const websitesMap = new Map(websitesData.map((w: any) => [w.id, w]));
    const externalGamesMap = new Map(externalGamesData.map((eg: any) => [eg.id, eg]));
    const releaseDatesMap = new Map(releaseDatesData.map((rd: any) => [rd.id, rd]));
    const similarGamesMap = new Map(similarGamesData.map((sg: any) => [sg.id, sg]));
    const keywordsMap = new Map(keywordsData.map((k: any) => [k.id, k]));
    const gameEnginesMap = new Map(gameEnginesData.map((ge: any) => [ge.id, ge]));
    const bundlesMap = new Map(bundlesData.map((b: any) => [b.id, b]));
    const dlcsMap = new Map(dlcsData.map((d: any) => [d.id, d]));
    const expansionsMap = new Map(expansionsData.map((e: any) => [e.id, e]));
    const collectionsMap = new Map(collectionsData.map((c: any) => [c.id, c]));
    const alternativeNamesMap = new Map(alternativeNamesData.map((an: any) => [an.id, an]));
    const languageSupportsMap = new Map(languageSupportsData.map((ls: any) => [ls.id, ls]));
    const gameLocalizationsMap = new Map(gameLocalizationsData.map((gl: any) => [gl.id, gl]));
    const multiplayerModesMap = new Map(multiplayerModesData.map((mm: any) => [mm.id, mm]));
    const coverMap = new Map((coverData || []).map((c: any) => [c.id, c]));

    // Helper function to get high-quality image URL
    const getHighQualityUrl = (url: string | undefined): string | null => {
      if (!url) return null;
      let fullUrl = url.startsWith('//') ? `https:${url}` : url;
      // Replace thumbnail size with highest quality available
      fullUrl = fullUrl.replace('/t_thumb/', '/t_1080p/');
      fullUrl = fullUrl.replace('/t_cover_small/', '/t_cover_big/');
      fullUrl = fullUrl.replace('/t_logo_med/', '/t_logo_big/');
      return fullUrl;
    };

    // Process all data using the fetched maps
    const coverUrl = (coverData && (coverData as any[]).length > 0) ? getHighQualityUrl((coverData as any[])[0].url) : null;

    const screenshots = (game.screenshots || []).map((id: number) => {
      const screenshot = screenshotsMap.get(id);
      return screenshot ? { url: getHighQualityUrl((screenshot as any).url) } : null;
    }).filter(Boolean).slice(0, 10);

    const artworks = (game.artworks || []).map((id: number) => {
      const artwork = artworksMap.get(id);
      return artwork ? { url: getHighQualityUrl((artwork as any).url) } : null;
    }).filter(Boolean).slice(0, 8);

    const videos = (game.videos || []).map((id: number) => {
      const video = videosMap.get(id);
      return video ? { video_id: (video as any).video_id, name: (video as any).name } : null;
    }).filter(Boolean).slice(0, 5);

    const websites = (game.websites || []).map((id: number) => websitesMap.get(id)).filter(Boolean);

    // Get developers and publishers from involved_companies
    const developers = (game.involved_companies || [])
      .filter((ic: any) => ic.developer)
      .map((ic: any) => {
        const company = companiesMap.get(ic.company);
        return company ? {
          id: (company as any).id,
          name: (company as any).name,
          logo_url: (company as any).logo?.url
            ? ((company as any).logo.url.startsWith('//')
              ? `https:${(company as any).logo.url}`
              : (company as any).logo.url)
            : null,
        } : null;
      }).filter(Boolean);

    const publishers = (game.involved_companies || [])
      .filter((ic: any) => ic.publisher)
      .map((ic: any) => {
        const company = companiesMap.get(ic.company);
        return company ? {
          id: (company as any).id,
          name: (company as any).name,
          logo_url: (company as any).logo?.url
            ? ((company as any).logo.url.startsWith('//')
              ? `https:${(company as any).logo.url}`
              : (company as any).logo.url)
            : null,
        } : null;
      }).filter(Boolean);

    const platforms = (game.platforms || []).map((id: number) => {
      const platform = platformsMap.get(id);
      return platform ? {
        id: (platform as any).id,
        name: (platform as any).name,
        logo_url: (platform as any).platform_logo?.url
          ? ((platform as any).platform_logo.url.startsWith('//')
            ? `https:${(platform as any).platform_logo.url}`
            : (platform as any).platform_logo.url)
          : null,
      } : { id, name: 'Unknown' };
    });

    const similarGames = (game.similar_games || []).map((id: number) => {
      const game = similarGamesMap.get(id);
      return game ? {
        id: (game as any).id,
        name: (game as any).name,
        cover_url: getHighQualityUrl((game as any).cover?.url),
      } : null;
    }).filter(Boolean).slice(0, 8);

    const dlcs = (game.dlcs || []).map((id: number) => {
      const game = dlcsMap.get(id);
      return game ? { id: (game as any).id, name: (game as any).name } : null;
    }).filter(Boolean).slice(0, 6);

    const expansions = (game.expansions || []).map((id: number) => {
      const game = expansionsMap.get(id);
      return game ? { id: (game as any).id, name: (game as any).name } : null;
    }).filter(Boolean).slice(0, 6);

    const ageRatings = (game.age_ratings || []).map((id: number) => {
      const rating = ageRatingsMap.get(id);
      if (!rating) return null;
      
      // Get content descriptions
      const contentDescriptions = ((rating as any).rating_content_descriptions || [])
        .map((cdId: number) => (contentDescriptionsMap.get(cdId) as any)?.description)
        .filter(Boolean);
      
      // Map organization to category name
      const organization = (rating as any).organization;
      const category = organization === 1 ? 'ESRB' : organization === 2 ? 'PEGI' : `Org ${organization}`;
      
      return {
        rating: (rating as any).rating_category,
        category,
        content_descriptions: contentDescriptions,
      };
    }).filter(Boolean);

    const releaseDates = (game.release_dates || []).map((id: number) => releaseDatesMap.get(id)).filter(Boolean).slice(0, 10);

    const externalGames = (game.external_games || []).map((id: number) => externalGamesMap.get(id)).filter(Boolean);

    const gameEngines = (game.game_engines || []).map((id: number) => {
      const engine = gameEnginesMap.get(id);
      return engine ? {
        id: (engine as any).id,
        name: (engine as any).name,
        logo_url: (engine as any).logo?.url
          ? ((engine as any).logo.url.startsWith('//')
            ? `https:${(engine as any).logo.url}`
            : (engine as any).logo.url)
          : null,
      } : null;
    }).filter(Boolean);

    const bundles = (game.bundles || []).map((id: number) => bundlesMap.get(id)).filter(Boolean).slice(0, 6);
    const collections = (game.collections || []).map((id: number) => collectionsMap.get(id)).filter(Boolean).slice(0, 6);

    const alternativeNames = (game.alternative_names || []).map((id: number) => alternativeNamesMap.get(id)).filter(Boolean);

    const languageSupports = (game.language_supports || []).map((id: number) => languageSupportsMap.get(id)).filter(Boolean).slice(0, 10);

    const gameLocalizations = (game.game_localizations || []).map((id: number) => gameLocalizationsMap.get(id)).filter(Boolean).slice(0, 10);

    const multiplayerModes = (game.multiplayer_modes || []).map((id: number) => multiplayerModesMap.get(id)).filter(Boolean);

    const keywords = (game.keywords || []).map((id: number) => keywordsMap.get(id)).filter(Boolean);

    const result = {
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
      genres: (game.genres || []).map((id: number) => genresMap.get(id) || { id, name: 'Unknown' }),
      themes: (game.themes || []).map((id: number) => themesMap.get(id) || { id, name: 'Unknown' }),
      game_modes: (game.game_modes || []).map((id: number) => gameModesMap.get(id) || { id, name: 'Unknown' }),
      player_perspectives: (game.player_perspectives || []).map((id: number) => playerPerspectivesMap.get(id) || { id, name: 'Unknown' }),
      platforms,
      developers,
      publishers,
      game_engines: gameEngines,
      screenshots,
      artworks,
      videos,
      websites,
      similar_games: similarGames,
      dlcs,
      expansions,
      bundles: (game.bundles || []).map((id: number) => bundlesMap.get(id)).filter(Boolean).slice(0, 6),
      collections: (game.collections || []).map((id: number) => collectionsMap.get(id)).filter(Boolean).slice(0, 6),
      age_ratings: ageRatings,
      release_dates: releaseDates,
      external_games: externalGames,
      keywords,
      tags: game.tags || [],
      multiplayer_modes: multiplayerModes,
      language_supports: languageSupports,
      game_localizations: gameLocalizations,
      alternative_names: alternativeNames,
    };

    // Debug: Log what we're returning
    console.log('API Result:');
    console.log('Genres count:', result.genres.length);
    console.log('Platforms count:', result.platforms.length);
    console.log('Age ratings count:', result.age_ratings.length);
    console.log('DLCs count:', result.dlcs.length);
    console.log('Expansions count:', result.expansions.length);
    console.log('Summary length:', result.summary.length);
    console.log('Screenshots count:', result.screenshots.length);
    console.log('Cover URL:', result.cover_url ? 'Present' : 'Missing');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Game detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch game details' }, { status: 500 });
  }
}