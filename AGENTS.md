# Artist tracker (WikiArt)

- The artist tracker stores provider references and per-user explored state in `artists` and `user_artist_progress`; it does not copy WikiArt artwork files into the repository or database.
- **The API is DB-first (changed 2026-09-27).** `GET /api/artists` and `GET /api/artists/[slug]` read only from the local `artists`/`artworks` tables (populated by the keyless crawler below); the old credential-gated `src/lib/api/wikiart.ts` client was deleted because WikiArt's official API signup is closed, so `WIKIART_ACCESS_CODE`/`WIKIART_SECRET_CODE` no longer exist or gate anything. A slug missing from the catalog returns a 404 telling you to run `scripts/sync-artists-wikiart-keyless.ts single <slug>` — never reintroduce a credential check or a silent remote fallback.
- Detail responses cap at 500 paintings (`total`/`truncated` fields; the UI labels "Showing first N of M") so artists like Van Gogh (1,932 works) do not ship a megabyte of JSON.
- **`artists.death_year = 9999` is WikiArt's "still alive" sentinel, not a year.** 818 rows carry it; the detail page's `lifeSpan()` treats `>= 9000` as living (`b. 1984`) instead of printing `1984 – 9999`. Any new renderer of `death_year` must do the same — never sort, format, or compute age from the raw value.
- **Artwork-level explored state (migration `0010_artwork_progress`)** — `user_artwork_progress` (unique per user+artwork) mirrors episode watching; `user_artist_progress.is_auto` records whether the artist mark came from completion or a manual click. The TV-series rule lives in `src/lib/artists/progress.ts` `reconcileArtist(userId, artistId, mode)`: every artwork explored → artist marked explored `is_auto=true`; un-exploring one flips an auto mark back off; **manual marks are never clobbered** (a manual un-mark while complete survives reads; a manual mark while incomplete survives reads). Modes: `up` (promote, called only after an artwork toggle), `down` (demote, runs on every GET), `both` (after an artwork toggle). The logic is covered by a throwaway harness pattern — bundle a `scripts/tmp-*.ts` with esbuild and run it against Neon (12 assertions verified promote/demote/manual-survival before delete).

### Rejected artist API providers

The replacement for WikiArt must be a genuinely global, large-scale artist/artwork database. Do not promote a museum, library, archive, or authority service to the primary provider merely because it has an API.

- **Art Institute of Chicago** — museum-specific.
- **Open Library** — books and art books, not a global artwork database.
- **Europeana** — museum/archive aggregator with inconsistent coverage and an API-key requirement.
- **Getty ULAN** — authority matching only, not artwork tracking.
- **VIAF** — authority matching and deduplication only, not artwork tracking.
- **Artsy public API** — global coverage, but the official documentation says the public API is being retired; partner access is restricted.
- **MoMA API/open data** — one museum; live API is staff/partner-only despite the open dataset.
- **Collect24 Registry API** — synchronization layer for contributed records, not an independent global catalog.
- **ArtFacts** — global-scale public database claims, but no public developer API was found.
- **Vasari Codex** — global artist identity/activity coverage, but its API intentionally excludes artwork collections, holdings, pagination, and bulk export; Simon Stålenhag also returned no match during verification.
- **Wikidata (+ Wikimedia Commons)** — global artist identity/bio coverage, but artwork data missing for contemporary artists; Simon Stålenhag probe 2026-09-26 returned Q16945517 bio-only with zero P170 artwork bindings, Commons held only one portrait photo and zero artwork images, Openverse held only book photos and style imitations.

# Lore Agent Rules

### Artist sync columns (added 2026-09-26, migration `0008_artist_sync`)

`artists` carries `seed_rev` (HF snapshot id, e.g. `Artificio/WikiArt_Full`), `last_synced_at` (last live `?json=2` delta check), and `artwork_count` (last seen work count). UI shows a loud `STALE` badge when `last_synced_at` is older than 30 days. PowerShell gotcha: `$host` is read-only — use `$pgHost` for the Neon pooler host variable.

### WikiArt keyless XHR endpoints (verified 2026-09-26)

