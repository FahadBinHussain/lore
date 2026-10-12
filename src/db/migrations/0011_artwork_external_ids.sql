-- Multi-source backing for artworks (design principle: one artwork row per real-world piece,
-- every catalog holding it gets a row in artwork_external_ids; mirrors media_external_ids).
CREATE TABLE IF NOT EXISTS "artwork_external_ids" (
  "id" serial PRIMARY KEY NOT NULL,
  "artwork_id" integer NOT NULL REFERENCES "artworks"("id") ON DELETE CASCADE,
  "provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "source_url" text,
  "image_url" text,
  "title" varchar(1000),
  "confidence" integer DEFAULT 100 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "last_synced_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_external_ids_provider_external_idx" ON "artwork_external_ids" ("provider","external_id");
CREATE INDEX IF NOT EXISTS "artwork_external_ids_artworkId_idx" ON "artwork_external_ids" ("artwork_id");
CREATE INDEX IF NOT EXISTS "artwork_external_ids_provider_idx" ON "artwork_external_ids" ("provider");
-- Backfill: every existing artwork's own (provider, external_id) becomes its primary source row.
INSERT INTO "artwork_external_ids" ("artwork_id","provider","external_id","source_url","image_url","title","confidence","is_primary","last_synced_at","created_at","updated_at")
SELECT "id","provider","external_id","painting_url","image_url","title",100,true,"last_synced_at",now(),now()
FROM "artworks"
ON CONFLICT ("provider","external_id") DO NOTHING;
