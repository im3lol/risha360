# Risha 360 — Project Handover

> A practical handover for a new developer taking over the project.
> Detailed references: **[docs/API.md](docs/API.md)** · **[docs/DATABASE.md](docs/DATABASE.md)**

---

## 1. What is Risha 360?

An **autonomous Saudi creator (influencer) discovery + lead-generation system**. It finds real
Saudi influencers/celebrities/artists/athletes on Instagram (and experimentally TikTok),
scores them, stores them as sales **leads**, and routes them to sales agents — then drafts
Arabic outreach DMs that wait for human approval.

The headline capability: an **AI agent that runs on its own**, decides where to look next,
collects real verified creators using the operator's own logged-in Instagram session (via a
headless stealth browser), filters out businesses/places, and saves clean person-only leads —
all controllable from a dashboard.

---

## 2. Tech stack

| Layer | Tech |
|---|---|
| Frontend + API | **Next.js 16** (App Router, React 19), Tailwind + shadcn/ui, recharts |
| Database / Auth | **Supabase** (Postgres 17 + pgvector, Row-Level Security, Auth) |
| Build / Runtime | **Bun** (build) + **Node** (runtime), Docker multi-stage |
| Scraping services | Python: **scrapling-api**, **crawl4ai**, **instagram-agent** (Camoufox), **browser-use** |
| LLM | **OpenRouter** + **Gemini** (text planning + vision qualification), with deterministic fallbacks |
| Browser extension | Chrome/Edge MV3 (`extension/`) — operator-driven harvesting |

---

## 3. How it works (data flow)

```
            ┌─────────────── DISCOVERY (two ways) ───────────────┐
            │                                                     │
  Autonomous worker (every N min)                    Browser extension (manual)
   POST /api/agent/tick                                 operator's IG session
            │                                                     │
   runAgentTick()                                        content.js harvests
   • applyAgentConfig (DB keys→env)                      POST /api/discovery/ingest
   • chooseNextSegment()  ← agent brain                          │
   • createBatch() → name-based queries                          │
   • startBatch() → browser_session source                       │
            │                                                     │
   syncBatch() → instagram-agent /run ──────────────────┐        │
   (stealth Camoufox, verified-first top-search)         │        │
            │                                             ▼        ▼
            └────────────►  saveCandidates()  ◄──────────────────────────
                            • classifyPerson() filter (people only)
                            • scoreCandidate() (100-pt engine)
                            • RPC save_discovered_candidate → influencers + social_profiles + leads
                            • RPC route_qualified_leads_to_sales (score≥60, IG) → assign + draft DM
                            • activity_log events (live monitor)
```

**Key discovery facts (learned the hard way — June 2026):**
- Instagram **disabled** the similar-accounts graph (`/discover/chaining/` → 400) and Reels/Explore
  (`/discover/topical_explore/` → 400, `/clips/discover/` → 403). **Do not rebuild those.**
- Generic keyword top-search returns a tiny FIXED brand-heavy set. **The only reliable way to get
  diverse real creators is searching by a person's NAME.** So autonomous discovery searches a
  rotating pool of real Saudi creator names (`src/lib/discovery/saudi-creators.ts`), optionally
  expanded by Gemini, then keeps verified-first results.
- The `instagram-agent` navigates to instagram.com **once** then uses same-origin `fetch` for
  everything (top-search, profile info, feed) — navigating per-profile crashes the Firefox driver.

---

## 4. Project structure (what lives where)