WikiArt's official API signup is closed (GetKeys page serves only a sign-in modal). The site's own Angular app calls undocumented `?json=` XHRs that work with **no key**: send header `X-Requested-With: XMLHttpRequest` plus a browser `User-Agent`, otherwise the HTML page is returned instead of JSON.

- artist meta — `GET /en/{slug}?json=2` → `artistName`, `biography`, `birthDay`/`deathDay` (`/Date(1234567)/` ms), `image`, `series`, `wikipediaUrl`.
- artist paintings — `GET /en/{slug}/mode/all-paintings?json=2&layout=new&page={n}&resultType=masonry` → `Paintings[]` (`id`, `title`, `year`, `width`, `height`, `image`, `paintingUrl`), `AllPaintingsCount`; page 1 = 60 rows, empty `Paintings` = end.
- artist discovery — `GET /en/Alphabet/{a-z}?json=3&page={n}` → `ArtistsHtml` (parse `href="/en/{slug}" title="{Name}"`), 60/page, `CanLoadMoreArtists`.
- sitemap — `robots.txt` → `https://www.wikiart.org/sitemap/sitemap_index.xml` (artists.xml, paintings-1..6.xml = ~241k painting URLs). Use it to check whether an artist's works exist site-wide before assuming a crawl miss.

Crawler: `scripts/sync-artists-wikiart-keyless.ts` (modes `discover` / `sync` / `single <slug>`; idempotent, skips artists synced <24h; `jget` retries network/5xx/429 6x with backoff — 400/403 fail loudly). HF seed script: `scripts/seed-artists-wikiart-keyless.ts`. State as of 2026-09-26: **3,564 wikiart artists, all synced, 193,769 artworks across 3,558 artists**.

**Zero-work artists are a site condition, not a crawl bug.** 6 artists (`yves-klein`, `paula-klien`, `jorge-oteiza`, `oliver-mark`, `barbara-mcgivern`, `jordao-de-oliveira`) serve `AllPaintingsCount: 0` on every endpoint (`mode/all-paintings`, `all-works`, `text-list`, every `resultType`, any UA incl. Googlebot, cookie-seeded, and via an external proxy) while their `<title>` advertises e.g. "100 artworks". Confirmed genuinely empty: zero `/en/{slug}/*` painting URLs in all six sitemap files, painting-detail URLs 404, and no `wiki-masonry` gallery in the server HTML (working artists like `mark-rothko` render one). The sync script now prints a loud `ZERO-WORK` line for each such artist (distinguishing "title claims N" from "no count in title") and tallies them in the `DONE ... ZERO-WORK=` summary — treat these as copyright/geo-restricted rows with `artwork_count = 0`, never as a missing sync.

## Roadmap: episode rating coverage for anilist-source anime

`episodes.rating` / `vote_count` now hold the TMDB audience score for every episode (migration `0006_episode_ratings`; `resolveTvEpisode` writes them on create; the mixed-order timeline and the expanded airing-window list both render the star badge). One gap remains, deferred:

- **4,315 episode rows across 28 `anilist`-source anime** (Dragon Ball, Death Note, Doraemon, Super Dragon Ball Heroes, etc.) still have `rating IS NULL`. Their parent `media_items` are bound to AniList, which exposes no per-episode score, so there is nothing to fetch against today.
- **Plan when picked up**: resolve each anilist anime to its TMDB tv counterpart (AniList `external_links` / TMDB `/search/tv` + `external_ids`), verify the title matches before binding (the TMDB-id verification rule applies), and backfill `episodes.rating`/`vote_count` from `GET /tv/{id}/season/{n}`. Do **not** re-bind the `media_items.source` away from anilist — the AniList binding is canonical for those items; only borrow the TMDB episode scores.
- Scope check first with: `SELECT m.title, count(e.id) FROM episodes e JOIN seasons s ON s.id=e.season_id JOIN media_items m ON m.id=s.media_item_id WHERE e.rating IS NULL AND m.source='anilist' GROUP BY m.title;`

## Post-watch deletion workflow (standing order)

