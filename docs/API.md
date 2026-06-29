# Risha 360 — HTTP API Reference

All routes live under `src/app/api/**/route.ts` (Next.js App Router). **22 route files.**

## Authentication

Defined in `src/lib/api-auth.ts`:

- **User auth** — `requireAuthenticatedUser(req)`: reads `Authorization: Bearer <token>`, validates
  via `supabaseServer.auth.getUser(token)`. Returns `null` (ok) or a `401` response.
- **Agent secret** — `verifyAgentSecret(req)`: constant-time compare of header `x-agent-secret`
  against `AGENT_CRON_SECRET` (falls back to `SUPABASE_SERVICE_ROLE_KEY`). Returns boolean.
- Some write routes also require `hasServiceRole` (service-role key present) and return **503** if absent.
- "**agent secret OR user**" routes try the agent secret first, then fall back to user auth.

### Auth matrix

| Endpoint | Methods | Auth |
|---|---|---|
| `/api` | GET | none (stub) |
| `/api/agent` | GET, POST | user |
| `/api/agent/tick` | POST | agent secret |
| `/api/batches` | GET, POST | user (POST also needs service role) |
| `/api/batches/[id]/run` | POST | user (+ service role) |
| `/api/batches/[id]/sync` | POST | user (+ service role) |
| `/api/discovery/activity` | GET | user |
| `/api/discovery/config` | GET | user |
| `/api/discovery/decide` | POST | agent secret OR user |
| `/api/discovery/decisions` | GET | user |
| `/api/discovery/ingest` | POST | agent secret (+ service role) |
| `/api/discovery/known` | POST | agent secret |
| `/api/discovery/plan` | POST | agent secret OR user |
| `/api/discovery/qualify` | POST | agent secret |
| `/api/leads` | GET, POST | user (POST + service role) |
| `/api/leads/[id]` | DELETE | user |
| `/api/leads/cleanup` | POST | agent secret OR user |
| `/api/migrate` | POST | none (always 410) |
| `/api/outreach` | GET, POST | user (POST + service role) |
| `/api/setup` | GET | user |
| `/api/stats` | GET | user |
| `/api/tasks` | GET, POST | user (POST + service role) |

---

## Endpoints

### `GET /api` — stub/healthcheck → `{ message: "Hello, world!" }`

### `GET /api/agent` — agent settings + provider status
Returns `{ settings: <masked>, providers: { discoverySource, discoveryReady, plannerProvider } }`.
Secret columns (`openrouter_api_key`, `gemini_api_key`) are stripped → replaced with `<col>_set: boolean`.

### `POST /api/agent` — run-now OR partial settings update (hand-validated, no zod)
- `{ "action": "run_now" }` → runs a tick immediately → `{ result }`.
- Otherwise a **partial** update (only provided keys are written):
  `enabled`(bool), `interval_minutes`(15–1440), `categories`/`cities`(CSV ≤30 items),
  `target_count`(10–1000), `min_followers`(0–50M), `max_active_batches`(1–3),
  `max_followers`(int>0 or null), `country`(≤8, default `SA`), `custom_instructions`(≤2000),
  `planner_provider`(`auto`|`openrouter`|`gemini`),
  `openrouter_model`/`openrouter_vision_model`/`gemini_model`(≤128 or null),
  `openrouter_api_key`/`gemini_api_key` (written only if non-empty). → `{ settings: <masked> }`.

### `POST /api/agent/tick` — run one autonomous tick (worker calls this)
Auth: agent secret. No input. Returns `runAgentTick()` result (e.g. `{ status, batchId?, nextRunAt? }`).

### `GET /api/batches` — list discovery batches
Returns `{ data: [{ id, name, category, city, platform, platforms[], target, found, processed,
leadsCreated, errors, status, stage, currentStep, queries[], hashtags[], providerRuns[],
providerReady, startedAt, estimatedCompletion }] }`.