```
src/
  app/
    page.tsx                 # dashboard shell (sidebar + tabs)
    api/**/route.ts          # all 22 HTTP endpoints → see docs/API.md
  components/dashboard/      # one component per tab + control panel + live monitor
    overview-tab, leads-tab, discovery-tab, outreach-tab, agent-tab,
    analytics-tab, settings-tab, agent-control-panel, live-monitor, database-setup
  lib/
    api.ts                   # client fetch wrappers (browser → /api)
    api-auth.ts              # verifyAgentSecret + requireAuthenticatedUser
    api-validation.ts        # zod schemas + badRequest/serverError helpers
    supabase.ts              # browser (anon) client
    supabase-server.ts       # server (service-role) client + hasServiceRole
    domain-types.ts          # frontend Lead/Batch types
    discovery/               # ★ THE ENGINE ★
      orchestrator.ts        # runAgentTick, createBatch, startBatch, syncBatch, chooseNextSegment
      agent-brain.ts         # decideNextAction (Plan→Act→Observe→Decide) + LLM/deterministic policy
      source.ts              # dispatcher: self_scrape | apify | browser_session
      browser-session.ts     # talks to instagram-agent /run
      self-scrape.ts         # DuckDuckGo/Bing + scrapling/crawl4ai (no login, weak)
      apify.ts               # legacy paid source
      query-planner.ts       # createIntelligentSearchPlan + buildCreatorNameQueries + Gemini names
      saudi-creators.ts      # curated rotating pool of real Saudi creator names
      is-person.ts           # classifyPerson (people-only filter, EN+AR)
      qualify.ts             # vision-model qualification (keep/reject)
      scoring.ts             # 100-point scoring + fake-follower detection
      storage.ts             # saveCandidates → RPC save_discovered_candidate
      enrichment.ts          # contact extraction via scrapling/crawl4ai/browser-use
      runtime-config.ts      # applyAgentConfig (DB-stored LLM keys/models → process.env)
      types.ts               # SearchPlan, DiscoveredCandidate, AgentSettings, etc.
scripts/discovery-worker.mjs # the always-on worker (polls /api/agent/tick)
integrations/                # the 3 Python services (scrapling-api, instagram-agent, browser-use-api)
extension/                   # Chrome/Edge MV3 extension (manual harvesting)
migrations/                  # 003, 004, 005 (run AFTER supabase-migration.sql)
supabase-migration.sql       # base schema (10 tables, RPCs, RLS) → see docs/DATABASE.md
docker-compose.yml           # full stack
Dockerfile                   # app (bun build → node runner) + worker target
```

---

## 5. How to run

The app is **Dockerized** and self-restarting (`restart: unless-stopped`). Host port is `APP_PORT`
(set to `3009` in `.env` because `3000` is taken by another local project on this machine).

```bash
# 1) Configure
cp .env.example .env        # then fill in the values (see §6)

# 2) Run migrations (once) in the Supabase SQL Editor, in order:
#    supabase-migration.sql → migrations/003 → 004 → 005

# 3) Start the whole stack
bun run docker:up           # = docker compose up -d --build
#    add the stealth IG agent:  docker compose --profile browser-agent up -d

# 4) Open the dashboard
#    http://localhost:3009   (or whatever APP_PORT is)

bun run docker:logs         # follow logs
bun run docker:down         # stop everything
```

**Local dev (no Docker):** `bun install` → `bun run dev` (port 3000) + `bun run agent` (worker).
`bun run typecheck` and `bun run lint` must both pass (CI gate).

**Keep it running across reboots:** enable Docker Desktop → Settings → *Start when you sign in*;
the containers auto-start and the worker resumes.

### Services (docker-compose)

| Service | Purpose | Internal port | Profile |
|---|---|---|---|
| `app` | Next.js dashboard + API | 3000 (→ `APP_PORT` on host) | default |
| `worker` | calls `POST /api/agent/tick` on a loop | — | default |
| `scrapling` | HTML extraction (self_scrape source) | 8011 | default |
| `crawl4ai` | deep crawl / enrichment | 11235 | default |
| `instagram-agent` | **stealth Camoufox** (browser_session source) | 8013 | `browser-agent` |
| `browser-use` | optional agent for complex pages | 8012 | `browser-use` |

---

