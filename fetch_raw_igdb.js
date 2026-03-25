const fs = require('fs');

async function fetchRawIGDB() {
  try {
    // Get IGDB access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: 'o71fon40jlufdz3pogi728hgdls5b5',
        client_secret: 'xp8t8lzbhjqqd4l9oj5i2jfh8ib1rn',
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get IGDB access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch game details with ALL fields
    const gameResponse = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': 'o71fon40jlufdz3pogi728hgdls5b5',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body: `where id = 1910; fields *;`,
    });

    if (!gameResponse.ok) {
      const errorText = await gameResponse.text();
      console.error(`IGDB API error: ${gameResponse.status} - ${errorText}`);
      throw new Error(`Failed to fetch game details: ${gameResponse.status}`);
    }

    const games = await gameResponse.json();

    if (!games || games.length === 0) {
      throw new Error('Game not found');
    }

    const game = games[0];

    // Save to file
    fs.writeFileSync('raw_igdb_response.json', JSON.stringify(game, null, 2));
    console.log('Raw IGDB response saved to raw_igdb_response.json');
    console.log('Game keys:', Object.keys(game).sort());

  } catch (error) {
    console.error('Error:', error);
  }
}

fetchRawIGDB();