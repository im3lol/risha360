/**
 * Risha 360 — Self-hosted discovery source (no paid search API).
 *
 * Replaces the Apify search layer with the open-source scraping services the
 * project already runs locally (Crawl4AI + Scrapling). The flow mirrors the
 * Apify provider interface (start → poll → collect) so the orchestrator stays
 * unchanged: the heavy work happens in `collectSelfScrapeCandidates`, which runs
 * during the batch sync just like Apify's dataset fetch.
 *
 * Strategy:
 *   1. Discover candidate profile URLs by crawling a public search-engine
 *      results page (DuckDuckGo HTML endpoint) for each query via Crawl4AI.
 *   2. Fetch each profile page and parse the Open Graph metadata
 *      (`og:description` → "X Followers, Y Following, Z Posts", `og:title` →
 *      display name + username) into a DiscoveredCandidate.
 *
 * This is best-effort: search engines and Instagram change markup and may rate
 * limit or gate behind a login wall. When a profile can't be parsed it is
 * skipped rather than failing the batch. There is NO Instagram API and NO paid
 * provider involved.
 */

import type {
  DiscoveredCandidate,
  DiscoveryPlatform,
  ProviderRun,
  SearchPlan,
} from './types'

const MAX_PROFILES_PER_RUN = 60
const MAX_QUERIES = 12
const CRAWL_TIMEOUT_MS = 60_000
const PROFILE_CONCURRENCY = 5
const QUERY_CONCURRENCY = 3
const CRAWL_RETRIES = 1

// Multiple search-engine result pages to discover profile URLs from. Tried in
// order until one yields Instagram links — resilience against a single engine
// rate-limiting or changing markup.
const SEARCH_ENGINES: Array<(query: string) => string> = [
  (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:instagram.com ${q}`)}`,
  (q) => `https://www.bing.com/search?q=${encodeURIComponent(`site:instagram.com ${q}`)}`,
]

export function isSelfScrapeConfigured() {
  return Boolean(process.env.CRAWL4AI_BASE_URL || process.env.SCRAPLING_SERVICE_URL)
}

export function startSelfScrapeRun(
  platform: DiscoveryPlatform,
  plan: SearchPlan
): ProviderRun {
  // No remote job to launch — we record the inputs and do the work at collect time.
  return {
    platform,
    source: 'self_scrape',
    actorId: 'self_scrape',
    runId: `self-${platform}-${plan.createdAt}`,
    status: 'SUCCEEDED',
    queries: plan.queries.slice(0, MAX_QUERIES),
    targetCount: plan.targetCount,
    minFollowers: plan.minFollowers,
  }
}

export function getSelfScrapeRun(run: ProviderRun): ProviderRun {
  // Synchronous source: nothing to poll, it is already complete.
  return { ...run, status: 'SUCCEEDED' }
}

export async function collectSelfScrapeCandidates(
  run: ProviderRun
): Promise<DiscoveredCandidate[]> {
  if (run.platform !== 'instagram') return [] // only Instagram parsing is implemented
  const queries = run.queries || []
  if (!queries.length) return []

  const targetCount = run.targetCount || MAX_PROFILES_PER_RUN

  // Step 1: discover profile URLs across all queries concurrently, dedup by username.
  const seen = new Set<string>()
  const urls: string[] = []
  const urlBatches = await runPool(queries, QUERY_CONCURRENCY, (q) => discoverProfileUrls(q))
  for (const batch of urlBatches) {
    for (const url of batch) {
      const username = usernameFromUrl(url)
      if (!username || seen.has(username)) continue
      seen.add(username)
      urls.push(url)
    }
  }

  // Step 2: fetch + parse profiles concurrently (bounded pool).
  const limited = urls.slice(0, Math.min(MAX_PROFILES_PER_RUN, Math.max(targetCount, 10)))
  const results = await runPool(limited, PROFILE_CONCURRENCY, (url) => fetchProfile(url))
  return results.filter((c): c is DiscoveredCandidate => c !== null)
}

/** Bounded-concurrency map: runs `fn` over `items`, at most `size` in flight. */
async function runPool<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, items.length)) }, () => worker())
  )
  return results
}

