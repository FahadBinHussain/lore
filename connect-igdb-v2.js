const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

// IGDB search function
async function searchIGDB(query) {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  
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

(async () => {
  console.log("=== CONNECTING CANDY CRUSH GAMES TO IGDB ===\n");
  
  // Get all items
  const items = await sql.query(`
    SELECT ci.id, ci.release_order, mi.id as media_id, mi.title, mi.external_id, mi.source
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  
  // Search IGDB for each unique game title (not platform variants)
  const uniqueTitles = new Set();
  const igdbMap = {};
  
  for (const item of items) {
    // Skip platform variants - they share the base game's IGDB ID
    const baseTitle = item.title
      .replace(/ \(Facebook\)/, '')
      .replace(/ \(Windows Phone\)/, '')
      .replace(/ \(Windows 10\)/, '');
    
    if (uniqueTitles.has(baseTitle)) continue;
    uniqueTitles.add(baseTitle);
    
    try {
      const results = await searchIGDB(baseTitle);
      if (results && results.length > 0) {
        const best = results[0];
        igdbMap[baseTitle] = best.id;
        console.log(`  ✓ ${baseTitle} → IGDB #${best.id}`);
      } else {
        console.log(`  ✗ ${baseTitle} → Not found`);
      }
    } catch (err) {
      console.log(`  ✗ ${baseTitle} → Error: ${err.message}`);
    }
  }
  
  // Update database
  console.log("\n=== UPDATING DATABASE ===\n");
  
  // First, check which IGDB IDs are already used
  const usedIgdbIds = new Set();
  
  for (const item of items) {
    const baseTitle = item.title
      .replace(/ \(Facebook\)/, '')
      .replace(/ \(Windows Phone\)/, '')
      .replace(/ \(Windows 10\)/, '');
    
    const igdbId = igdbMap[baseTitle];
    if (!igdbId) continue;
    
    const newExternalId = `igdb-${igdbId}`;
    
    // Check if this IGDB ID is already used by another item
    if (usedIgdbIds.has(igdbId)) {
      // This is a platform variant - keep as manual
      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const curatedId = `curated-game-2012-${slug}`;
      if (item.external_id !== curatedId || item.source !== 'manual') {
        await sql.query(`UPDATE media_items SET source = 'manual', external_id = $1 WHERE id = $2`, [curatedId, item.media_id]);
        console.log(`  Kept manual: ${item.title}`);
      }
    } else {
      // First occurrence - use IGDB
      usedIgdbIds.add(igdbId);
      if (item.external_id !== newExternalId || item.source !== 'igdb') {
        await sql.query(`UPDATE media_items SET source = 'igdb', external_id = $1 WHERE id = $2`, [newExternalId, item.media_id]);
        console.log(`  Updated: ${item.title} → ${newExternalId}`);
      }
    }
  }
  
  // Final verification
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
