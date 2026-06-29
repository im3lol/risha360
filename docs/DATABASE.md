# Risha 360 — Database Schema

PostgreSQL on Supabase. Extensions: `uuid-ossp` (UUID PKs), `vector` (pgvector, for
`influencers.embedding`). All `id` are `UUID DEFAULT uuid_generate_v4()`; most tables have
`created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

**Run order:** `supabase-migration.sql` (base) → `migrations/003` → `004` → `005`.

---

## Tables (10)

### `influencers` — master record per creator (platform-agnostic, one per person)
Identity: `display_name`(NOT NULL), `real_name, bio, profile_image_url, email, phone, website,
country`(def `'SAU'`)`, city, nationality, language_codes, gender, age_range`. Niche:
`primary_niche, secondary_niches, content_languages, content_style`. Scores (FLOAT): `total_score,
followers_score, engagement_score, saudi_relevance_score, commercial_value_score,
contact_availability_score, brand_safety_score, signup_probability_score, total_followers,
avg_engagement_rate`. Status: `status`(def `'discovered'`)`, discovery_source, discovered_by_agent,
is_brand_safe`(def TRUE)`, brand_safety_flags`. AI: `embedding vector(1536)`.
Indexes: `(country,status)`, `(total_score)`, `(primary_niche)`, `(status,created_at)`, `(email)`.

### `social_profiles` — per-platform account belonging to an influencer
`influencer_id`(FK→influencers ON DELETE CASCADE)`, platform`(NOT NULL)`, platform_username`(NOT NULL)`,
platform_display_name, platform_user_id, profile_url, profile_image_url, is_verified, is_business_account,
followers_count, following_count, posts_count, avg_likes, avg_comments, avg_shares, avg_views,
engagement_rate, content_frequency, top_hashtags, content_categories, recent_caption, bio, bio_links,
contact_email, contact_phone, has_contact_button, source_tool`(def `'manual'`)`, fetched_by_agent,
source_url, source_metadata`(TEXT/JSON)`, fetched_at, last_synced_at, sync_count, is_data_stale,
is_active, is_fake_followers_suspected, fake_followers_percentage, data_completeness`.
**UNIQUE `(platform, platform_username)`** ← the natural dedup key. Also `(influencer_id, platform)`, `(source_tool)`, `(followers_count)`.

### `discovery_batches` — one discovery run/job
`name`(NOT NULL)`, status`(def `'pending'`)`, platforms`(NOT NULL)`, niches, keywords, hashtags,
location_filter, language_filter, min_followers, max_followers, min/max_engagement_rate, ai_query,
scraping_tools, agent_config`(TEXT/JSON — holds the plan + runs + currentStep). Counters (INT def 0):
`target_count, total_profiles_found, profiles_processed, profiles_enriched, profiles_deduplicated,
profiles_scored, leads_created, errors_count`. Timing/cost: `started_at, completed_at,
estimated_duration_minutes, api_calls_made, estimated_cost_usd, tokens_used`. Results:
`top_profiles_summary, error_log, triggered_by`(def `'manual'`)`, triggered_by_agent`.

### `discovery_agent_settings` — **singleton** row controlling the always-on agent
`singleton BOOLEAN PK CHECK(singleton)` (forces one row). `enabled`(def TRUE)`, interval_minutes`(def 120, 15–1440)`,
categories`(CSV)`, cities`(CSV)`, platforms`(CSV)`, target_count`(def 100, 10–1000)`, min_followers`(def 20000)`,
max_active_batches`(def 1, 1–3)`, last_tick_at, last_started_at, next_run_at, tick_locked_until, last_error, total_runs`.
**+ Migration 004 columns:** `max_followers`(int, NULL=no cap)`, country`(def `'SA'`)`, custom_instructions`(TEXT)`,
planner_provider`(def `'auto'`)`, openrouter_api_key`🔒`, openrouter_model, openrouter_vision_model,
gemini_api_key`🔒`, gemini_model`. 🔒 = secret (see §RLS / migration 005).

### `sales_agents` — roster for round-robin lead assignment
`agent_code`(UNIQUE)`, display_name, active`(def TRUE)`, round_robin_order, max_active_leads`(def 100).
Seeded: `instagram-sales-01/02/03`.

### `leads` — a qualified influencer in the sales pipeline
`influencer_id`(FK→influencers CASCADE)`, priority`(def `'medium'`)`, source`(def `'ai_discovery'`)`, stage`(def `'new'`)`,
score, score_breakdown, score_calculated_at, outreach_status`(def `'new'`)`, outreach_attempts, last_outreach_at,
next_follow_up_at, responded_at, response_sentiment, response_summary, assigned_to, assigned_agent,
discovery_batch_id`(FK→discovery_batches SET NULL)`, discovery_query, discovery_metadata, tags, notes,
internal_rating, estimated_value, conversion_probability, closed_at, close_reason`.
Indexes: `(priority,stage)`, `(source)`, `(score)`, `(influencer_id)`, `(outreach_status)`, `(stage,created_at)`.

### `conversations` — an outreach thread (one per lead+channel)
`influencer_id`(FK CASCADE)`, lead_id`(FK SET NULL)`, channel`(NOT NULL)`, status`(def `'active'`)`,
outreach_state`(def `'new'`)`, previous_state, state_changed_at, state_change_reason, message_count,
last_message_at, last_message_direction, first_response_at, response_time_hours, is_responded,
ai_generated_draft, ai_draft_model, ai_draft_prompt_version, overall_sentiment, sentiment_score, assigned_to`.
**Partial UNIQUE `(lead_id, channel) WHERE lead_id IS NOT NULL`**.

### `messages` — a single message in a conversation
`conversation_id`(FK CASCADE)`, direction`(NOT NULL)`, status`(def `'draft'`)`, subject, body`(NOT NULL)`,
body_html, is_ai_generated, ai_model, ai_prompt_template, human_edited, compliance_checks, sent_at,
delivered_at, read_at, failed_reason, sentiment, sentiment_score, intent_detected`.

### `agent_tasks` — work-queue / audit for any agent task
`agent_type`(NOT NULL)`, task_name`(NOT NULL)`, status`(def `'pending'`)`, input_data, config,
influencer_id, lead_id, discovery_batch_id, conversation_id` (UUID, **no FK**)`, progress, current_step,
total_steps, completed_steps, output_data, error_message, error_traceback, started_at, completed_at,
duration_seconds, retry_count, max_retries`(def 3)`, next_retry_at, api_calls_made, tokens_used,
estimated_cost_usd, priority`(def 5)`, scheduled_at`. Indexes: `(agent_type,status)`, `(status,priority)`, `(created_at)`.

### `activity_log` — append-only event feed (powers the live monitor)
`event_type`(NOT NULL)`, message`(NOT NULL)`, entity_type, entity_id`(UUID)`, metadata`(TEXT)`, created_at`.
No `updated_at`. Indexes: `(event_type)`, `(created_at DESC)`.

---

## Functions / RPCs

All `plpgsql`, `SECURITY INVOKER`, locked to `service_role` (REVOKE from public/anon/authenticated).

| Function | Args | Returns | What it does |
|---|---|---|---|
| `claim_discovery_agent_tick` | `p_lock_seconds INT DEFAULT 900` | BOOLEAN | Lease-lock: sets `tick_locked_until = NOW()+clamp(60..1800)s` only if free/expired; TRUE if claimed. Prevents concurrent ticks. |
| `save_discovered_candidate` | `p_batch_id UUID, p_candidate JSONB, p_plan JSONB, p_score JSONB` | TEXT (`created`/`updated`) | Idempotent write path: upsert `social_profiles` (by lower(username)+platform), insert/update `influencers` with full score breakdown, create a `leads` row for the batch if absent. **Use the migration-003 version** (persists engagement/brand-safety/fake-follower signals). |
| `route_qualified_leads_to_sales` | `p_batch_id UUID` | INT (count) | For each unassigned IG lead in the batch with `score≥60`, assign least-loaded active sales agent, set lead to `outreach_queued`, upsert a `dm_instagram` conversation, insert an Arabic invitation draft `message` (+ compliance JSON), log `agent_tasks` + `activity_log`. |
| `apply_outreach_action` | `p_action, p_conversation_id, p_message_id, p_message_body?, p_feedback?` | VOID | Atomic outreach transition (`approve`/`send`/`edit`/`reject`) on messages + conversations (+ leads on send). |
| `update_updated_at_column` | — | TRIGGER | Sets `NEW.updated_at = NOW()` (only fn granted to PUBLIC). |

**Score thresholds (hard-coded in RPCs):** ≥60 = qualified/high, ≥80 = critical; routing needs ≥60 AND platform=instagram.

---

## RLS, triggers, realtime

- **RLS enabled on all 10 tables.** `authenticated` = SELECT only (`auth.uid() IS NOT NULL`); **no
  INSERT/UPDATE/DELETE policies** → writes blocked for authenticated/anon. `service_role` bypasses RLS
  (all server writes). `anon` = no access.
- **Migration 005 column REVOKE:** `SELECT (openrouter_api_key, gemini_api_key)` REVOKEd from
  `authenticated` + `anon` on `discovery_agent_settings` → signed-in users can't read the key columns
  (service_role still can; the `/api/agent` route masks them).
- **Triggers:** `update_<table>_updated_at` on 9 tables (all except append-only `activity_log`).
- **No Postgres ENUMs** — enumerated values are VARCHAR enforced in app code. CHECK constraints only on
  `discovery_agent_settings`.
- **Realtime publication** (`supabase_realtime`): influencers, leads, discovery_batches, conversations,
  agent_tasks, activity_log.

---

## Cheat sheet for a new dev
- **Dedup** = `social_profiles (platform, platform_username)` unique index.
- **Safe write** = call RPC `save_discovered_candidate` (don't hand-insert).
- **The agent is a singleton** (`discovery_agent_settings`, one row) guarded by `claim_discovery_agent_tick`.
- **Only `service_role` writes**; the browser is read-only and blind to API-key columns.
