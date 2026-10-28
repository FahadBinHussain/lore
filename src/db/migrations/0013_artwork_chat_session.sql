-- Per-thread zen session id for the artwork mini chatbot.
-- The opencode zen free lane budgets tokens PER SESSION (429 FreeUsageLimitError
-- with a ~14.5h retry-after once spent), so a single process-wide session id
-- made one busy thread exhaust the budget for every conversation on that
-- instance. Each artwork thread now owns its session; the API rotates it when
-- the budget is spent and writes the replacement back here.
ALTER TABLE "artwork_chats" ADD COLUMN IF NOT EXISTS "zen_session_id" varchar(64);
