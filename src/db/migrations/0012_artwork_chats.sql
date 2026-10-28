-- Persisted per-user artwork conversations for the artist-page mini chatbot.
-- One thread per (user, artwork): reopening a work resumes the same chat.
CREATE TABLE IF NOT EXISTS "artwork_chats" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "artwork_id" integer NOT NULL REFERENCES "artworks"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_chats_user_artwork_idx" ON "artwork_chats" ("user_id","artwork_id");
CREATE INDEX IF NOT EXISTS "artwork_chats_user_idx" ON "artwork_chats" ("user_id");

CREATE TABLE IF NOT EXISTS "artwork_chat_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "chat_id" integer NOT NULL REFERENCES "artwork_chats"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "model" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "artwork_chat_messages_chat_idx" ON "artwork_chat_messages" ("chat_id","created_at");
