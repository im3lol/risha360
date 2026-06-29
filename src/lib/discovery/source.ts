/**
 * Risha 360 — Discovery source dispatcher.
 *
 * Selects the discovery backend behind a single switch so the orchestrator
 * never imports a concrete provider directly:
 *
 *   DISCOVERY_SOURCE=self_scrape  (default) → Crawl4AI/Scrapling, no paid API
 *   DISCOVERY_SOURCE=apify                  → legacy Apify search actors
 *
 * Both backends expose the same start → poll → collect lifecycle.
 */

import {
  getRun as getApifyRun,
  getRunCandidates as getApifyCandidates,
  isApifyConfigured,
  startSearchRun as startApifyRun,
} from './apify'
import {
  collectSelfScrapeCandidates,
  getSelfScrapeRun,
  isSelfScrapeConfigured,
  startSelfScrapeRun,
} from './self-scrape'
import {
  collectBrowserSessionCandidates,
  getBrowserSessionRun,
  isBrowserSessionConfigured,
  startBrowserSessionRun,
} from './browser-session'
import type {
  DiscoveredCandidate,
  DiscoveryPlatform,
  DiscoverySourceKind,
  ProviderRun,
  SearchPlan,
} from './types'

export function getDiscoverySource(): DiscoverySourceKind {
  const value = process.env.DISCOVERY_SOURCE
  if (value === 'apify') return 'apify'
  if (value === 'browser_session') return 'browser_session'
  return 'self_scrape'
}

export function isDiscoveryConfigured(): boolean {
  switch (getDiscoverySource()) {
    case 'apify':
      return isApifyConfigured()
    case 'browser_session':
      return isBrowserSessionConfigured()
    default:
      return isSelfScrapeConfigured()
  }
}

/** Human-readable note for the agent UI when discovery cannot start yet. */
export function discoveryReadinessMessage(): string {
  switch (getDiscoverySource()) {
    case 'apify':
      return isApifyConfigured()
        ? 'Apify search ready'
        : 'Search plan ready. Add APIFY_TOKEN to start.'
    case 'browser_session':
      return isBrowserSessionConfigured()
        ? 'Stealth browser agent ready (Instagram Agent)'
        : 'Search plan ready. Start the instagram-agent service to begin.'
    default:
      return isSelfScrapeConfigured()
        ? 'Self-hosted scraping ready (Crawl4AI/Scrapling)'
        : 'Search plan ready. Start Crawl4AI or Scrapling to begin.'
  }
}

/** Which provider produced a run (defaults to apify for legacy serialized runs). */
function runSource(run: ProviderRun): DiscoverySourceKind {
  return run.source ?? 'apify'
}

export async function startSearchRun(
  platform: DiscoveryPlatform,
  plan: SearchPlan
): Promise<ProviderRun> {
  switch (getDiscoverySource()) {
    case 'apify':
      return startApifyRun(platform, plan)
    case 'browser_session':
      return startBrowserSessionRun(platform, plan)
    default:
      return startSelfScrapeRun(platform, plan)
  }
}

export async function getRun(run: ProviderRun): Promise<ProviderRun> {
  switch (runSource(run)) {
    case 'apify':
      return getApifyRun(run)
    case 'browser_session':
      return getBrowserSessionRun(run)
    default:
      return getSelfScrapeRun(run)
  }
}

export async function getRunCandidates(run: ProviderRun): Promise<DiscoveredCandidate[]> {
  switch (runSource(run)) {
    case 'apify':
      return getApifyCandidates(run)
    case 'browser_session':
      return collectBrowserSessionCandidates(run)
    default:
      return collectSelfScrapeCandidates(run)
  }
}
