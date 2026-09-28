CREATE TABLE IF NOT EXISTS "user_artwork_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "artwork_id" integer NOT NULL REFERENCES "artworks"("id") ON DELETE CASCADE,
  "is_explored" boolean DEFAULT false NOT NULL,
  "explored_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_artwork_progress_user_artwork_idx" ON "user_artwork_progress" ("user_id","artwork_id");
CREATE INDEX IF NOT EXISTS "user_artwork_progress_user_idx" ON "user_artwork_progress" ("user_id");
ALTER TABLE "user_artist_progress" ADD COLUMN IF NOT EXISTS "is_auto" boolean DEFAULT false NOT NULL;