## 6. Environment variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (also used in browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser auth, RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** god key — all server writes use this |
| `AGENT_CRON_SECRET` | shared secret for machine endpoints (`x-agent-secret` header) |
| `AGENT_BASE_URL` | worker → app base URL (Docker: `http://app:3000`) |
| `APP_PORT` | host port for the app container (we use `3009`) |
| `DISCOVERY_SOURCE` | `browser_session` (recommended) \| `self_scrape` \| `apify` |
| `INSTAGRAM_AGENT_URL` | URL of the stealth agent (`http://instagram-agent:8013`) |
| `IG_COOKIES` / `IG_STORAGE_STATE` | the operator's IG session for the stealth agent |
| `IG_PROXY` | optional residential/mobile proxy (recommended for stability) |
| `IG_MAX_PROFILES` / `IG_MIN_DELAY` / `IG_MAX_DELAY` | agent pacing/volume |
| `PLANNER_PROVIDER` | `auto` \| `openrouter` \| `gemini` |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_VISION_MODEL` | text + vision LLM |
| `GEMINI_API_KEY` / `GEMINI_DISCOVERY_MODEL` | Gemini planning / creator-name generation |
| `AGENT_MAX_ROUNDS` / `AGENT_LOW_YIELD` / `AGENT_STALL_ROUNDS` / `AGENT_MIN_FOLLOWER_FLOOR` | agent-brain tunables |
| `SCRAPLING_SERVICE_URL` / `CRAWL4AI_BASE_URL` / `BROWSER_USE_SERVICE_URL` | self-hosted scraper URLs |
| `APIFY_TOKEN` / `APIFY_*_SEARCH_ACTOR` | legacy paid source (only if `DISCOVERY_SOURCE=apify`) |

> **LLM keys can also be set from the dashboard** (Settings → Agent Control Panel). Those are
> stored in `discovery_agent_settings` and override `.env` at runtime via `applyAgentConfig()`.
> The keys are never returned to the browser (API masks them; migration 005 REVOKEs the columns).

---

## 7. Auth model (important)

Two mechanisms (`src/lib/api-auth.ts`):
1. **User auth** — `Authorization: Bearer <supabase-access-token>` → `requireAuthenticatedUser`.
   Used by all dashboard endpoints.
2. **Agent secret** — header `x-agent-secret: <AGENT_CRON_SECRET>` → `verifyAgentSecret`.
   Used by machine endpoints (worker tick, extension ingest/known/qualify/plan/decide).

**RLS:** `authenticated` = read-only (and cannot read the API-key columns); `service_role` = full
read/write (all server routes); `anon` = no access. All writes go through the service-role client.
Full matrix + per-endpoint auth in **[docs/API.md](docs/API.md)**.

---

## 8. Database

10 tables, 5 RPCs, RLS on everything. The natural dedup key is
`social_profiles (platform, platform_username)`. The safe write path is the RPC
`save_discovered_candidate`. Score thresholds are hard-coded in the RPCs: **≥60 = qualified,
≥80 = critical**; routing to sales requires score ≥60 AND platform=instagram.
Full schema, columns, RPCs, RLS, triggers, indexes in **[docs/DATABASE.md](docs/DATABASE.md)**.

**Migration order:** `supabase-migration.sql` (base) → `003` (scoring persistence) →
`004` (dashboard control columns) → `005` (API-key column REVOKE). `/api/migrate` is a disabled
410 stub — migrations are run manually in the Supabase SQL Editor.

---

## 9. Known limitations / pending owner actions

- **Owner-only setup:** run migrations 003/004/005, **disable public signup** in Supabase Auth
  (otherwise any signed-up user can read all leads), and (optionally) add a free Gemini key.
- **Instagram lockdown:** no similar-accounts graph, no Reels/Explore — discovery relies on
  name-based search; for unlimited fresh names, set a Gemini key.
- **TikTok** server-side is experimental (anti-bot).
- **Account risk:** the stealth agent uses a real IG session 24/7 — prefer a secondary account + proxy.
- **`reesha/`** is an old superseded backend (gitignored); the live system is this Next.js app.

---

## 10. First-day checklist for the new dev

1. `cp .env.example .env`, fill Supabase + `AGENT_CRON_SECRET`.
2. Run the 4 SQL files in order in Supabase.
3. `bun install` → `bun run typecheck && bun run lint` (should pass).
4. `bun run docker:up` (+ `--profile browser-agent`) → open `http://localhost:APP_PORT`.
5. Read `src/lib/discovery/orchestrator.ts` then `agent-brain.ts` — that's the heart.
6. Skim `docs/API.md` + `docs/DATABASE.md`.
