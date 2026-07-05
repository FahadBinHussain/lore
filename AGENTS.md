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

**allowed `manual` fallback only when:**
- the item has no listing on the relevant API (e.g., cancelled/unreleased game, regional-only release, web-only short, or limited-run theme park experience with no database entry)
- you have verified the absence by querying the API directly or confirming no search results exist

fallback format: `source: 'manual'` with `curated-{type}-{year}-{slug}` external id.

agents must not default to `manual` for convenience. API binding is the norm; curated is the exception and must be justified per item.
