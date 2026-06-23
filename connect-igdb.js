const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

// IGDB search function
async function searchIGDB(query) {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  
  // Get access token
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  
  // Search games
  const body = `search "${query}"; fields id, name, summary, first_release_date, rating, involved_companies.company.name, involved_companies.developer, platforms.name; limit 10;`;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return res.json();
}

// Games to search on IGDB
const gamesToSearch = [
  { title: "Bubble Witch Saga", searchQuery: "Bubble Witch Saga" },
  { title: "Candy Crush Saga", searchQuery: "Candy Crush Saga" },
  { title: "Candy Crush Saga (Facebook)", searchQuery: "Candy Crush Saga" },
  { title: "Candy Crush Saga (Windows Phone)", searchQuery: "Candy Crush Saga" },
  { title: "Farm Heroes Saga", searchQuery: "Farm Heroes Saga" },
  { title: "Candy Crush Soda Saga", searchQuery: "Candy Crush Soda Saga" },
  { title: "Candy Crush Saga (Windows 10)", searchQuery: "Candy Crush Saga" },
  { title: "Candy Crush Jelly Saga", searchQuery: "Candy Crush Jelly Saga" },
  { title: "Candy Crush Hot Air Saga", searchQuery: "Candy Crush Hot Air Saga" },
  { title: "Candy Crush Friends Saga", searchQuery: "Candy Crush Friends Saga" },
  { title: "Candy Crush All Stars", searchQuery: "Candy Crush All Stars" },
  { title: "Candy Crush Blast", searchQuery: "Candy Crush Blast" },
  { title: "Candy Crush 3D", searchQuery: "Candy Crush 3D" },
  { title: "Candy Crush Solitaire", searchQuery: "Candy Crush Solitaire" },
  { title: "Candy Crush", searchQuery: "Candy Crush" },
  { title: "Candy Crush Crushable", searchQuery: "Candy Crush Crushable" },
];

(async () => {
  console.log("=== SEARCHING IGDB FOR CANDY CRUSH GAMES ===\n");
  
  const igdbResults = {};
  
  for (const game of gamesToSearch) {
    try {
      const results = await searchIGDB(game.searchQuery);
      if (results && results.length > 0) {
        const best = results[0];
        igdbResults[game.title] = {
          igdbId: best.id,
          name: best.name,
          summary: best.summary?.substring(0, 100),
          releaseDate: best.first_release_date,
        };
        console.log(`  ✓ ${game.title} → IGDB #${best.id} (${best.name})`);
      } else {
        console.log(`  ✗ ${game.title} → Not found on IGDB`);
      }
    } catch (err) {
      console.log(`  ✗ ${game.title} → Error: ${err.message}`);
    }
  }
  
  // Update database
  console.log("\n=== UPDATING DATABASE ===\n");
  
  const items = await sql.query(`
    SELECT ci.id, ci.release_order, mi.id as media_id, mi.title, mi.external_id, mi.source
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  
  for (const item of items) {
    const igdb = igdbResults[item.title];
    if (igdb) {
      const newExternalId = `igdb-${igdb.igdbId}`;
      if (item.external_id !== newExternalId || item.source !== 'igdb') {
        await sql.query(`
          UPDATE media_items SET external_id = $1, source = 'igdb' WHERE id = $2
        `, [newExternalId, item.media_id]);
        console.log(`  Updated: ${item.title} → ${newExternalId}`);
      }
    }
  }
  
  // Verify
  console.log("\n=== FINAL STATE ===");
  const final = await sql.query(`
    SELECT ci.release_order, mi.title, mi.external_id, mi.source
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  for (const item of final) {
    console.log(`  ${item.release_order}. ${item.title} [${item.source}: ${item.external_id}]`);
  }
})();
