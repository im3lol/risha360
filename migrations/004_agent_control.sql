-- ============================================================================
-- Risha 360 — Migration 004: Full dashboard control for the discovery agent
-- ----------------------------------------------------------------------------
-- Adds the columns that let the user control EVERYTHING from the dashboard:
--   follower bounds, country, custom data instructions, and per-provider LLM
--   API keys + model names (so models can be added without editing .env).
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE discovery_agent_settings
  ADD COLUMN IF NOT EXISTS max_followers        INTEGER,                    -- NULL = no upper bound
  ADD COLUMN IF NOT EXISTS country               VARCHAR(8)  DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS custom_instructions   TEXT,                       -- free-text "what data I want"
  ADD COLUMN IF NOT EXISTS planner_provider      VARCHAR(16) DEFAULT 'auto', -- auto | openrouter | gemini
  ADD COLUMN IF NOT EXISTS openrouter_api_key    TEXT,
  ADD COLUMN IF NOT EXISTS openrouter_model      TEXT,
  ADD COLUMN IF NOT EXISTS openrouter_vision_model TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key        TEXT,
  ADD COLUMN IF NOT EXISTS gemini_model          TEXT;

-- Keys live in a service-role-only column set. Tighten if you ever add more
-- users: the existing "authenticated read" policy lets any signed-in user read
-- this row, so the API masks the key columns and never returns them to the client.
