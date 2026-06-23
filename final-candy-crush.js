const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // Get existing items
  const existing = await sql.query(`
    SELECT ci.id, mi.title FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
  `);
  const existingTitles = new Set(existing.map(i => i.title));
  
  // New items from deep research
  const newGames = [
    { title: "Candy Crush Crushable", year: 2026, type: "game", dev: "King", desc: "Browser video game in the Candy Crush franchise. Announced 2026. Most recent Candy Crush franchise title." },
  ];

  console.log("=== ADDING MISSING ITEMS ===\n");
  
  for (const g of newGames) {
    if (existingTitles.has(g.title)) {
      console.log(`  [SKIP] ${g.title} already exists`);
      continue;
    }
    
    const slug = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const extId = `candy-crush-${g.year}-${slug}`;

    const media = await sql.query(`
      INSERT INTO media_items (external_id, source, media_type, title, description, release_date, developer, is_placeholder)
      VALUES ($1, 'manual', 'game', $2, $3, $4, $5, false)
      RETURNING id, title
    `, [extId, g.title, g.desc, `${g.year}-01-01`, g.dev]);

    const mediaId = media[0].id;
    const maxOrder = await sql.query(`SELECT COALESCE(MAX(release_order), 0) + 1 as next_order FROM collection_items WHERE collection_id = 44`);

    await sql.query(`
      INSERT INTO collection_items (collection_id, media_item_id, release_order, chronological_order, is_required)
      VALUES ($1, $2, $3, $3, true)
    `, [44, mediaId, maxOrder[0].next_order]);

    console.log(`  [ADDED] ${g.title} (${g.year})`);
  }

  // Final reorder by release date
  console.log("\n=== REORDERING BY RELEASE DATE ===");
  const items = await sql.query(`
    SELECT ci.id, mi.release_date
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY mi.release_date ASC, ci.id ASC
  `);

  for (let i = 0; i < items.length; i++) {
    await sql.query(`UPDATE collection_items SET release_order = $1, chronological_order = $1 WHERE id = $2`, [i + 1, items[i].id]);
  }

  // Update item count
  const count = await sql.query(`SELECT COUNT(*) as count FROM collection_items WHERE collection_id = 44`);
  await sql.query(`UPDATE collections SET item_count = $1 WHERE id = 44`, [count[0].count]);

  // Final verification
  console.log("\n=== FINAL UNIVERSE ===");
  const final = await sql.query(`
    SELECT ci.release_order, mi.title, mi.release_date, mi.developer
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  for (const item of final) {
    const date = item.release_date ? new Date(item.release_date).toISOString().split('T')[0] : 'N/A';
    console.log(`  ${item.release_order}. ${item.title} (${date})`);
  }
  console.log(`\nTotal: ${final.length} items`);
})();
