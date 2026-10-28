-- Drop the per-thread zen session id.
-- The artwork chatbot moved off the opencode zen free lane on 2026-10-24 to the
-- intern-ai discovery endpoint, which has no session concept (a plain bearer
-- key and per-request billing). The column has no reader and no writer any
-- more, so it would only confuse the next person reading the thread table.
ALTER TABLE "artwork_chats" DROP COLUMN IF EXISTS "zen_session_id";