### `POST /api/batches` — create a batch (+ service role)
Body (hand-coerced): `name?`, `niches?`, `location_filter?`, `min_followers?`(≥0, def 20000),
`target_count?`(1–1000, def 100), `keywords?`. → `{ data }` `201`.

### `POST /api/batches/[id]/run` — start a batch's provider runs (+ service role)
Path `id`. → `{ success, runs }`. Errors: 503 not configured, 409 already running, 502 other.

### `POST /api/batches/[id]/sync` — poll + collect + score + save a batch (+ service role)
Path `id`. → `{ data: <config>, result }`. Errors: 400 no provider runs, 502 other.

### `GET /api/discovery/activity` — live monitor feed
Query `limit` (1–100, def 30). → `{ status: { enabled, running, currentStep, activeBatch,
lastTick, nextRun, lastError }, events: [{ id, type, message, at, createdAt }] }`
(`at` = Arabic relative time).

### `GET /api/discovery/config` — provider configuration/health
→ `{ discoverySource: { active, configured }, providers: { apify, aiPlanner, scrapling, crawl4ai, browserUse } }`.

### `POST /api/discovery/decide` — agent brain: next action (agent secret OR user)
Body = **`decideSchema`** (below). → `{ action }` (one of snowball/refine_queries/broaden/switch_segment/stop).

### `GET /api/discovery/decisions` — recent agent-brain decisions
Query `limit` (1–100, def 20). → `{ data: [{ id, message, category, city, minFollowers, reason, batchId, createdAt }] }`
(from `activity_log` where `event_type='agent'`).

### `POST /api/discovery/ingest` — ingest harvested profiles (extension) (agent secret + service role)
Body = **`ingestSchema`**. → `ingestCandidates()` result.

### `POST /api/discovery/known` — which usernames are already known (agent secret)
Body = **`knownSchema`**. → `{ known: string[] }` (lowercased; filtered by `freshDays` recency, default 30).

### `POST /api/discovery/plan` — AI search plan (agent secret OR user)
Body = **`planRequestSchema`**. → `{ queries[], hashtags[], planner, rationale }`.

### `POST /api/discovery/qualify` — vision qualification (agent secret)
Body = **`qualifySchema`**. → `{ verdicts: [{ username, keep, persona, nicheMatch, confidence, reason }] }`.

### `GET /api/leads` — list leads (with filters)
Query: `priority`, `stage`, `niche`, `city`, `search`, `limit`(1–200, def 50), `offset`(0–100000, def 0).
→ `{ data: [{ id, name, handle, category, city, followers, score, scoreBreakdown, priority, stage,
email, phone, platform, bio, verified, lastActive, avatar, socialLinks[], discoveryTool,
accountCategory, engagementRate, discoveredAt, assignedAgent }], count }`.

### `POST /api/leads` — create a lead (+ service role)
Body = **`leadCreateSchema`**. Upserts influencer (on email) + inserts lead. → `{ data }` `201`.

### `DELETE /api/leads/[id]` — remove a lead + its influencer + social profiles
Path `id`. → `{ deleted: true, id, influencerId }`. 404 if not found.

### `POST /api/leads/cleanup` — remove non-person accounts (agent secret OR user)
Body `{ dryRun?: boolean }`. Scans ≤5000 profiles; deletes non-persons unless `dryRun`.
→ `{ dryRun, scanned, flagged, removed, samples: [{ influencerId, handle, reason }] }`.

### `POST /api/migrate` — disabled → always `410`.

### `GET /api/outreach` — list outreach drafts/messages
→ `{ data: [{ id, messageId, conversationId, leadId, leadName, leadHandle, category, city, score,
language, message, complianceChecks{...}, status, createdAt, platform }] }`.

### `POST /api/outreach` — outreach action (+ service role)
Body = **`outreachActionSchema`**. `approve|send|edit|reject` (need `messageId`+`conversationId`,
calls RPC `apply_outreach_action`) → `{ success, action }`. `create` (need `conversationId`+`body`)
→ `{ data }` `201`.

