# Lore Agent Rules

## Universe creation workflow

When creating a new universe or expanding an existing one, agents **must** use the `deep-research` skill to find all media items across the franchise. Do not rely on manual lists alone — deep-research covers movies, TV, games, books, comics, spin-offs, mobile, browser, and regional releases that manual curation misses.

Steps:
1. Run deep-research on the franchise/universe name
2. Compile all official media items found
3. Use the existing `create-*-universe.js` pattern to insert into the database
4. Verify the inserted items match the research output

## Universe item ordering

Items in a universe **must** be ordered by release date (chronological release order). When inserting items, set `release_order` and `chronological_order` based on actual release dates, not alphabetical or arbitrary order.

## API connections

**Hard rule:** when creating or updating universe items, agents **must** bind every item to the project's existing APIs. do not create `manual`/`curated` items unless the media is genuinely absent from all supported APIs.

use `ensureCanonicalMediaItem` with the correct `source` and `externalId` for each media type:

| Media type | API source | External ID format |
| --- | --- | --- |
| movie | tmdb | `tmdb-{id}` |
| tv | tmdb | `tmdb-{id}` |
| anime | anilist | `anilist-{id}` |
| game | igdb | `igdb-{id}` |
| book | openlibrary | `openlibrary-{olid}` |
| comic | comicvine | `comicvine-{id}` |
| boardgame | bgg | `bgg-{id}` |
| soundtrack | musicbrainz | `musicbrainz-{id}` |
| podcast | listennotes | `listennotes-{id}` |
| themepark | themeparks | `themeparks-{id}` |

### TV / Anime structure rule

**Universe collections must contain series-level items only. Never add individual episodes to a universe collection.**

- add the **TV series** (e.g., "Black Mirror", "Agents of S.H.I.E.L.D.") as a single `media_item` with `media_type: 'tv'` and `source: 'tmdb'`.
- episode tracking is handled automatically through the `seasons` and `episodes` tables, which get populated from the API when the series is imported.
- do NOT create separate `media_item` records for individual episodes (e.g., "Black Mirror: White Christmas", "Agents of S.H.I.E.L.D. Episode 1").
- anthologies, miniseries, and seasonal shows are still single series entries — the season/episode tables handle the breakdown.

**Examples of existing correct patterns:**
- Marvel Cinematic Universe: "WandaVision" (tmdb/85271), "Loki" (tmdb/84958) — series items only, zero episode entries in the collection.
- Dr. Seuss: "The Wubbulous World of Dr. Seuss" (tmdb/3211), "Green Eggs and Ham" (tmdb/86957) — series items only.
- Black Mirror: "Black Mirror" (tmdb/42009) — one series item covering all 7 seasons and 33 episodes via the seasons/episodes tables.

**What NOT to do:**
- the original Black Mirror universe had 33 manual episode entries like "Black Mirror: The National Anthem", "Black Mirror: San Junipero" — all were removed. the single series entry is sufficient.

### Allowed `manual` fallback

Only when an item is genuinely absent from the relevant API:
- cancelled/unreleased game with no IGDB entry
- regional-only release with no TMDB/AniList entry
- web-only short, limited-run theme park experience, or one-off board game with no BGG entry
- verified by querying the API directly and confirming zero results

fallback format: `source: 'manual'` with `curated-{type}-{year}-{slug}` external id.

agents must not default to `manual` for convenience. API binding is the norm; curated is the exception and must be justified per item.