// ── Step 1: discover profile URLs from search engines (with fallback) ──
async function discoverProfileUrls(query: string): Promise<string[]> {
  for (const engine of SEARCH_ENGINES) {
    const html = await crawl(engine(query))
    if (html) {
      const urls = extractInstagramUrls(html)
      if (urls.length) return urls
    }
  }
  return []
}

/**
 * Pull canonical instagram.com/<username> profile URLs out of arbitrary HTML/
 * markdown. Handles the forms search engines actually emit: full URLs, bare
 * "instagram.com/user" display text (no scheme), and percent-encoded links
 * inside redirect params (e.g. DuckDuckGo's `uddg=...%2Finstagram.com%2Fuser`).
 */
export function extractInstagramUrls(html: string): string[] {
  const out = new Set<string>()
  const re = /instagram\.com(?:\/|%2[fF])([A-Za-z0-9._]+)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const username = match[1]
    if (isReservedPath(username)) continue
    out.add(`https://www.instagram.com/${username.toLowerCase()}/`)
  }
  return [...out]
}

const RESERVED = new Set([
  'p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'about',
  'developer', 'directory', 'legal', 'privacy', 'web', 'graphql', 'api',
])
function isReservedPath(username: string) {
  return RESERVED.has(username.toLowerCase()) || username.length < 2
}

function usernameFromUrl(url: string): string {
  const match = url.match(/instagram\.com\/([A-Za-z0-9._]+)/)
  return match ? match[1].toLowerCase() : ''
}

// ── Step 2: fetch a profile page and parse Open Graph metadata ──────
async function fetchProfile(url: string): Promise<DiscoveredCandidate | null> {
  const html = await crawl(url)
  if (!html) return null
  return parseInstagramProfile(url, html)
}

/**
 * Parse an Instagram profile page's Open Graph tags into a candidate.
 * Public profiles expose: og:title = "Name (@username) • Instagram photos…"
 * and og:description = "1,234 Followers, 567 Following, 89 Posts - bio…".
 * Pure function — unit tested in scripts/self-scrape.test.ts.
 */
export function parseInstagramProfile(
  url: string,
  html: string
): DiscoveredCandidate | null {
  const username = usernameFromUrl(url)
  if (!username) return null

  const ogDescription = metaContent(html, 'og:description')
  const description = metaContent(html, 'description')
  const title = metaContent(html, 'og:title') || ''

  const counts = parseCounts(ogDescription || description)
  if (!counts.hasFollowers) return null // no usable signal → skip

  const displayName = parseDisplayName(title) || username
  const bio = parseBio(description, ogDescription)

  return {
    platform: 'instagram',
    username,
    displayName,
    bio,
    profileUrl: `https://www.instagram.com/${username}/`,
    profileImageUrl: metaContent(html, 'og:image') || undefined,
    followers: counts.followers,
    following: counts.following,
    posts: counts.posts,
    verified: /"is_verified":\s*true/.test(html),
    website: undefined,
    sourceMetadata: {
      source: 'self_scrape',
      provider: 'crawl4ai',
      ogDescription: ogDescription || description,
      ogTitle: title,
    },
  }
}

function metaContent(html: string, property: string): string {
  // Matches both property="og:x" and name="x", attribute order independent.
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeEntities(m[1].trim())
  }
  return ''
}

interface ProfileCounts {
  followers: number
  following?: number
  posts?: number
  hasFollowers: boolean
}

function parseCounts(description: string): ProfileCounts {
  const followers = parseMetricNear(description, /followers/i)
  const following = parseMetricNear(description, /following/i)
  const posts = parseMetricNear(description, /posts?/i)
  return {
    followers: followers ?? 0,
    following,
    posts,
    hasFollowers: followers !== undefined,
  }
}

