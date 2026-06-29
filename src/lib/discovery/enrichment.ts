import type { DiscoveredCandidate } from './types'

const MAX_ENRICHMENTS_PER_BATCH = 25
const ENRICHMENT_CONCURRENCY = 4
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export async function enrichCandidates(
  candidates: DiscoveredCandidate[]
): Promise<DiscoveredCandidate[]> {
  if (
    !process.env.SCRAPLING_SERVICE_URL &&
    !process.env.CRAWL4AI_BASE_URL &&
    !process.env.BROWSER_USE_SERVICE_URL
  ) {
    return candidates
  }

  const enriched = [...candidates]
  const targets = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      url: publicHttpUrl(candidate.profileUrl),
    }))
    .filter((target): target is typeof target & { url: string } => Boolean(target.url))
    .slice(0, MAX_ENRICHMENTS_PER_BATCH)

  let cursor = 0
  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor]
      cursor += 1
      const result = await extractWebsite(target.url)
      if (!result) continue

      const retrievedAt = new Date().toISOString()
      enriched[target.index] = {
        ...target.candidate,
        contactEmail: result.email || target.candidate.contactEmail,
        enrichment: {
          provider: result.provider,
          sourceUrl: target.url,
          retrievedAt,
          textSnippet: result.text.slice(0, 500) || undefined,
        },
        sourceMetadata: {
          ...target.candidate.sourceMetadata,
          enrichment: {
            provider: result.provider,
            sourceUrl: target.url,
            retrievedAt,
          },
        },
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(ENRICHMENT_CONCURRENCY, targets.length) },
      () => worker()
    )
  )
  return enriched
}

async function extractWebsite(url: string) {
  let bestResult: ExtractionResult | null = null
  const scraplingUrl = process.env.SCRAPLING_SERVICE_URL
  if (scraplingUrl) {
    const result = await callScrapling(scraplingUrl, url)
    if (result) {
      bestResult = result
      if (usefulExtraction(result)) return result
    }
  }

  const crawl4aiUrl = process.env.CRAWL4AI_BASE_URL
  if (crawl4aiUrl) {
    const result = await callCrawl4AI(crawl4aiUrl, url)
    if (result) {
      bestResult = result
      if (usefulExtraction(result)) return result
    }
  }

  const browserUseUrl = process.env.BROWSER_USE_SERVICE_URL
  if (browserUseUrl) {
    const result = await callBrowserUse(browserUseUrl, url)
    if (result) return result
  }

  return bestResult
}

type ExtractionResult = {
  provider: 'scrapling' | 'crawl4ai' | 'browser-use'
  text: string
  email: string
}

function usefulExtraction(result: ExtractionResult) {
  return Boolean(result.email) || result.text.trim().length >= 400
}

async function callScrapling(baseUrl: string, url: string) {
  try {
    const response = await fetch(`${trimSlash(baseUrl)}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
    if (!response.ok) return null

    const payload = (await response.json()) as Record<string, unknown>
    const text = textValue(payload.text) || textValue(payload.content)
    return {
      provider: 'scrapling' as const,
      text,
      email: firstEmail(payload.emails) || findEmail(text),
    }
  } catch {
    return null
  }
}

async function callCrawl4AI(baseUrl: string, url: string) {
  try {
    const response = await fetch(`${trimSlash(baseUrl)}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [url],
        browser_config: { headless: true },
        crawler_config: { cache_mode: 'bypass' },
      }),
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    })
    if (!response.ok) return null

    const payload = (await response.json()) as Record<string, unknown>
    const firstResult = firstObject(payload.results) || firstObject(payload.data) || payload
    const text =
      markdownText(firstResult.markdown) ||
      textValue(firstResult.cleaned_html) ||
      textValue(firstResult.html)

    return {
      provider: 'crawl4ai' as const,
      text,
      email: findEmail(text),
    }
  } catch {
    return null
  }
}

async function callBrowserUse(baseUrl: string, url: string) {
  try {
    const response = await fetch(`${trimSlash(baseUrl)}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(120_000),
      cache: 'no-store',
    })
    if (!response.ok) return null

    const payload = (await response.json()) as Record<string, unknown>
    const text = textValue(payload.text)
    return {
      provider: 'browser-use' as const,
      text,
      email: findEmail(text),
    }
  } catch {
    return null
  }
}

function publicHttpUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null

    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function markdownText(value: unknown) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const markdown = value as Record<string, unknown>
  return (
    textValue(markdown.raw_markdown) ||
    textValue(markdown.fit_markdown) ||
    textValue(markdown.markdown_with_citations)
  )
}

function firstObject(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value[0] && typeof value[0] === 'object'
    ? (value[0] as Record<string, unknown>)
    : null
}

function firstEmail(value: unknown) {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
}

function findEmail(value: string) {
  return value.match(EMAIL_PATTERN)?.[0] || ''
}
