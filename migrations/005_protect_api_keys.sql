-- ============================================================================
-- Risha 360 — Migration 005: Stop API-key leakage via RLS
-- ----------------------------------------------------------------------------
-- discovery_agent_settings has an "authenticated can SELECT" policy, which (with
-- row-level security) would let ANY signed-in user read the openrouter/gemini
-- API keys directly through the anon client. RLS is row-level only, so we use
-- COLUMN-level privileges to revoke read access to just the key columns from the
-- authenticated/anon roles. The service_role (used by all server routes) keeps
-- full access, and the /api/agent route already masks keys. No app code reads
-- these columns from the browser, so this is transparent to the UI.
-- Safe to run multiple times.
-- ============================================================================

REVOKE SELECT (openrouter_api_key, gemini_api_key)
  ON discovery_agent_settings FROM authenticated;

REVOKE SELECT (openrouter_api_key, gemini_api_key)
  ON discovery_agent_settings FROM anon;

-- NOTE: after this, a client doing `select *` on discovery_agent_settings as an
-- authenticated user will get a permission error on those two columns. The app
-- never does that (it reads settings server-side via service_role), so the UI is
-- unaffected. If you add more secret columns later, REVOKE them here too.