/** Find the number immediately preceding a keyword, e.g. "1,234 Followers" or "1.2M Followers". */
function parseMetricNear(text: string, keyword: RegExp): number | undefined {
  if (!text) return undefined
  const re = new RegExp(`([0-9][0-9.,]*\\s*[KMB]?)\\s*${keyword.source}`, 'i')
  const m = text.match(re)
  if (!m) return undefined
  return parseAbbreviatedNumber(m[1])
}

/** "1,234" → 1234, "1.2M" → 1200000, "12.3K" → 12300. */
export function parseAbbreviatedNumber(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/,/g, '')
  const m = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([KMB])?$/i)
  if (!m) return undefined
  const value = Number(m[1])
  if (!Number.isFinite(value)) return undefined
  const mult = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[(m[2] || '').toLowerCase()] || 1
  return Math.round(value * mult)
}

function parseDisplayName(title: string): string {
  // "Sara Style (@sara.style) • Instagram photos and videos" → "Sara Style"
  const beforeHandle = title.split('(@')[0].trim()
  const cleaned = beforeHandle.replace(/\s*[•|].*$/, '').trim()
  return cleaned
}

function parseBio(description: string, ogDescription: string): string {
  // Instagram's `description` meta carries the real bio inside quotes after
  // `on Instagram:` — e.g. `... Posts - Name (@user) on Instagram: "the bio"`.
  const quoted = description.match(/on Instagram:\s*"([\s\S]*)"\s*$/i)
  if (quoted && quoted[1].trim()) return quoted[1].trim().slice(0, 500)

  // Fallback: text after the "… Posts - " marker in either description.
  const src = ogDescription || description
  const dash = src.indexOf(' - ')
  if (dash === -1) return ''
  return src.slice(dash + 3).trim().slice(0, 500)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// ── Scraping transport: Crawl4AI first, Scrapling as fallback ───────
// Retries with a short backoff to ride out transient failures / rate limits.
async function crawl(url: string): Promise<string> {
  for (let attempt = 0; attempt <= CRAWL_RETRIES; attempt += 1) {
    const html = await crawlOnce(url)
    if (html) return html
    if (attempt < CRAWL_RETRIES) await sleep(800 * (attempt + 1))
  }
  return ''
}

async function crawlOnce(url: string): Promise<string> {
  const crawl4ai = process.env.CRAWL4AI_BASE_URL
  if (crawl4ai) {
    const html = await crawlViaCrawl4AI(crawl4ai, url)
    if (html) return html
  }
  const scrapling = process.env.SCRAPLING_SERVICE_URL
  if (scrapling) {
    const text = await crawlViaScrapling(scrapling, url)
    if (text) return text
  }
  return ''
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function crawlViaCrawl4AI(baseUrl: string, url: string): Promise<string> {
  try {
    const response = await fetch(`${trimSlash(baseUrl)}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [url],
        browser_config: { headless: true },
        crawler_config: { cache_mode: 'bypass' },
      }),
      signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) return ''
    const payload = (await response.json()) as Record<string, unknown>
    const first = firstObject(payload.results) || firstObject(payload.data) || payload
    return (
      stringField(first.html) ||
      stringField(first.cleaned_html) ||
      markdownText(first.markdown)
    )
  } catch {
    return ''
  }
}

async function crawlViaScrapling(baseUrl: string, url: string): Promise<string> {
  try {
    const response = await fetch(`${trimSlash(baseUrl)}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
    if (!response.ok) return ''
    const payload = (await response.json()) as Record<string, unknown>
    return stringField(payload.text) || stringField(payload.content)
  } catch {
    return ''
  }
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}
function stringField(value: unknown) {
  return typeof value === 'string' ? value : ''
}
function markdownText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const md = value as Record<string, unknown>
  return stringField(md.raw_markdown) || stringField(md.fit_markdown)
}
function firstObject(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value[0] && typeof value[0] === 'object'
    ? (value[0] as Record<string, unknown>)
    : null
}
