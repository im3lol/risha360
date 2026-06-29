# Running Risha 360 on Docker

The whole system runs as Docker containers and restarts itself. This is the recommended way to run it.

---

## 1. Prerequisites

- **Docker Desktop** installed and running (Windows/Mac/Linux).
- **Bun** installed (only used for the `bun run docker:*` shortcuts — you can call `docker compose` directly instead).
- A configured **`.env`** file in the project root (`cp .env.example .env` then fill it in — see [HANDOVER.md §6](HANDOVER.md)).
- The database created once: run **[setup-database.sql](setup-database.sql)** in the Supabase SQL Editor.

---

## 2. The services (docker-compose.yml)

| Service | What it does | Internal port | Started by |
|---|---|---|---|
| `app` | Next.js dashboard + API | 3000 → host `APP_PORT` | default |
| `worker` | calls `POST /api/agent/tick` on a loop (the autonomous engine) | — | default |
| `scrapling` | HTML extraction (for `DISCOVERY_SOURCE=self_scrape`) | 8011 | default |
| `crawl4ai` | deep crawl / enrichment | 11235 | default |
| `instagram-agent` | **stealth Camoufox browser** (for `DISCOVERY_SOURCE=browser_session`) | 8013 | profile `browser-agent` |
| `browser-use` | optional agent for complex pages | 8012 | profile `browser-use` |

> `restart: unless-stopped` is set on every service, so they come back automatically after a crash or a machine reboot (as long as Docker Desktop is running).

---

## 3. Port (important on this machine)

The app container always listens on **3000 internally**, but the **host** port is `APP_PORT`
from `.env`. On this machine `3000` is taken by another project, so we use:

```
APP_PORT=3009
```

→ open the dashboard at **http://localhost:3009**. Change `APP_PORT` if 3009 is busy.

---

## 4. Start / stop

```bash
# Start the core stack (app + worker + scrapling + crawl4ai), building images:
bun run docker:up
#   (equivalent to: docker compose up -d --build)

# ALSO start the stealth Instagram agent (needed for browser_session discovery):
docker compose --profile browser-agent up -d --build

# Follow logs (all services):
bun run docker:logs
#   one service:  docker compose logs -f worker

# Check status:
docker compose ps

# Stop everything:
bun run docker:down
#   (equivalent to: docker compose down — containers stop; data in Supabase is safe)
```

> The first build downloads images + Camoufox (the stealth browser) and can take several minutes.
> Subsequent builds are cached and fast.

---

## 5. Keep it running 24/7 (survive reboots)

1. Docker Desktop → **Settings → General → ✅ "Start Docker Desktop when you sign in"**.
2. Because every service uses `restart: unless-stopped`, the containers auto-start when Docker
   starts, and the `worker` resumes the discovery loop on its own. Nothing else to do.

---

## 6. Instagram session for the stealth agent

`browser_session` discovery logs into Instagram using the operator's session. Provide it via `.env`:
- `IG_COOKIES` — a JSON array of cookies exported from a logged-in browser (Cookie-Editor → Export as JSON), **or**
- `IG_STORAGE_STATE` — path to a Playwright storage-state file (the project mounts `secrets/ig-state.json` at `/run/ig-state.json`).
- `IG_PROXY` — optional residential/mobile proxy (recommended for stability).

> Use a **secondary** Instagram account — 24/7 automation can get an account rate-limited.
> The `secrets/` folder is gitignored and never committed.

After changing IG env, recreate the agent: `docker compose --profile browser-agent up -d instagram-agent`.

---

## 7. Applying code changes

After editing app/server code, rebuild + recreate just the app:
```bash
docker compose up -d --build app
```
After editing a Python service (e.g. `integrations/instagram-agent/app.py`):
```bash
docker compose --profile browser-agent up -d --build instagram-agent
```

---

## 8. Health & troubleshooting

```bash
docker compose ps                         # STATUS column shows (healthy)
docker compose logs --tail 50 app         # app logs
docker compose logs --tail 50 worker      # worker tick results
docker compose exec app node -e "fetch('http://instagram-agent:8013/health').then(r=>r.text()).then(console.log)"
```

| Symptom | Likely cause / fix |
|---|---|
| Dashboard won't load | check `docker compose ps` → `app` healthy? wrong `APP_PORT`? |
| Saving API keys/settings errors with "migration 004" | run `docs/setup-database.sql` in Supabase, then retry |
| Login fails / no data | Supabase project paused → restore it; or migrations not run |
| `instagram-agent` `authenticated:false` | provide `IG_COOKIES`/`IG_STORAGE_STATE`, recreate the agent |
| Discovery runs but 0 results | name pool exhausted → add a free `GEMINI_API_KEY` (Settings or `.env`) for fresh names |
| Port already in use | change `APP_PORT` in `.env`, then `bun run docker:up` |

---

## 9. One-time first run (summary)

```bash
cp .env.example .env                              # 1) fill in values
# 2) run docs/setup-database.sql in Supabase SQL Editor
# 3) disable public sign-ups in Supabase Auth
bun run docker:up                                 # 4) core stack
docker compose --profile browser-agent up -d      # 5) stealth agent
# 6) open http://localhost:3009  → log in → Settings → configure the agent
```
