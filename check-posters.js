const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const items = await sql.query(`
    SELECT mi.id, mi.title, mi.source, mi.external_id, mi.poster_path, mi.backdrop_path
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  for (const item of items) {
    console.log(`${item.title}: poster=${item.poster_path || 'NULL'}, backdrop=${item.backdrop_path || 'NULL'}`);
  }
})();
