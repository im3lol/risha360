# Reesha Creator Discovery Engine

The Discovery module is a search-first acquisition pipeline. Users define a market
brief; they do not provide profile URLs.

## Runtime flow

1. Create a batch with category, city, target count, and minimum followers.
2. The OpenAI planner expands the brief into structured Arabic and English
   search queries. A deterministic planner is used automatically if OpenAI is
   unavailable so the pipeline remains operable.
3. The server searches Instagram only and collects public profile URLs.
4. Scrapling, Crawl4AI, and Browser-use visit those profile URLs in fallback order.
5. Extracted profile data is normalized, deduplicated, scored, and persisted.
6. Qualified leads are assigned to the least-loaded active sales agent.
7. The sales workflow creates an Arabic invitation draft linking to
   `https://risha360.com`.
8. A human reviews the draft before the Instagram outreach is marked as sent.
9. Replies and registrations advance the lead through the acquisition funnel.

## Always-on agent

The autonomous agent stores its schedule and operating state in
`discovery_agent_settings`. Every tick:

1. Claims an atomic database lock to prevent overlapping runs.
2. Synchronizes active provider batches.
3. Rotates through the configured categories and cities.
4. Creates an AI search plan and starts a provider run when the schedule is due.
5. Records the last check, next run, errors, and completed cycle count.

Run the local worker alongside the application:

```powershell
npm run agent
```

The worker calls `/api/agent/tick` every minute. In production, call the same
endpoint from a scheduler and send `AGENT_CRON_SECRET` in the
`x-agent-secret` header.

## Extraction architecture

The provider layers have different jobs and must not be treated as interchangeable:

| Layer | Tool | Decision | Responsibility |
| --- | --- | --- | --- |
| Search | Apify | Active | Discover profile URLs from Arabic and English queries. |
| Structured extraction | [Scrapling](https://github.com/D4Vinci/Scrapling) | Adopt next | Extract predictable fields from public HTML pages at scale. |
| Semantic enrichment | [Crawl4AI](https://github.com/unclecode/crawl4ai) | Adopt next | Crawl selected creator websites and produce clean, LLM-ready content. |
| Interactive fallback | [browser-use](https://github.com/browser-use/browser-use) | Optional | Handle a small number of complex, interactive pages after deterministic extraction fails. |
| Agent orchestration | [CrewAI](https://github.com/crewAIInc/crewAI) | Do not add now | The current workflow is deterministic; a second orchestration runtime would add operational complexity. |
| Personal agent runtime | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Do not add | Its memory, messaging, and personal-assistant runtime do not match the acquisition backend. |

Recommended execution order:

1. Search through Apify and normalize candidate profile URLs.
2. Use Scrapling for deterministic fields such as website title, contact links,
   social links, and public business email.
3. Send only promising or incomplete records to Crawl4AI for semantic content,
   media-kit discovery, and category evidence.
4. Use browser-use only for approved pages that require interaction.
5. Deduplicate, score, and persist evidence with its source URL and retrieval time.

Scrapling and Crawl4AI should run as private Python services. They are not marked
as active in the dashboard until their server URLs are configured.

The application expects the Scrapling service to expose:

```http
POST /extract
Content-Type: application/json

{"url":"https://creator.example"}
```

The response may contain `text` or `content`, plus an optional `emails` array.
Crawl4AI uses its standard `POST /crawl` endpoint. Enrichment is capped at 25
external websites per batch with four concurrent requests, and failures never
replace or invent candidate data.

## Required environment

```env
APIFY_TOKEN=
APIFY_INSTAGRAM_SEARCH_ACTOR=apify/instagram-search-scraper
APIFY_TIKTOK_SEARCH_ACTOR=clockworks/tiktok-user-search-scraper
OPENAI_API_KEY=
OPENAI_DISCOVERY_MODEL=gpt-5.4-mini
AGENT_CRON_SECRET=
AGENT_BASE_URL=http://127.0.0.1:3000
SCRAPLING_SERVICE_URL=http://localhost:8011
CRAWL4AI_BASE_URL=http://localhost:11235
BROWSER_USE_SERVICE_URL=http://localhost:8012
BROWSER_USE_MODEL=gpt-5.4-mini
```

`APIFY_TOKEN` is required for live Instagram and TikTok searches.
`OPENAI_API_KEY` enables the professional AI query planner. Without it, the
deterministic bilingual fallback keeps manual and autonomous planning available.

Browser-use remains optional for bulk discovery and uses the server-side
`OPENAI_API_KEY` only when the first two extraction tiers cannot produce enough
useful content.

## Local open-source services

Pinned source checkouts live under `integrations/vendor`:

- Scrapling `v0.4.9`
- Crawl4AI `v0.8.9`
- Browser-use `0.9.7`

Start or stop the complete enrichment stack with:

```powershell
npm run enrichment:up
npm run enrichment:down
```

The application uses Scrapling first, Crawl4AI second, and Browser-use only as
the final fallback for complex public pages. All ports bind to `127.0.0.1`;
the wrappers reject private network targets, and Browser-use is restricted to
the requested domain without form submission or authentication actions.

## Security

- Provider tokens remain server-only.
- Batch creation, execution, and synchronization require Supabase authentication.
- Only public profile data is processed.
- Extraction services must be private, authenticated, rate-limited, and protected
  from requests to local or private network addresses.
- Crawl4AI deployments must be pinned to a reviewed version because its project
  has published security fixes affecting self-hosted deployments.
- Outreach remains human-reviewed.
