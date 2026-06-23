const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  console.log("=== FIXING REMAINING ISSUES ===\n");
  
  // Fix "Candy Crush" (2024 PC/console) - should be manual, not IGDB
  const candyCrush = await sql.query(`
    SELECT mi.id, mi.title, mi.external_id, mi.source
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44 AND mi.title = 'Candy Crush'
  `);
  if (candyCrush.length > 0 && candyCrush[0].source === 'igdb') {
    await sql.query(`UPDATE media_items SET source = 'manual', external_id = 'curated-game-2024-candy-crush' WHERE id = $1`, [candyCrush[0].id]);
    console.log(`  Fixed: Candy Crush → manual`);
  }
  
  // Fix "Candy Crush Crushable" - should be IGDB
  const crushable = await sql.query(`
    SELECT mi.id, mi.title, mi.external_id, mi.source
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44 AND mi.title = 'Candy Crush Crushable'
  `);
  if (crushable.length > 0 && crushable[0].source !== 'igdb') {
    await sql.query(`UPDATE media_items SET source = 'igdb', external_id = 'igdb-387878' WHERE id = $1`, [crushable[0].id]);
    console.log(`  Fixed: Candy Crush Crushable → igdb-387878`);
  }
  
  // Fix platform variant curated IDs to use correct years
  const variants = [
    { title: "Candy Crush Saga (Facebook)", year: "2012" },
    { title: "Candy Crush Saga (Windows Phone)", year: "2012" },
    { title: "Candy Crush Saga (Windows 10)", year: "2015" },
    { title: "Candy Crush Hot Air Saga", year: "2016" },
    { title: "Candy Crush All Stars", year: "2022" },
    { title: "Candy Crush Blast", year: "2023" },
    { title: "Candy Crush 3D", year: "2023" },
  ];
  
  for (const v of variants) {
    const item = await sql.query(`
      SELECT mi.id, mi.external_id FROM media_items mi
      JOIN collection_items ci ON ci.media_item_id = mi.id
      WHERE ci.collection_id = 44 AND mi.title = $1
    `, [v.title]);
    
    if (item.length > 0) {
      const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const correctId = `curated-game-${v.year}-${slug}`;
      if (item[0].external_id !== correctId) {
        await sql.query(`UPDATE media_items SET external_id = $1 WHERE id = $2`, [correctId, item[0].id]);
        console.log(`  Fixed: ${v.title} → ${correctId}`);
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
