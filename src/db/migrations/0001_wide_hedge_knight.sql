CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"episode_number" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"overview" text,
	"still_path" text,
	"air_date" date,
	"runtime" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_item_id" integer NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"season_number" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"overview" text,
	"poster_path" text,
	"episode_count" integer NOT NULL,
	"air_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_episode_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"episode_id" integer NOT NULL,
	"is_watched" boolean DEFAULT false NOT NULL,
	"watched_at" timestamp,
	"rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_external_source_idx" ON "episodes" USING btree ("external_id","source");--> statement-breakpoint
CREATE INDEX "episodes_seasonId_idx" ON "episodes" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "episodes_episodeNumber_idx" ON "episodes" USING btree ("episode_number");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_external_source_idx" ON "seasons" USING btree ("external_id","source");--> statement-breakpoint
CREATE INDEX "seasons_mediaItemId_idx" ON "seasons" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "seasons_seasonNumber_idx" ON "seasons" USING btree ("season_number");--> statement-breakpoint
CREATE UNIQUE INDEX "user_episode_progress_userId_episodeId_idx" ON "user_episode_progress" USING btree ("user_id","episode_id");--> statement-breakpoint
CREATE INDEX "user_episode_progress_userId_idx" ON "user_episode_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_episode_progress_isWatched_idx" ON "user_episode_progress" USING btree ("is_watched");