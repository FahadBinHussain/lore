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

When creating or updating universe items, agents **must** try to connect items to the project's existing APIs whenever possible. Use `ensureCanonicalMediaItem` with the correct `source` and `externalId` for each media type:

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

If an item cannot be connected to an API (no listing, cancelled game, regional-only release), use `source: 'manual'` with a `curated-{type}-{year}-{slug}` external ID format.
