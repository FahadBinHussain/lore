ALTER TABLE "artists" ADD COLUMN IF NOT EXISTS "seed_rev" varchar(50);
ALTER TABLE "artists" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp;
ALTER TABLE "artists" ADD COLUMN IF NOT EXISTS "artwork_count" integer;
CREATE INDEX IF NOT EXISTS "artists_last_synced_idx" ON "artists" ("last_synced_at");
