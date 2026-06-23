const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  console.log("=== FIXING DUPLICATE IGDB ENTRIES ===\n");
  
  // Find duplicates (same external_id)
  const duplicates = await sql.query(`
    SELECT mi.external_id, COUNT(*) as count, 
           ARRAY_AGG(mi.id ORDER BY mi.id) as ids,
           ARRAY_AGG(mi.title ORDER BY mi.id) as titles
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44 AND mi.source = 'igdb'
    GROUP BY mi.external_id
    HAVING COUNT(*) > 1
  `);
  
  console.log("Found duplicates:");
  for (const dup of duplicates) {
    console.log(`  ${dup.external_id}: ${dup.titles.join(', ')}`);
  }
  
  // For duplicates, keep the first one with igdb source, revert others to manual
  for (const dup of duplicates) {
    const ids = dup.ids;
    // Keep first as igdb, revert rest to manual with curated IDs
    for (let i = 1; i < ids.length; i++) {
      const title = dup.titles[i];
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const newExternalId = `curated-game-2012-${slug}`;
      
      await sql.query(`
        UPDATE media_items SET source = 'manual', external_id = $1 WHERE id = $2
      `, [newExternalId, ids[i]]);
      
      console.log(`  Reverted: ${title} → manual (${newExternalId})`);
    }
  }
  
  // Also fix "Candy Crush" which matched "Candy Crush Crushable" on IGDB
  const candyCrush = await sql.query(`
    SELECT mi.id, mi.title, mi.external_id
    FROM media_items mi
    JOIN collection_items ci ON ci.media_item_id = mi.id
    WHERE ci.collection_id = 44 AND mi.title = 'Candy Crush'
  `);
  
  if (candyCrush.length > 0 && candyCrush[0].external_id === 'igdb-387878') {
    await sql.query(`
      UPDATE media_items SET source = 'manual', external_id = 'curated-game-2024-candy-crush' WHERE id = $1
    `, [candyCrush[0].id]);
    console.log(`\n  Fixed: Candy Crush → manual (curated-game-2024-candy-crush)`);
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
