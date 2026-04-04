# Lore

Lore is a multi-source media tracker built with Next.js App Router. It lets users discover, track, and manage progress across movies, TV, anime, games, books, comics, board games, soundtracks, podcasts, and theme parks.

## What is in this codebase right now

- Public browsing pages for all supported media categories.
- Authenticated dashboard pages for personal tracking by category.
- Trakt JSON import support for both:
  - `watched-movies.json`
  - `watched-history.json`
- Episode-level import logic for Japanese animation:
  - Shows an indicator before import.
  - Routes those episodes to Anime tracking instead of TV.
- Role system with `user` and `admin`.
- Admin-gated universe creation (`/universes/create`).
- DaisyUI theme support with all themes enabled and a navbar theme dropdown.
- Responsive homepage with a scroll-sequence hero background.

## Media categories and data sources

| Category | Primary source |
| --- | --- |
| Movies | TMDB |
| TV Shows | TMDB |
| Anime | AniList |
| Games | IGDB |
| Books | Open Library |
| Comics | Comic Vine |
| Board Games | BoardGameGeek |
| Soundtracks | MusicBrainz |
| Podcasts | Listen Notes |
| Theme Parks | Themeparks.wiki |

## Tech stack

- Next.js `16.2.1` (App Router, Turbopack)
- React `19`
- TypeScript
- Tailwind CSS `v4`
- DaisyUI `v5` (all themes enabled)
- NextAuth `v5 beta` with Google OAuth
- Drizzle ORM + PostgreSQL (Neon HTTP driver)
- `@base-ui/react` + shadcn-style components

## Requirements

- Node.js 20+
- pnpm
- PostgreSQL database
- API credentials for the providers you plan to use

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file in the project root.

3. Add environment variables (see table below).

4. Run database steps:

```bash
pnpm db:generate
pnpm db:migrate
```

5. Start development server:

```bash
pnpm dev
```

6. Open:

```text
http://localhost:3000
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_URL` | Recommended | Preferred app/auth base URL |
| `AUTH_SECRET` | Yes | NextAuth secret |
| `NEXTAUTH_URL` | Optional | Fallback URL (compatibility) |
| `NEXTAUTH_SECRET` | Optional | Fallback secret (compatibility) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `TMDB_API_KEY` | Yes | Movies/TV API |
| `IGDB_CLIENT_ID` | Yes (for games) | IGDB client ID |
| `IGDB_CLIENT_SECRET` | Yes (for games) | IGDB client secret |
| `COMICVINE_API_KEY` | Yes (for comics) | Comic Vine API key |
| `LISTEN_NOTES_API_KEY` | Yes (for podcasts) | Listen Notes API key |
| `BGG_API_KEY` | Optional | BoardGameGeek API key (depends on your access needs) |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start local development server |
| `pnpm build` | Create production build |
| `pnpm start` | Run production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate Drizzle artifacts from schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Roles and permissions

Current roles in schema:

- `user`
- `admin`

Current admin-only capability:

- Access to universe creation page and API (`/universes/create`, `/api/universes/create`).

Additional behavior currently implemented:

- TV detail pages detect Japanese animation and guide users to Anime pages.
- Admins can still access those TV pages while keeping the Japanese animation guidance visible.

## Trakt import support

Import is available from dashboard:

- `Import Watched Movies` for Trakt `watched-movies.json`
- `Import Watched History` for Trakt `watched-history.json`

Import flow currently:

- Parses and normalizes JSON input.
- Deduplicates watched-history items by latest watch event.
- Checks existing DB status before import.
- Shows already-watched items as excluded.
- Flags JP animation episodes and imports them into Anime tracking.

## Project structure

```text
src/
  app/
    api/                    # Route handlers for media, search, auth, imports, universes
    dashboard/              # Authenticated dashboard pages by media type
    movies/ tv/ anime/ ...  # Public browsing and detail pages
    layout.tsx              # Global layout, providers, theme bootstrap script
    page.tsx                # Homepage
  components/
    dashboard/              # Dashboard widgets and import modal
    media/                  # Shared media list/detail components
    home/                   # Homepage visuals (including scroll sequence)
    navbar.tsx              # Main navigation + theme dropdown + user menu
    ui/                     # Shared UI primitives
  db/
    schema.ts               # Drizzle schema (users, media, progress, universes, etc.)
    migrations/
  lib/
    api/                    # External provider clients
    auth.ts                 # NextAuth configuration
    auth/roles.ts           # Role helpers
```

## Notes

- This repo currently depends on remote Google Fonts at build time (`next/font/google` and a head stylesheet link). In restricted network environments, `pnpm build` can fail until font fetching is reachable or fonts are made local.
- There is no `.env.example` file at the moment; use the variable table above to build your `.env`.

## License

MIT. See `LICENSE`.
