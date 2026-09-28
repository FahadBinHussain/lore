CREATE TABLE IF NOT EXISTS "artists" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "name" varchar(500) NOT NULL,
  "image_url" text,
  "biography" text,
  "birth_year" integer,
  "death_year" integer,
  "source_url" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "artists_provider_external_idx" ON "artists" ("provider","external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "artists_provider_slug_idx" ON "artists" ("provider","slug");
CREATE INDEX IF NOT EXISTS "artists_name_idx" ON "artists" ("name");
CREATE TABLE IF NOT EXISTS "user_artist_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "artist_id" integer NOT NULL REFERENCES "artists"("id") ON DELETE CASCADE,
  "is_explored" boolean DEFAULT false NOT NULL,
  "explored_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_artist_progress_user_artist_idx" ON "user_artist_progress" ("user_id","artist_id");
CREATE INDEX IF NOT EXISTS "user_artist_progress_user_idx" ON "user_artist_progress" ("user_id");
