# Lore Agent Rules

## Universe creation workflow

When creating a new universe or expanding an existing one, agents **must** use the `research` skill (installed from `mattpocock/skills@research`) to find all media items across the franchise. Do not rely on manual lists alone — `research` spins up a background agent that investigates against primary sources (Wikipedia, official sites, first-party APIs) and writes findings to a markdown file with citations. It covers movies, TV, games, books, comics, spin-offs, mobile, browser, and regional releases that manual curation misses.

Steps:
1. Run the `research` skill on the franchise/universe name
2. Compile all official media items found
3. Use the existing `create-*-universe.ts` script pattern to insert into the database
4. Verify the inserted items match the research output

### Duplicate prevention

Before creating or expanding a universe, agents **must** inspect the database first:

- Check whether the universe already exists by slug and name. If it exists, update the existing collection instead of creating another one.
- For every researched item, check for an existing canonical `media_item` using its media type, API source, and external ID before creating a record.
- Reuse existing canonical media records. Never create a second record for the same API entity.
- Check whether each item is already linked to the target universe before inserting the collection membership. Never add duplicate membership rows.
- Check whether the item belongs to other universes. Cross-universe membership is allowed when factually correct, but all universes must reference the same canonical media record.
- After insertion, verify that the universe has one collection record, unique item memberships, and no duplicate canonical items.

## Universe completeness rule

A universe **must** contain **every official media item** found for that franchise. Do not skip, prune, or limit the list based on perceived size, popularity, or importance. Include **all** official entries: main series, sequels, spin-offs, crossovers, short films, web series, mobile games, comics, books, soundtracks, and regional exclusives. If it is officially released media under the franchise name, it belongs in the universe. Size is not a concern — completeness is.

Items in a universe **must** be ordered by **release order** — the order in which each media item was first released to the public. When inserting items, set `release_order` and `chronological_order` based on actual release dates, not alphabetical or arbitrary order.

**Release order rule:** sort by the item's original release date (earliest first). This is the canonical viewing/reading order for the franchise.

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

### Verified API bindings (reference examples)

These items were successfully connected to APIs after verification:

| Item | Media Type | API | External ID |
| --- | --- | --- | --- |
| Black Mirror (series) | tv | tmdb | `42009` |
| Black Mirror: Bandersnatch | movie | tmdb | `569547` |
| Inside Black Mirror (book) | book | openlibrary | `OL20181820W` |
| Thronglets (game) | game | igdb | `339816` |
| Nohzdyve (game) | game | igdb | `123624` |

### Confirmed manual-only items (API absence verified)

These items were checked against their respective APIs and confirmed absent:

| Item | Media Type | Why manual |
| --- | --- | --- |
| Black Mirror: USS Callister (Graphic Novel) | comic | ComicVine search returned no results for this graphic novel |
| Nosedive (Board Game) | boardgame | BGG search returned no results |
| Black Mirror Labyrinth | themepark | Not in themeparks API database (Thorpe Park limited-run attraction) |
| The Black Mirror Experience | themepark | Not in themeparks API database (upcoming 2026 Univrse attraction) |

When in doubt, query the API directly before falling back to manual. Never assume absence without checking.

### Running one-off TypeScript scripts

This repository does not install `tsx` or `ts-node`, and the current Node 24 environment can fail when `tsx` tries to initialize its loader worker. For repository scripts, bundle the entry point with `npx --yes esbuild@0.25.10 <script> --bundle --platform=node --format=cjs --outfile=<temporary.cjs>`, then run the bundle with `node --env-file=.env --env-file=.env.local <temporary.cjs>`. Remove the temporary bundle afterward.

## Navigation scroll restoration

`ScrollNavigationTracker` owns window scroll behavior: new routes start at the top, while browser history navigation and reloads restore the saved position from session storage. Keep `PageTransition` keyed directly from `usePathname()`; delaying its key update in an effect remounts page content after restoration and loses the restored position.

## Route loading feedback

For App Router destinations that perform server-side database work before rendering, add a route-segment `loading.tsx` that mirrors the destination's final geometry. Navbar pending feedback must start from `Link`'s `onNavigate`, reserve indicator space to avoid layout shift, preserve modified clicks and normal link behavior, and suppress only duplicate unmodified navigation while the same route is pending.

## Vercel deployment

- Production project: `lore`, owned by the `owning vercel profile` Vercel profile.
- Canonical production URL: `https://univrs.vercel.app`.
- Link and deploy through `mainframe\vercel-account.ps1` with the `owning vercel profile` profile and team `team id`. Do not create another `lore` project under a different profile.
- **CLI 58.x gotcha (2026-08-12):** the auto-updated Vercel CLI rejects the old `.vercel/repo.json` link format (errors `Root Directory must be a relative path` on deploy, and `--cwd <abs-path>` is no longer accepted). `.vercel/project.json` must hold `{"projectId":"project id","orgId":"team id"}` and deploys must run from the repo directory: `vercel-account.ps1 run owning vercel profile -- deploy --prod --yes --force` (no `--cwd`, no path arg).
- Preserve the existing `FahadBinHussain/lore` GitHub connection and project environment configuration.
- Verify `/`, `/movies`, `/api/movies?page=1`, `/api/universes`, and `/api/auth/providers` before considering a production deployment complete.
