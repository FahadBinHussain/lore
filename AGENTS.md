# AGENTS.md instructions for Lore

## Product Goal

Lore is a universe archive, not just a media tracker. The goal is to build lore pages for every official universe/franchise, covering all official media connected to that world.

## Universe Rules

1. A universe means the complete official franchise/world across media: movies, TV, anime, games, books, comics, shorts, soundtracks, theme parks, podcasts, board games, and other official tie-ins.
2. Universe items must stay sorted by release order unless the user explicitly asks for chronological/story order.
3. Prefer official universe/franchise names. Do not invent fan names unless clearly marked as curated/fan-defined.
4. Do not drop official items just because the site cannot track them yet. If they are official but not connected to one of our supported detail APIs, keep them as curated entries.
5. Preserve existing collection and media data. When updating database rows, only fill missing values or make the exact requested correction unless the user explicitly asks to overwrite.

## Trackable vs Curated

1. Trackable items are only the rows connected to our supported site detail APIs and routes.
2. Current API-backed mapping lives in `src/lib/media/provider-support.ts`:
   - `movie` and `tv`: `tmdb`
   - `anime`: `anilist`
   - `game`: `igdb`
   - `book`: `openlibrary`
3. Anything outside that mapping is curated, even if it has an external source/id.
4. If a new site detail API/route is added, update `provider-support.ts` first, then make the list page, detail page, API route, create flow, and progress logic use the same rule symmetrically.
5. Curated items should still appear in timelines and counts, but should not affect progress tracking.

## Universe UI

1. `/universes` cards should stay visually symmetric: stable image height, fixed title/description/progress zones, and footer pinned to the bottom.
2. Universe cards should have real descriptions and usable cover images where possible.
3. `/universes/[slug]` should feel like a lore timeline, not a plain list.
4. Show curated status clearly on non-trackable timeline items.
5. When images come from a new remote host, add that host to `next.config.ts` or use an intentional unoptimized image path.

## Data And Research

1. Research universes across all official media types, not only films.
2. Use current, concrete sources when adding or correcting universe contents.
3. Add only confirmed official items. If a title is uncertain, leave it out or mark the uncertainty before adding.
4. Keep descriptions short enough for cards but specific enough to identify the universe.
5. Do not print secrets, tokens, cookies, auth headers, or full environment values.

## Repo Workflow

1. Use `pnpm`.
2. Understand the existing route/component/API pattern before editing.
3. Keep changes scoped and symmetrical across:
   - `src/app/universes/page.tsx`
   - `src/app/universes/[slug]/page.tsx`
   - `src/app/api/universes/route.ts`
   - `src/app/api/universes/create/route.ts`
   - `src/components/universes/content.tsx`
   - `src/components/universes/create-form.tsx`
   - `src/lib/media/provider-support.ts`
4. Run `pnpm build` before saying repo/app work is done when practical.
5. `pnpm lint` may include pre-existing repo-wide issues; report whether failures are related to the change.

## Deployment

1. Use ScoopCryo for Vercel CLI account work:
   `vercel-account.ps1 run owning vercel profile <vercel args...>`
2. The production project is `lore`.
3. The production alias is `https://univrs.vercel.app`.
4. After deploying, verify the deployed URL and relevant page behavior. For auth-gated pages, state exactly what could and could not be verified without a browser session.
