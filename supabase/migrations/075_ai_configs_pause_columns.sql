-- Bring ai_configs up to the consolidated schema: the auto-reply pause
-- columns were introduced after this database's ai_configs was created.

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS auto_reply_pause_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (auto_reply_pause_mode IN ('manual', 'timed')),
  ADD COLUMN IF NOT EXISTS auto_reply_pause_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (auto_reply_pause_minutes BETWEEN 1 AND 10080);
