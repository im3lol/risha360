# Risha 360

Autonomous Saudi creator (influencer) discovery + lead-generation system.
Next.js 16 + Supabase + Dockerized scraping services + an adaptive AI discovery agent.

## 📚 Documentation

**All documentation is in the [`docs/`](docs/) folder** — start with **[docs/HANDOVER.md](docs/HANDOVER.md)**.

| | |
|---|---|
| [docs/HANDOVER.md](docs/HANDOVER.md) | Full handover: architecture, how to run, env vars, services, auth, limitations |
| [docs/API.md](docs/API.md) | Every HTTP endpoint + request schemas + auth matrix |
| [docs/DATABASE.md](docs/DATABASE.md) | Full DB schema: tables, RPCs, RLS, triggers |
| [docs/setup-database.sql](docs/setup-database.sql) | One-shot SQL to build the entire database |

## Quick start
```bash
# 1) Build the database: paste docs/setup-database.sql into the Supabase SQL Editor and Run.
# 2) Configure
cp .env.example .env        # fill in the values (see docs/HANDOVER.md §6)
# 3) Run the full stack (app + worker + scraping services)
bun run docker:up           # then add the stealth IG agent:
docker compose --profile browser-agent up -d
# 4) Open the dashboard
#    http://localhost:<APP_PORT>   (default APP_PORT=3009)
```

Local dev: `bun install && bun run dev` (port 3000) + `bun run agent` (worker).
