CREATE TYPE "public"."list_visibility" AS ENUM('public', 'private', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('movie', 'tv', 'anime', 'manga', 'game', 'book', 'comic', 'boardgame', 'soundtrack', 'podcast', 'themepark');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."watch_status" AS ENUM('not_started', 'in_progress', 'completed', 'dropped', 'on_hold');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_followers" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"followed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"release_order" integer DEFAULT 0 NOT NULL,
	"chronological_order" integer,
	"group_name" varchar(255),
	"is_required" boolean DEFAULT true NOT NULL,
	"notes" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_image" text,
	"banner_image" text,
	"created_by" integer NOT NULL,
	"visibility" "list_visibility" DEFAULT 'public' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0,
	"item_count" integer DEFAULT 0,
	"follower_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cover_image" text,
	"visibility" "list_visibility" DEFAULT 'public' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"item_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"original_title" varchar(500),
	"description" text,
	"poster_path" text,
	"backdrop_path" text,
	"release_date" date,
	"rating" numeric(3, 1),
	"vote_count" integer DEFAULT 0,
	"genres" jsonb,
	"runtime" integer,
	"page_count" integer,
	"developer" varchar(255),
	"publisher" varchar(255),
	"author" varchar(255),
	"isbn" varchar(20),
	"platforms" jsonb,
	"networks" jsonb,
	"seasons" integer,
	"total_episodes" integer,
	"status" varchar(50),
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"tagline" text,
	"popularity" numeric(10, 2),
	"additional_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "user_collection_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"collection_id" integer NOT NULL,
	"items_completed" integer DEFAULT 0 NOT NULL,
	"items_total" integer DEFAULT 0 NOT NULL,
	"progress_percentage" numeric(5, 2) DEFAULT '0',
	"is_completed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_media_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"status" "watch_status" DEFAULT 'not_started' NOT NULL,
	"current_progress" integer DEFAULT 0,
	"current_season" integer DEFAULT 1,
	"progress_percentage" numeric(5, 2) DEFAULT '0',
	"rating" integer,
	"review" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_activity_at" timestamp,
	"notes" text,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"email_verified" timestamp,
	"bio" text,
	"username" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_followers" ADD CONSTRAINT "collection_followers_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_followers" ADD CONSTRAINT "collection_followers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_collection_progress" ADD CONSTRAINT "user_collection_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_collection_progress" ADD CONSTRAINT "user_collection_progress_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_progress" ADD CONSTRAINT "user_media_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_progress" ADD CONSTRAINT "user_media_progress_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_idx" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coll_followers_idx" ON "collection_followers" USING btree ("collection_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_uniq_idx" ON "collection_items" USING btree ("collection_id","media_item_id");--> statement-breakpoint
CREATE INDEX "collections_slug_idx" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_listId_mediaItemId_idx" ON "list_items" USING btree ("list_id","media_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_items_external_source_idx" ON "media_items" USING btree ("external_id","source");--> statement-breakpoint
CREATE INDEX "media_items_mediaType_idx" ON "media_items" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "media_items_title_idx" ON "media_items" USING btree ("title");--> statement-breakpoint
CREATE INDEX "media_items_releaseDate_idx" ON "media_items" USING btree ("release_date");--> statement-breakpoint
CREATE UNIQUE INDEX "user_coll_progress_idx" ON "user_collection_progress" USING btree ("user_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_media_progress_userId_mediaItemId_idx" ON "user_media_progress" USING btree ("user_id","media_item_id");--> statement-breakpoint
CREATE INDEX "user_media_progress_userId_idx" ON "user_media_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_media_progress_status_idx" ON "user_media_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_identifier_token_idx" ON "verification_tokens" USING btree ("identifier","token");