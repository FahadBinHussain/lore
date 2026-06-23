const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const games = [
  // Main Saga Series
  { title: "Candy Crush Saga", year: 2012, type: "game", dev: "King", desc: "The original match-three puzzle game that started it all. Mobile-first with Facebook integration. Over 3 billion downloads across platforms. Features thousands of levels across themed episodes." },
  { title: "Candy Crush Soda Saga", year: 2014, type: "game", dev: "King", desc: "Sequel introducing soda mechanics—bottles that transform the board upward. Features new match types including soda fish and coloring candy. Over 1 billion downloads." },
  { title: "Candy Crush Jelly Saga", year: 2016, type: "game", dev: "King", desc: "Third saga introducing jelly spreading mechanics and boss battles against the Jelly Queen. Features Puffler and Stuffed cookies. Unique versus mode against AI opponents." },
  { title: "Candy Crush Friends Saga", year: 2018, type: "game", dev: "King", desc: "Fourth saga with collectible character friends. Features new modes like-Octo, Crystal, and Candy Order. Enhanced graphics with 3D character models. First saga with customizable avatars." },

  // PC/Console Ports
  { title: "Candy Crush", year: 2024, type: "game", dev: "King", desc: "PC and console adaptation bringing the mobile experience to larger screens. Features cross-platform progression with mobile accounts. Available on Xbox, PlayStation, Nintendo Switch, and PC." },

  // Browser/Facebook
  { title: "Candy Crush (Facebook)", year: 2012, type: "game", dev: "King", desc: "Browser version that launched on Facebook. Pioneered social gaming mechanics with lives system and friend scores. Peak of 46 million monthly active users in 2013." },

  // Mobile Spin-offs
  { title: "Candy Crush Hot Air Saga", year: 2016, type: "game", dev: "King", desc: "Cancelled beta game featuring balloon-based mechanics. Never officially released to public. Limited testing in select markets." },

  // Related King Games (Candy universe)
  { title: "Bubble Witch Saga", year: 2011, type: "game", dev: "King", desc: "Predecessor to Candy Crush Saga. Bubble-shooter puzzle game on Facebook. Established King's free-to-play model with lives and social features." },
  { title: "Farm Heroes Saga", year: 2013, type: "game", dev: "King", desc: "Match-three game set in a farm theme. Features cropsies instead of candies. Cross-promoted heavily with Candy Crush players." },
  { title: "Candy Crush All Stars", year: 2022, type: "game", dev: "King", desc: "Competitive tournament mode connecting top players worldwide. Real-time PvP with elimination brackets. Featured live-streamed finals with cash prizes." },
];

(async () => {
  console.log("=== CREATING CANDY CRUSH UNIVERSE ===\n");

  // 1. Create the universe
  console.log("1. Creating universe...");
  const universe = await sql.query(`
    INSERT INTO collections (name, slug, description, created_by, visibility, item_count)
    VALUES ($1, $2, $3, 1, 'public', $4)
    RETURNING id, name, slug
  `, [
    "Candy Crush",
    "candy-crush",
    "King's legendary match-three puzzle franchise that redefined mobile gaming. Candy Crush Saga (2012) became one of the most downloaded mobile games ever with 3 billion+ downloads. The franchise spans multiple saga titles, competitive esports, and cross-platform play across mobile, PC, and consoles.",
    games.length
  ]);
  const colId = universe[0].id;
  console.log("  Created:", JSON.stringify(universe[0]));

  // 2. Create media items and collection items
  console.log("\n2. Creating media items...");
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const slug = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const extId = `candy-crush-${g.year}-${slug}`;

    // Create media item
    const media = await sql.query(`
      INSERT INTO media_items (external_id, source, media_type, title, description, release_date, developer, is_placeholder)
      VALUES ($1, 'manual', 'game', $2, $3, $4, $5, false)
      RETURNING id, title
    `, [extId, g.title, g.desc, `${g.year}-01-01`, g.dev]);

    const mediaId = media[0].id;

    // Create collection item
    await sql.query(`
      INSERT INTO collection_items (collection_id, media_item_id, release_order, chronological_order, is_required)
      VALUES ($1, $2, $3, $3, true)
    `, [colId, mediaId, i + 1]);

    console.log(`  [${i + 1}/${games.length}] ${g.title} (${g.year})`);
  }

  // 3. Verify
  console.log("\n=== VERIFICATION ===");
  const verify = await sql.query(`
    SELECT ci.release_order, mi.title, mi.release_date, mi.developer
    FROM collection_items ci
    JOIN media_items mi ON mi.id = ci.media_item_id
    WHERE ci.collection_id = $1
    ORDER BY ci.release_order
  `, [colId]);
  console.log(JSON.stringify(verify, null, 2));

  console.log(`\n=== DONE: ${games.length} games created ===`);
})();
