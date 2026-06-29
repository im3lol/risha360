import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isApifyConfigured } from '@/lib/discovery/apify'
import { getDiscoverySource, isDiscoveryConfigured } from '@/lib/discovery/source'
import { selectPlannerProvider } from '@/lib/discovery/query-planner'

export async function GET(request: NextRequest) {
  const authError = await requireAuthenticatedUser(request)
  if (authError) return authError

  const [scraplingReady, crawl4aiReady, browserUseHealth] = await Promise.all([
    serviceHealth(process.env.SCRAPLING_SERVICE_URL),
    serviceHealth(process.env.CRAWL4AI_BASE_URL),
    serviceHealth(process.env.BROWSER_USE_SERVICE_URL),
  ])

  const plannerProvider = selectPlannerProvider()
  const plannerModel =
    plannerProvider === 'openrouter'
      ? process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free'
      : plannerProvider === 'gemini'
        ? process.env.GEMINI_DISCOVERY_MODEL || 'gemini-2.0-flash'
        : 'deterministic-template'

  return NextResponse.json({
    discoverySource: {
      active: getDiscoverySource(),
      configured: isDiscoveryConfigured(),
    },
    providers: {
      apify: {
        configured: isApifyConfigured(),
        instagramActor:
          process.env.APIFY_INSTAGRAM_SEARCH_ACTOR || 'apify/instagram-search-scraper',
        tiktokActor:
          process.env.APIFY_TIKTOK_SEARCH_ACTOR || 'clockworks/tiktok-user-search-scraper',
      },
      aiPlanner: {
        configured: plannerProvider !== null,
        provider: plannerProvider || 'deterministic',
        model: plannerModel,
        mode: plannerProvider ? 'ai-assisted' : 'deterministic-template',
      },
      scrapling: {
        configured: scraplingReady.ready,
      },
      crawl4ai: {
        configured: crawl4aiReady.ready,
      },
      browserUse: {
        configured:
          browserUseHealth.ready && browserUseHealth.payload?.llm_configured === true,
      },
    },
  })
}

async function serviceHealth(url?: string) {
  if (!url) return { ready: false, payload: null }
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    })
    const payload = response.ok
      ? ((await response.json()) as Record<string, unknown>)
      : null
    return { ready: response.ok, payload }
  } catch {
    return { ready: false, payload: null }
  }
}