After an item is marked done in the tracker, **delete its local download** — this is the machine's disk-hygiene step, not an optional cleanup. C: runs tight, and episodes are fetched ahead of the watch position, so watched files are pure overhead.

Order of operations:

1. Confirm the item is actually watched in the DB (`user_episode_progress.is_watched` / `user_media_progress.status='completed'` for user 1) **before deleting anything**. Never delete a file for an unwatched item.
2. Find the local copy. Downloads land in `C:\Users\Admin\Downloads`, either as loose files or inside qBittorrent torrents. qBittorrent runs with its WebUI at `http://127.0.0.1:8080` (no auth): `GET /api/v2/torrents/info`, then `GET /api/v2/torrents/files?hash=<hash>` to map episodes to files. Episode-folder torrents are named `E0X - <Episode Title>/...` with a `BDMV/STREAM/00000.m2ts` inside per episode.
3. In qBittorrent, set the watched episode's files to skip **first**: `POST /api/v2/torrents/filePrio` with `priority=0`, one `id` per request — the API rejects comma-separated `id` lists with `400`. Files are keyed by the `index` field from the files listing (v5 names it `index`, not `id`).
4. Delete the watched video file **and any matching subtitle sidecars** from disk (`.srt`, `.ass`, `.ssa`, `.sub`, `.idx`, `.vtt`; use the same basename). For episode-folder or disc torrents, remove only the watched episode's file/folder and its matching sidecars — never the season folder. Confirm every targeted video and subtitle path is absent and that the free space moved.

The torrent's file metadata will keep listing the deleted files — that is the expected steady state for watch-as-you-go; priority 0 keeps the client from re-fetching them. Do not delete the whole torrent while unwatched episodes remain in it.

## Fetch-ahead rule (standing order, 2026-09-21)

Always keep the **next 10 mixed-order items** downloaded and ready ahead of the watch position (mixed order = episode-level, interleaved by date — see Watch-order Q&A rule). This is a hard invariant: after every watched item, recompute the list and ensure all 10 are ready before reporting the workflow complete. "Ready" means the file is fully on disk and verified: for qBittorrent, the torrent must report 100% AND disk allocation must confirm it (`fsutil sparse queryrange` growth / non-sparse full size) — never trust the WebUI `state`/`progress` fields alone, they intermittently return garbled duplicate rows for a single torrent. **The next 10 must also be 2160p/4K releases.** Never count a 1080p release as ready or silently downgrade; if a verified 4K release cannot be found, stop and report the exact missing item instead of substituting 1080p. Recompute the 10 after every watched item; fetch in mixed-order priority so the nearest unwatched item lands first. Stop fetching when C: free space would drop below ~10 GB — post-watch deletions fund the next fetches.

## TV/anime episode keying — resolve by (show, season, episode number), never by external_id

Episode rows in `episodes`/`seasons` have historically been created with **three different `external_id` conventions** depending on which code path wrote them:

| convention | season external_id | episode external_id | produced by |
| --- | --- | --- | --- |
| enriched import | `tmdb-tv-{showId}-s{n}` | `tmdb-episode-{tmdbEpisodeId}` | the universe/episode seeder (rich rows: name, overview, airDate, runtime, still) |
| toggle + cascade | `{showId}-{s}` | `{showId}-{s}-{e}` | `POST /api/tv/.../episode/{n}` and the `/api/media/status` cascade seeder (often bare stubs) |
| older import | `{tmdbSeasonId}` (bare) | `{tmdbEpisodeId}` (bare) | an earlier import script; rows are rich |

Looking an episode up by matching one of these **id strings** silently misses the row another path already wrote, then creates a *duplicate* season + stub episode pair. That strands watch progress on the stub (the UI that reads the other convention shows the episode unwatched) and, because the completed-show cascade counts `episodes` rows, makes the show unreachable — a duplicated 18-episode show can never report 18 watched.

**Every read/write path must resolve episodes by `(media_item_id, season_number, episode_number)` instead.** This is what `src/lib/media/tv-episode-resolver.ts` does:

