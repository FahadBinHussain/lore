CREATE TABLE IF NOT EXISTS "artworks" (
  "id" serial PRIMARY KEY NOT NULL,
  "artist_id" integer NOT NULL REFERENCES "artists"("id") ON DELETE CASCADE,
  "provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "title" varchar(1000) NOT NULL,
  "year" integer,
  "width" integer,
  "height" integer,
  "image_url" text,
  "painting_url" text,
  "metadata" jsonb,
  "seed_rev" varchar(50),
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "artworks_provider_external_idx" ON "artworks" ("provider","external_id");
CREATE INDEX IF NOT EXISTS "artworks_artist_idx" ON "artworks" ("artist_id");
CREATE INDEX IF NOT EXISTS "artworks_title_idx" ON "artworks" ("title");