### `GET /api/setup` — DB readiness probe
→ `{ dbReady, influencerCount, writeReady }` or `{ dbReady:false, message, sqlEditorUrl? }`.

### `GET /api/stats` — dashboard stats
→ `{ dbReady, stats: { totalInfluencers, totalLeads, hotLeads, registeredCount, activeBatches,
respondedConversations, totalConversations, activeTasks, responseRate, funnelData[],
categoryDistribution[], recentActivity[] } }`.

### `GET /api/tasks` — list agent tasks (latest 50)
→ `{ data: [{ id, taskType, agent, status, priority, created, duration, details, error? }] }`.

### `POST /api/tasks` — create an agent task (+ service role)
Body = **`taskCreateSchema`**. → `{ data }` `201`.

---

## zod request schemas (`src/lib/api-validation.ts`)

Helpers: `badRequest(zodError)` → `400 { error }`; `serverError(err, ctx)` → logs + `500 { error: 'Internal server error' }`.

- **`leadCreateSchema`**: `name`(1–200, req), `email`(email ≤320 opt/`''`), `phone`(≤40), `city`(≤100), `category`(≤100), `bio`(≤2000), `source`(≤100).
- **`taskCreateSchema`**: `agent_type`(≤64), `task_name`(≤200), `priority`(int 0–10), `input_data`(unknown).
- **`qualifySchema`**: `niche`(≤120); `profiles`[1..12] of `{ username`(1–100, req)`, fullName`(≤200)`, bio`(≤3000)`, category`(≤200)`, followers`(int≥0)`, engagementRate`(≥0 nullish)`, captions`(≤12×≤600)`, images`(≤4×≤500000, http/data URL) `}`.
- **`knownSchema`**: `usernames`[1..300] (≤100 each); `freshDays`(int 0–365, 0 = always known).
- **`decideSchema`**: `goal{ targetCount`(1–5000)`, minFollowers`(≥0)`, platform`(`instagram|tiktok`)`, personas?`(≤12×≤40) `}`, `segment{ category`(≤100)`, city`(≤100) `}`, `totals{ kept, seen, rounds`(int≥0) `}`, `history`(≤50 × `{ action`(≤40)`, kept, seen, duplicates }`)`, frontier{ queries`(≤60×≤120)`, seedAccounts`(≤60×≤100) `}`, `topAccounts`(≤60 × `{ username, followers, score?, persona? }`)`, exhaustedSegments?`(≤100)`, candidateSegments?`(≤60 × `{category, city}`).
- **`planRequestSchema`**: `category`(≤100, def `Other`), `city`(≤100, def `All`), `minFollowers`(int≥0), `targetCount`(1–200), `extraKeywords`(≤500).
- **`ingestSchema`**: `platform`(`instagram|tiktok`, def instagram), `category`(def `Other`), `city`(def `All`), `minFollowers`, `candidates`[1..200] of `ingestProfileSchema` (`username` req + `full_name, biography, followers, following, posts, is_verified, is_private, is_business, category, website, profile_pic_url, email, avg_likes, avg_comments, engagement_rate, posts_sampled, persona, qualify_reason`).
- **`outreachActionSchema`**: `action`(`approve|send|edit|reject|create`, req), `conversationId?`(≤64), `messageId?`(≤64), `body?`(≤5000), `feedback?`(≤2000), `complianceChecks?`(unknown).

---

## Notes
- `/api/migrate` is a permanent 410 — run `supabase-migration.sql` + `migrations/*` manually.
- Hand-validated (no zod): `POST /api/agent`, `POST /api/batches`, `POST /api/leads/cleanup`.
- Machine endpoints used by the worker/extension: `agent/tick`, `discovery/{ingest,known,plan,qualify,decide}`.