- `resolveTvShow(showId)` — finds/creates the `media_items` row (upgrades placeholders from TMDB in place).
- `resolveTvSeason(mediaItemId, showId, seasonNumber)` — finds the season by number; when duplicates coexist it ranks the enriched import above the `{showId}-{s}` stub (episode_count > 0 beats 0, non-toggle id beats toggle id), and creates with the `tmdb-tv-*` convention.
- `resolveTvEpisode(seasonId, showId, seasonNumber, episodeNumber)` — finds the episode by number within the season and creates an enriched `tmdb-episode-*` row (name/overview/airDate/runtime/still fetched from TMDB) when missing.

Consumers wired to the resolver: `GET`/`POST /api/tv/[id]/season/[n]/episode/[e]`, `GET /api/tv/[id]/season/[n]` (now one batched query instead of one per episode), the `/api/media/status` tv cascade seeder, `POST /api/anime/[id]/season/[n]/episode/[e]` (season resolved source-agnostically — an anilist item can legitimately hold tmdb-convention episode rows, e.g. Dragon Ball anilist 223), and the `/api/media/status` per-episode branch (its `source` filter was removed — the `(item, season, episode)` key is unique across the table, so the filter only hid progress stored under another convention).

A one-time dedupe repaired the 56 keys that had already collided (Dragon Ball 55, Agent Carter 1): progress was re-pointed onto the canonical row, stub seasons/episodes deleted, and parent `user_media_progress` recomputed. Backups of the pre-repair rows live at `C:\tmp\lore-ep-repair\*.bak`. Do not reintroduce the split — if you add a new path that touches episode progress, go through the resolver.

### Cross-provider animated-series dedupe

TMDB can classify an animated series as `tv` while AniList classifies the same work as `anime`; do not treat `(source, external_id)` alone as proof that two records are distinct. Verify title, synopsis, episode structure, and characters before merging. Keep the AniList record as canonical when the work is fundamentally an anime entry, retain the TMDB ID as a non-primary `media_external_ids` alias, merge user/media and episode progress, and remove the duplicate media row plus its orphaned seasons/episodes.

Verified example: `Bernard` TMDB `7011` and AniList `12145` are the same polar-bear short series; AniList `media_items.id=3241` is canonical.

## Never commit universe research to the repo

Universe research notes (research skill dumps, franchise markdown, media index files, wiki scrapes) **must never be committed to this repo**. Keep them local/out of repo (e.g. `C:\tmp`) or in a private research store. The `research/` dir is gitignored and exists only as scratch space. If research files are ever found in git history, purge them with a history rewrite, not just a delete commit.

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

Items in a universe carry two orderings, which mean different things — never copy one into the other:

**Release order rule (`release_order`, required):** sort by the item's original public release date (earliest first). This is the canonical viewing/reading order for the franchise. Never alphabetical or arbitrary.

**Chronological order rule (`chronological_order`, nullable, reserved for a future chrono view):** sort by in-story timeline position — where the story sits inside the fictional chronology, not when it was released (e.g. Captain America: The First Avenger released 2011 but its story is 1940s, so it sorts near the start). For tv/anime series the story position is the series' overall placement; episode-level interleaving stays computed from `episodes.air_date` at view time. When the story placement is unknown, ambiguous (most games, anthologies, timeless shorts), or disputed — leave it NULL. A NULL means "unplaced", which a future chrono view can render as its own section; a copied release date would silently lie about story order.

## API connections

**Hard rule:** when creating or updating universe items, agents **must** bind every item to the project's existing APIs. `manual`/`curated` is **forbidden** — roll every stone on the internet first (see *No manual* rule below); never create a manual item without exhaustive, documented search and explicit user approval.

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

### `manual` is a transitional state only (standing rule, 2026-09-17)

**Every item must be bound to a real API source. Always.** `manual`/`curated` is never an endpoint — it is a placeholder that means "not yet bound, no source found *so far*". The project is slowly transitioning every existing manual item to a real binding as sources surface; a manual row is a debt to be repaid, not a settled answer.

