/**
 * Risha 360 — Browser-session discovery source.
 *
 * Talks to the self-hosted `instagram-agent` service (Camoufox stealth browser)
 * which drives Instagram like a human and returns rich profile data captured
 * from Instagram's own internal web API — including recent-post like/comment
 * counts, so the scoring engine gets a REAL engagement rate.
 *
 * Same start → poll → collect lifecycle as the other sources; the heavy work
 * (the actual browsing) happens in `collectBrowserSessionCandidates` during the
 * batch sync. Selected via DISCOVERY_SOURCE=browser_session.
 */

import { qualifyProfile } from './qualify'
import type {
  DiscoveredCandidate,
  DiscoveryPlatform,
  ProviderRun,
  SearchPlan,
} from './types'

const MAX_PROFILES_PER_RUN = 40
const MAX_QUERIES = 10
const RUN_TIMEOUT_MS = 10 * 60_000 // browsing many profiles with human pacing is slow

export function isBrowserSessionConfigured() {
  return Boolean(process.env.INSTAGRAM_AGENT_URL)
}

export function startBrowserSessionRun(
  platform: DiscoveryPlatform,
  plan: SearchPlan
): ProviderRun {
  return {
    platform,
    source: 'browser_session',
    actorId: 'instagram_agent',
    runId: `browser-${platform}-${plan.createdAt}`,
    status: 'SUCCEEDED',
    queries: plan.queries.slice(0, MAX_QUERIES),
    hashtags: plan.hashtags ? plan.hashtags.slice(0, 8) : [],
    niche: `${plan.category} ${plan.city}`.trim(),
    targetCount: plan.targetCount,
    minFollowers: plan.minFollowers,
  }
}

export function getBrowserSessionRun(run: ProviderRun): ProviderRun {
  return { ...run, status: 'SUCCEEDED' }
}

export async function collectBrowserSessionCandidates(
  run: ProviderRun
): Promise<DiscoveredCandidate[]> {
  if (run.platform !== 'instagram') return []
  const baseUrl = process.env.INSTAGRAM_AGENT_URL
  const queries = run.queries || []
  if (!baseUrl || !queries.length) return []

  const limit = Math.min(MAX_PROFILES_PER_RUN, Math.max(run.targetCount || MAX_PROFILES_PER_RUN, 10))

  let payload: AgentRunResponse
  try {
    const response = await fetch(`${trimSlash(baseUrl)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries,
        hashtags: run.hashtags || [],
        limit,
        min_followers: run.minFollowers || 0,
        personal_only: true,
      }),
      signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) return []
    payload = (await response.json()) as AgentRunResponse
  } catch {
    return []
  }

  const raw = payload.candidates || []
  const apiKey = process.env.OPENROUTER_API_KEY
  const niche = run.niche || ''

  // Visual AI qualification (only when a vision model key is configured).
  const mapped = await runPool(raw, 2, async (p) => {
    if (!p.username) return null
    if (apiKey) {
      const verdict = await qualifyProfile({
        username: p.username,
        fullName: p.full_name,
        bio: p.biography,
        category: p.category,
        followers: p.followers,
        engagementRate: p.engagement_rate ?? undefined,
        captions: p.captions,
        images: [p.profile_pic_url, ...(p.post_images || [])].filter(Boolean) as string[],
        niche,
      })
      if (!verdict.keep) return null
      const candidate = mapAgentProfile(p)
      if (candidate) {
        candidate.sourceMetadata = {
          ...candidate.sourceMetadata,
          persona: verdict.persona,
          qualifyReason: verdict.reason,
        }
      }
      return candidate
    }
    return mapAgentProfile(p)
  })

  return mapped.filter((c): c is DiscoveredCandidate => c !== null)
}

/** Bounded-concurrency map. */
async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, () => worker()))
  return results
}

export interface AgentProfile {
  platform?: string
  username?: string
  full_name?: string
  biography?: string
  followers?: number
  following?: number
  posts?: number
  is_verified?: boolean
  is_private?: boolean
  is_business?: boolean
  category?: string
  website?: string | null
  profile_pic_url?: string | null
  email?: string | null
  avg_likes?: number | null
  avg_comments?: number | null
  engagement_rate?: number | null
  posts_sampled?: number
  persona?: string
  qualify_reason?: string
  post_images?: string[]
  captions?: string[]
}

interface AgentRunResponse {
  count?: number
  authenticated?: boolean
  candidates?: AgentProfile[]
}

/**
 * Maps a raw profile from the instagram-agent OR the browser extension into a
 * DiscoveredCandidate. Engagement signals go through sourceMetadata so the
 * scoring engine computes a real engagement rate.
 */
export function mapAgentProfile(p: AgentProfile): DiscoveredCandidate | null {
  if (!p.username) return null
  const platform: DiscoveryPlatform = p.platform === 'tiktok' ? 'tiktok' : 'instagram'
  const username = p.username.toLowerCase()
  const profileUrl =
    platform === 'tiktok'
      ? `https://www.tiktok.com/@${username}`
      : `https://www.instagram.com/${username}/`
  return {
    platform,
    username,
    displayName: p.full_name || p.username,
    bio: p.biography || '',
    profileUrl,
    profileImageUrl: p.profile_pic_url || undefined,
    followers: p.followers || 0,
    following: p.following,
    posts: p.posts,
    verified: Boolean(p.is_verified),
    website: p.website || undefined,
    contactEmail: p.email || undefined,
    // Engagement signals flow through sourceMetadata so the scoring engine's
    // extractEngagement() picks up REAL avg likes/comments instead of the
    // conservative fallback.
    sourceMetadata: {
      source: 'browser_session',
      provider: 'instagram_agent',
      sourceTool: 'instagram_agent',
      avgLikes: p.avg_likes ?? undefined,
      avgComments: p.avg_comments ?? undefined,
      engagementRate: p.engagement_rate ?? undefined,
      postsSampled: p.posts_sampled,
      isPrivate: p.is_private,
      isBusiness: p.is_business,
      accountCategory: p.category || undefined,
      persona: p.persona || undefined,
      qualifyReason: p.qualify_reason || undefined,
    },
  }
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}
