# Risha 360 — Documentation

All project documentation lives in this folder.

| File | What's inside |
|---|---|
| **[HANDOVER.md](HANDOVER.md)** | Start here. Full handover: what the project is, tech stack, architecture & data flow, project structure, **how to run**, environment variables, services, auth model, known limitations, and a first-day checklist. |
| **[API.md](API.md)** | Complete HTTP API reference — all 22 endpoints (path, methods, auth, inputs, outputs), every zod request schema, and the auth matrix. |
| **[DATABASE.md](DATABASE.md)** | Complete database schema — all 10 tables with columns, the 5 RPC functions, RLS policies, triggers, indexes, and the migration order. |
| **[setup-database.sql](setup-database.sql)** | **One-shot SQL** to build the entire database. Paste into the Supabase SQL Editor and Run — it creates all tables, RPCs, RLS, triggers, seeds, and applies migrations 003/004/005 in order. Idempotent (safe to re-run). |

## Quick start
1. Run **[setup-database.sql](setup-database.sql)** once in Supabase (SQL Editor → New query → paste → Run).
2. In Supabase **Auth**, disable public sign-ups (security).
3. `cp .env.example .env` and fill the values (see [HANDOVER.md §6](HANDOVER.md)).
4. `bun run docker:up` → open `http://localhost:<APP_PORT>` (default we use `3009`).

Read order for a new developer: **HANDOVER.md → API.md → DATABASE.md**, then the code
(`src/lib/discovery/orchestrator.ts` → `agent-brain.ts`).
