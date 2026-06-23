const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // Get all items with their release dates
  const items = await sql.query(`
    SELECT ci.id, ci.release_order, mi.title, mi.release_date, mi.developer
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY mi.release_date ASC, ci.release_order ASC
  `);

  console.log("Current order (by release_date):");
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const date = item.release_date ? new Date(item.release_date).toISOString().split('T')[0] : 'N/A';
    console.log(`  ${i + 1}. ${item.title} (${date}) - current order: ${item.release_order}`);
  }

  // Update release_order and chronological_order based on release_date
  console.log("\nUpdating release_order...");
  for (let i = 0; i < items.length; i++) {
    const newOrder = i + 1;
    if (items[i].release_order !== newOrder) {
      await sql.query(`
        UPDATE collection_items 
        SET release_order = $1, chronological_order = $1
        WHERE id = $2
      `, [newOrder, items[i].id]);
      console.log(`  Updated: ${items[i].title} from ${items[i].release_order} to ${newOrder}`);
    }
  }

  // Verify
  console.log("\nFinal order:");
  const updated = await sql.query(`
    SELECT ci.release_order, mi.title, mi.release_date
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = 44
    ORDER BY ci.release_order
  `);
  for (const item of updated) {
    const date = item.release_date ? new Date(item.release_date).toISOString().split('T')[0] : 'N/A';
    console.log(`  ${item.release_order}. ${item.title} (${date})`);
  }
})();
