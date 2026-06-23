const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // Remove duplicate: Candy Crush (Facebook) - keep Candy Crush Saga (Facebook)
  console.log("Removing duplicates...");
  
  // Find and remove "Candy Crush (Facebook)" (duplicate of "Candy Crush Saga (Facebook)")
  const fb = await sql.query(`
    SELECT ci.id, mi.title FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44 AND mi.title = 'Candy Crush (Facebook)'
  `);
  if (fb.length > 0) {
    await sql.query(`DELETE FROM collection_items WHERE id = $1`, [fb[0].id]);
    console.log(`  Removed: ${fb[0].title}`);
  }

  // Find and remove "Candy Crush Solitaire (Soft Launch)" (keep "Candy Crush Solitaire")
  const sol = await sql.query(`
    SELECT ci.id, mi.title FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44 AND mi.title = 'Candy Crush Solitaire (Soft Launch)'
  `);
  if (sol.length > 0) {
    await sql.query(`DELETE FROM collection_items WHERE id = $1`, [sol[0].id]);
    console.log(`  Removed: ${sol[0].title}`);
  }

  // Update item count
  const count = await sql.query(`SELECT COUNT(*) as count FROM collection_items WHERE collection_id = 44`);
  await sql.query(`UPDATE collections SET item_count = $1 WHERE id = 44`, [count[0].count]);

  // Reorder remaining items
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

  // Final verification
  console.log("\nFinal universe:");
  const final = await sql.query(`
    SELECT ci.release_order, mi.title, mi.release_date
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
