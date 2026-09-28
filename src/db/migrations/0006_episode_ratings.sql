-- Episode ratings: TMDB vote_average / vote_count per episode.
-- Mirrors media_items.rating; the episodes table previously had no rating
-- column at all, so episode-level scores were only ever visible via the
-- live TMDB season/episode API responses and never persisted.
ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "rating" numeric(3,1);
ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "vote_count" integer;
