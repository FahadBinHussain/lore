CREATE TABLE "media_external_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_item_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"media_type" "media_type" NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"source_url" text,
	"confidence" integer DEFAULT 100 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "media_items_external_source_idx";--> statement-breakpoint
ALTER TABLE "media_external_ids" ADD CONSTRAINT "media_external_ids_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "media_external_ids" (
	"media_item_id",
	"provider",
	"media_type",
	"external_id",
	"confidence",
	"is_primary",
	"last_synced_at",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"source",
	"media_type",
	"external_id",
	100,
	true,
	"updated_at",
	now(),
	now()
FROM "media_items";--> statement-breakpoint
CREATE UNIQUE INDEX "media_external_ids_provider_type_external_idx" ON "media_external_ids" USING btree ("provider","media_type","external_id");--> statement-breakpoint
CREATE INDEX "media_external_ids_mediaItemId_idx" ON "media_external_ids" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "media_external_ids_provider_idx" ON "media_external_ids" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "media_items_source_type_external_idx" ON "media_items" USING btree ("source","media_type","external_id");
