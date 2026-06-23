const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

// New games discovered through deep research
const newGames = [
  // Soft-launched / Cancelled titles
  { title: "Candy Crush Blast", year: 2023, type: "game", dev: "King", desc: "Tap-to-blast puzzle game soft launched in Philippines (Dec 2023). Cancelled by King in November 2024 before global release. Tested fast-paced blast mechanics as departure from main series. Only available on Android Google Play in Philippines." },
  { title: "Candy Crush 3D", year: 2023, type: "game", dev: "King", desc: "3D puzzle game soft launched in Philippines and Malaysia. Cancelled by King in November 2024. Part of King's test-and-iterate approach to new game development. Never received global launch." },
  { title: "Candy Crush Solitaire", year: 2023, type: "game", dev: "King", desc: "Solitaire puzzle game soft launched in Canada (July 2023). After 18 months of testing, received global launch on February 6, 2025. The ONLY Candy Crush spin-off to survive soft launch since Friends Saga (2018). Available on mobile and PC." },
  
  // Historical / Regional
  { title: "Candy Crush Saga (Facebook)", year: 2012, type: "game", dev: "King", desc: "Browser version launched on Facebook alongside mobile. Pioneered social gaming mechanics with lives system and friend scores. Peak of 46 million monthly active users in 2013. Still available today." },
  { title: "Candy Crush Saga (Windows Phone)", year: 2012, type: "game", dev: "King", desc: "Windows Phone version released in 2012. Part of early mobile expansion. Later replaced by Windows 10 universal app." },
  { title: "Candy Crush Saga (Windows 10)", year: 2015, type: "game", dev: "King", desc: "Windows 10 universal app replacing Windows Phone version. Part of Microsoft partnership after Activision acquisition. Available on Microsoft Store." },
  
  // Related King Games (Candy universe)
  { title: "Candy Crush Solitaire (Soft Launch)", year: 2023, type: "game", dev: "King", desc: "Initial soft launch of Candy Crush Solitaire in Canada (July 2023). Tested for 18 months before global release in February 2025." },
];

(async () => {
  console.log("=== UPDATING CANDY CRUSH UNIVERSE WITH DEEP RESEARCH FINDINGS ===\n");

  // Get existing universe
  const existing = await sql.query(`
    SELECT id, name, slug FROM collections WHERE slug = 'candy-crush'
  `);
  
  if (existing.length === 0) {
    console.error("Candy Crush universe not found!");
    process.exit(1);
  }
  
  const colId = existing[0].id;
  console.log("Found universe:", JSON.stringify(existing[0]));

  // Get existing items count
  const existingCount = await sql.query(`
    SELECT COUNT(*) as count FROM collection_items WHERE collection_id = $1
  `, [colId]);
  console.log("Existing items:", existingCount[0].count);

  // Add new games
  console.log("\nAdding new games from deep research...");
  let addedCount = 0;
  
  for (const g of newGames) {
    // Check if already exists
    const exists = await sql.query(`
      SELECT id FROM media_items WHERE title = $1 AND developer = $2
    `, [g.title, g.dev]);
    
    if (exists.length > 0) {
      console.log(`  [SKIP] ${g.title} already exists`);
      continue;
    }
    
    const slug = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const extId = `candy-crush-${g.year}-${slug}`;

    // Create media item
    const media = await sql.query(`
      INSERT INTO media_items (external_id, source, media_type, title, description, release_date, developer, is_placeholder)
      VALUES ($1, 'manual', 'game', $2, $3, $4, $5, false)
      RETURNING id, title
    `, [extId, g.title, g.desc, `${g.year}-01-01`, g.dev]);

    const mediaId = media[0].id;

    // Get next release order
    const maxOrder = await sql.query(`
      SELECT COALESCE(MAX(release_order), 0) + 1 as next_order FROM collection_items WHERE collection_id = $1
    `, [colId]);

    // Create collection item
    await sql.query(`
      INSERT INTO collection_items (collection_id, media_item_id, release_order, chronological_order, is_required)
      VALUES ($1, $2, $3, $3, true)
    `, [colId, mediaId, maxOrder[0].next_order]);

    console.log(`  [ADDED] ${g.title} (${g.year})`);
    addedCount++;
  }

  // Update universe item count
  const newCount = await sql.query(`
    SELECT COUNT(*) as count FROM collection_items WHERE collection_id = $1
  `, [colId]);
  
  await sql.query(`
    UPDATE collections SET item_count = $1 WHERE id = $2
  `, [newCount[0].count, colId]);

  // Verify
  console.log("\n=== FINAL VERIFICATION ===");
  const verify = await sql.query(`
    SELECT ci.release_order, mi.title, mi.release_date, mi.developer
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = $1
    ORDER BY ci.release_order
  `, [colId]);
  console.log(JSON.stringify(verify, null, 2));

  console.log(`\n=== DONE: Added ${addedCount} new games. Total: ${newCount[0].count} items ===`);
})();