Rules:
- Do not default to `manual` for convenience. Exhaust the supported APIs first, then any plausible third-party source, then — and only then — write it as manual with documented proof of the checks run.
- Manual is permitted only in these transitional cases (all requiring "verified absent from the relevant API *at the time*"):
  - cancelled/unreleased game with no IGDB entry
  - regional-only release with no TMDB/AniList entry
  - web-only short, limited-run theme park experience, or one-off board game with no BGG entry
  - an item no tracked source covers yet (e.g. a catalog with no API — reached only via crawlable HTML indexes)
- When a new provider is added to `MEDIA_PROVIDER_REGISTRY`, or a source is discovered for a manual item, **re-bind that item immediately**: update `source`/`external_id` on the canonical `media_item` (keeping its id and all progress rows), and remove its `manual`/`curated-*` tag. Never leave a known-bindable item on manual.
- When asked to review or expand a universe, re-check its manual items against current sources as part of the same pass — coverage grows over time and yesterdays's "absent" is often today's bound row.

fallback format (only while still transitional): `source: 'manual'` with `curated-{type}-{year}-{slug}` external id.

agents must not default to `manual` for convenience. API binding is the norm; manual is the exception and must be justified per item, with a note of what was checked and when.

**TMDB id verification gotcha (2026-08-20):** never trust a TMDB id without checking the fetched title. `116521` = "Runaways" (2012, one-off) and `75006` = The Umbrella Academy — both were wrongly bound to Marvel's Runaways at different times. The correct id is `67466`. When binding/fetching a tv/movie item, always fetch `/tv/{id}`/`/movie/{id}` first and assert the `name`/`title` matches before writing. Search endpoint is unusable with the configured key (401), so verify via direct detail calls or the public search page HTML (`href="/tv/{id}-..."`).

### Verified API bindings (reference examples)

These items were successfully connected to APIs after verification:

| Item | Media Type | API | External ID |
| --- | --- | --- | --- |
| Black Mirror (series) | tv | tmdb | `42009` |
| Marvel's Runaways (series) | tv | tmdb | `67466` |
| Black Mirror: Bandersnatch | movie | tmdb | `569547` |
| Inside Black Mirror (book) | book | openlibrary | `OL20181820W` |
| Thronglets (game) | game | igdb | `339816` |
| Nohzdyve (game) | game | igdb | `123624` |

### Manual items (transitional — re-bind when a source appears)

These items were checked against their respective APIs and confirmed absent **at the time of the check**. They are outstanding debts, not permanent answers: revisit them whenever a new provider is added or coverage is questioned.

| Item | Media Type | Why manual |
| --- | --- | --- |
| Black Mirror: USS Callister (Graphic Novel) | comic | ComicVine search returned no results for this graphic novel |
| Nosedive (Board Game) | boardgame | BGG search returned no results |
| Black Mirror Labyrinth | themepark | Not in themeparks API database (Thorpe Park limited-run attraction) |
| The Black Mirror Experience | themepark | Not in themeparks API database (upcoming 2026 Univrse attraction) |
| Call of Duty: World at War (Comic) | comic | ComicVine has no volume for this 2009 WildStorm series |
| Call of Duty: Black Ops (Comic) | comic | ComicVine only has Black Ops III/IV volumes, not the 2010 Prototype series |
| Call of Duty: Modern Warfare 3 - Defiance (Comic) | comic | ComicVine has no volume for this 2011 DC/WildStorm series |
| Call of Duty: Modern Warfare 2 - Ghost | book | OpenLibrary has no record of this 2009 Panini graphic novel |
| Call of Duty: Modern Warfare 3 - Delta | book | OpenLibrary has no record of this 2011 book |
| Call of Duty: Black Ops - Declassified | book | OpenLibrary has no record of this 2012 book |
| Call of Duty: The Ghosts of War | book | OpenLibrary has no record of this 2013 book |
| Call of Duty (Paramount Pictures) | movie | Unreleased film (2028); no TMDB entry until it ships |

When in doubt, query the API directly before falling back to manual. Never assume absence without checking.

## Call of Duty universe rebind (2026-09-19)

The `call-of-duty` collection (id 41, 61 items) was 48/61 `manual`. A binding pass against the real APIs resolved most of it:

