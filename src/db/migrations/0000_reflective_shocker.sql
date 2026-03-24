CREATE TYPE "public"."media_type" AS ENUM('movie', 'tv', 'game', 'book');--> statement-breakpoint
CREATE TYPE "public"."watch_status" AS ENUM('not_started', 'in_progress', 'completed', 'dropped');--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"original_title" varchar(500),
	"description" text,
	"poster_path" text,
	"backdrop_path" text,
	"release_date" timestamp,
	"rating" numeric(3, 1),
	"genres" jsonb,
	"runtime" integer,
	"page_count" integer,
	"developer" varchar(255),
	"author" varchar(255),
	"additional_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universe_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"universe_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"order_index" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"notes" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cover_image" text,
	"created_by" integer NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"status" "watch_status" DEFAULT 'not_started' NOT NULL,
	"progress" integer DEFAULT 0,
	"rating" integer,
	"review" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_universe_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"universe_id" integer NOT NULL,
	"items_completed" integer DEFAULT 0 NOT NULL,
	"items_total" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "universe_items" ADD CONSTRAINT "universe_items_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_items" ADD CONSTRAINT "universe_items_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_universe_progress" ADD CONSTRAINT "user_universe_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_universe_progress" ADD CONSTRAINT "user_universe_progress_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;