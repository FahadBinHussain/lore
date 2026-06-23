const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

let cachedToken = null;

async function getAccessToken() {
  if (cachedToken) return cachedToken;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.IGDB_CLIENT_ID,
      client_secret: process.env.IGDB_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  cachedToken = data.access_token;
  return cachedToken;
}

(async () => {
  const token = await getAccessToken();

  const items = await sql.query(`
    SELECT mi.id, mi.title, mi.external_id, mi.source
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44 AND mi.source = 'igdb'
    ORDER BY ci.release_order
  `);

  for (const item of items) {
    const igdbId = item.external_id?.replace('igdb-', '');
    if (!igdbId) continue;

    const res = await fetch('https://api.igdb.com/v4/covers', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `where game = ${igdbId}; fields url; limit 1;`,
    });

    if (!res.ok) {
      console.log(`  ${item.title}: cover fetch failed`);
      continue;
    }

    const covers = await res.json();
    if (covers.length === 0) {
      console.log(`  ${item.title}: no cover found`);
      continue;
    }

    const coverUrl = `https:${covers[0].url}`.replace('/t_thumb/', '/t_cover_big/');
    await sql.query(`UPDATE media_items SET poster_path = $1 WHERE id = $2`, [coverUrl, item.id]);
    console.log(`  ${item.title}: updated poster`);
  }

  // Verify
  const verify = await sql.query(`
    SELECT mi.title, mi.poster_path IS NOT NULL as has_cover
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  console.log('\nVerification:');
  for (const v of verify) {
    console.log(`  ${v.title}: ${v.has_cover ? 'has cover' : 'no cover'}`);
  }
})();