- **All 20 manual games → IGDB**, each verified by exact-title match plus release date within 45 days (most exact). Two platform-specific gotchas: "Black Ops (DS)" is IGDB `135299` (Nintendo DS), **not** `545` (the main PS3/360 entry — same name, same date, different game); the `(Mobile)` items are under their own IGDB ids (`294571`, `294573`) with real 2007 dates, not the placeholder 2005/2006 in the manual rows. `CoD: Online` actually launched 2015-01-11, not the 2013 placeholder.
- **All 8 soundtracks → MusicBrainz** release-groups (ids recorded as `musicbrainz-{uuid}`). The `releasegroup:"…" AND artist:Call of Duty` query is too strict — a plain release-group search finds them; the artist is not "Call of Duty" but the composer (Zimmer/Balfe, Sean Murray, Jack Wall, Bear McCreary…).
- **2 of 5 comics → ComicVine** (`MW2 - Ghost` vol 62105 Panini, `Zombies` vol 95205 Dark Horse). The other three have no ComicVine volume.
- **0 of 4 books** — OpenLibrary has none of the CoD novelizations.
- **release_order gap closed**: a deleted item left a hole at 21; renumbered all 61 rows with `row_number() OVER (ORDER BY release_order)` so orders run 1–61 contiguous.

Remaining manual after the pass: 8 items (3 comics, 4 books, 1 unreleased movie) — all genuinely absent from their APIs, documented in the table above.

### Running one-off TypeScript scripts

This repository does not install `tsx` or `ts-node`, and the current Node 24 environment can fail when `tsx` tries to initialize its loader worker. For repository scripts, bundle the entry point with `npx --yes esbuild@0.25.10 <script> --bundle --platform=node --format=cjs --outfile=<temporary.cjs>`, then run the bundle with `node --env-file=.env --env-file=.env.local <temporary.cjs>`. Remove the temporary bundle afterward.

## Navigation scroll restoration

`ScrollNavigationTracker` owns window scroll behavior: new routes start at the top, while browser history navigation and reloads restore the saved position from session storage. Keep `PageTransition` keyed directly from `usePathname()`; delaying its key update in an effect remounts page content after restoration and loses the restored position.

## Route loading feedback

For App Router destinations that perform server-side database work before rendering, add a route-segment `loading.tsx` that mirrors the destination's final geometry. Navbar pending feedback must start from `Link`'s `onNavigate`, reserve indicator space to avoid layout shift, preserve modified clicks and normal link behavior, and suppress only duplicate unmodified navigation while the same route is pending.

## canonical.ts IGDB poster backfill prefix bug (fixed 2026-09-22)

`fetchPosterFromProvider`'s `igdb` branch built its cover lookup as `where id = ${externalId}` — but the canonical convention stores external ids WITH the `igdb-` prefix (`igdb-279624`), so the query became `where id = igdb-279624`, IGDB 400'd, and every IGDB item created via `ensureCanonicalMediaItem` landed with `posterPath: null` (silently — the try/catch swallows it). `igdb` now strips the prefix the same way (`replace(/^igdb-/, '')`). Symptom to watch for: a freshly created IGDB-bound item with no poster in list views. Legacy rows with bare numeric external ids were unaffected.

## Vercel deployment

- Production project: `lore` (owned by the owning Vercel profile).
- Canonical production URL: `https://univrs.vercel.app`.
- Link and deploy through the mainframe `vercel-account.ps1` helper with the owning profile and team. Do not create another `lore` project under a different profile.
- **CLI 58.x gotcha (2026-08-12):** the auto-updated Vercel CLI rejects the old `.vercel/repo.json` link format (errors `Root Directory must be a relative path` on deploy, and `--cwd <abs-path>` is no longer accepted). `.vercel/project.json` must hold the project/org IDs and deploys must run from the repo directory: `vercel-account.ps1 run <profile-email> -- deploy --prod --yes --force` (no `--cwd`, no path arg).
- Preserve the existing `FahadBinHussain/lore` GitHub connection and project environment configuration.
- Verify `/`, `/movies`, `/api/movies?page=1`, `/api/universes`, and `/api/auth/providers` before considering a production deployment complete.

## Universe timeline views (2026-08-21)

`src/app/universes/[slug]/page.tsx` renders two toggleable views via `src/components/universes/universe-timeline-view.tsx`, both using the SAME alternating `UniverseTimelineCard` UI:
- **Release order** (default): one card per collection item; tv/anime series cards carry an "Expanded airing window" `<details>` (built in `expandedTimelinesByMediaItemId`) listing that series' episodes interleaved only with releases that fall inside its airing window.
- **Mixed**: the same alternating card timeline, but every tv/anime series is expanded into individual episode cards (poster = series poster, badge = `S{season} EP {n}`, series title shown as a subtitle) and everything is interleaved by date — episodes by `airDate`, other releases by `releaseDate`. Games are NOT excluded. A series with no episode data falls back to a single release card at its `releaseDate`.

Both views are computed server-side as `UniverseTimelineCardProps[]` (`releaseItems`, `mixedItems`) and passed to the client component; the toggle is client-only state. Episode cards reuse the same card component: the watched toggle posts to `/api/tv/{id}/season/{s}/episode/{e}` (episode-level) when `seasonNumber`/`episodeNumber` props are set, otherwise to `/api/media/status` (media-level). When adding or expanding a universe, remember the release view is item-level while mixed is episode-level.

## Watch-order Q&A rule (user standing order, 2026-09-06)

The user watches in **mixed-universe order** and does **every item** (movies, episodes, one-shots, games — Sony X-Men/Spider-Man and games included). Whenever they ask "what's next / what are the next N / did we miss any", answer in **mixed order**: tv/anime series expanded to episode level, everything interleaved by date (episodes by `airDate`, other releases by `releaseDate`). Never answer from `collection_items.release_order` (that lumps whole series into blocks and hides interleaved episodes — e.g. AoS S02 starts 2014-09, long before Agent Carter/Daredevil). Verify dates from the DB (`episodes.air_date`, `media_items.release_date`) instead of memory, and cross-check `user_media_progress`/`user_episode_progress` for what is actually `completed` so nothing already-watched is re-suggested and nothing unwatched is skipped.

## Direct psql access (no VPN running)

When Proton/mihomo is NOT running, connect with `psql.exe` straight to the Neon pooler — no `socks5-fwd` relay needed (the relay is only for when the VPN hijacks routing; its upstream socks `7891` is dead without the VPN anyway, so a relay failure + `7891` closed = VPN is off, go direct).

- Password: take it from `.env.local`'s `DATABASE_URL` and **URL-decode it** (`[uri]::UnescapeDataString`). The literal in the URL may be percent-encoded (`%21` etc.) and won't match if passed raw inside a URI keyword string; pass it via `$env:PGPASSWORD` instead of embedding.
- Do NOT pass `options='endpoint=…'` when hitting the pooler hostname directly — SNI already identifies the endpoint and Neon rejects with `Inconsistent project name inferred from SNI … and project option`. The `options=endpoint=` form is only for the relay path (`host=127.0.0.1`).
- Do NOT use the psql URI form with `?…&channel_binding=require` built by string surgery — `password authentication failed` usually means the password wasn't URL-decoded, not that the endpoint is wrong.

Working invocation (2026-09-11):

```powershell
$raw=(Get-Content .env.local -Encoding UTF8 | Select-String '^DATABASE_URL=').Line
$url=$raw -replace '^DATABASE_URL=','' -replace '^"','' -replace '"$',''
$env:PGPASSWORD=[uri]::UnescapeDataString([regex]::Match($url,'://[^:]+:([^@]+)@').Groups[1].Value)
& 'C:\Users\Admin\scoop\apps\postgresql\current\bin\psql.exe' "host=<pooler-host> port=5432 user=neondb_owner dbname=neondb sslmode=require connect_timeout=20" -c "SELECT 1;"
```

Quick triage when a DB connection fails: `Test-NetConnection 127.0.0.1 -Port 7891` — false means no local proxy is up, so the failure is NOT VPN interception; use the direct path above.
