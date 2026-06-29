/**
 * Risha 360 — Creator Scoring & Authenticity Engine
 *
 * 100-point framework (ported from the legacy Python backend) PLUS a real
 * fake-follower / authenticity detection layer that the previous crude
 * `scoreCandidate` in storage.ts was missing.
 *
 * Scoring breakdown (default weights, all configurable):
 *   Followers ............ 25
 *   Engagement ........... 25
 *   Saudi Relevance ...... 15
 *   Commercial Value ..... 10
 *   Contact Availability . 10
 *   Brand Safety ......... 10
 *   Signup Probability ...  5
 *                          ───
 *   Total ................ 100
 *
 * The engine works with the fields actually available on a DiscoveredCandidate
 * (followers / following / posts / verified / bio / website / email) and reads
 * optional engagement metrics from sourceMetadata when a profile scraper has
 * provided them. When engagement data is absent it scores conservatively and
 * lowers data completeness instead of inventing a flat value.
 */

import type { DiscoveredCandidate, SearchPlan } from './types'

// ── Configurable weights ────────────────────────────────────────
export interface ScoringWeights {
  followers: number
  engagement: number
  saudiRelevance: number
  commercialValue: number
  contactAvailability: number
  brandSafety: number
  signupProbability: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  followers: 25,
  engagement: 25,
  saudiRelevance: 15,
  commercialValue: 10,
  contactAvailability: 10,
  brandSafety: 10,
  signupProbability: 5,
}

export type Tier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'unqualified'

// ── Engagement metrics extracted from a profile (optional) ──────
export interface EngagementMetrics {
  engagementRate?: number // percentage, e.g. 3.5 == 3.5%
  avgLikes?: number
  avgComments?: number
  avgViews?: number
  contentFrequency?: number // posts per week
  known: boolean // false when no real engagement signal was available
}

// ── Authenticity result ─────────────────────────────────────────
export interface AuthenticityResult {
  isFakeFollowersSuspected: boolean
  fakeFollowersPercentage: number // 0-95 estimated
  authenticityScore: number // 0-100 (100 = clean)
  signals: string[]
}

// ── Full score result ───────────────────────────────────────────
export interface ScoreResult {
  followersScore: number
  engagementScore: number
  saudiRelevanceScore: number
  commercialValueScore: number
  contactAvailabilityScore: number
  brandSafetyScore: number
  signupProbabilityScore: number
  totalScore: number
  tier: Tier
  engagementRate: number
  engagementKnown: boolean
  authenticity: AuthenticityResult
  dataCompleteness: number // 0-1
  details: Record<string, unknown>
}

// ── Helpers ─────────────────────────────────────────────────────
const round = (n: number, d = 2) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

const SAUDI_CITIES = [
  'riyadh', 'jeddah', 'mecca', 'makkah', 'medina', 'madinah', 'dammam',
  'khobar', 'taif', 'tabuk', 'buraidah', 'abha', 'hail', 'najran', 'yanbu',
  'jubail', 'qassim', 'khamis',
]
const SAUDI_KEYWORDS = ['السعود', 'الرياض', 'جده', 'جدة', 'ksa', 'saudi', 'sauidi']
const HIGH_VALUE_NICHES = [
  'fashion', 'beauty', 'skincare', 'lifestyle', 'food', 'tech', 'fitness',
  'travel', 'luxury', 'automotive', 'parenting', 'home', 'finance', 'education',
  'health', 'wellness', 'perfume', 'modest', 'موضه', 'موضة', 'جمال', 'مكياج',
  'طعام', 'سفر', 'صحة', 'رياضة',
]
const MEDIUM_VALUE_NICHES = [
  'gaming', 'comedy', 'entertainment', 'sports', 'music', 'art', 'photography',
  'diy', 'pets',
]

function hasArabic(text: string): boolean {
  let count = 0
  for (const c of text) if (c >= '؀' && c <= 'ۿ') count += 1
  return count > 3
}

// ── Engagement extraction from candidate metadata ───────────────
export function extractEngagement(candidate: DiscoveredCandidate): EngagementMetrics {
  const meta = (candidate.sourceMetadata || {}) as Record<string, unknown>
  const num = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = meta[k]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
    }
    return undefined
  }

  const avgLikes = num('avgLikes', 'averageLikes', 'avg_likes')
  const avgComments = num('avgComments', 'averageComments', 'avg_comments')
  const avgViews = num('avgViews', 'averageViews', 'avg_views')
  let engagementRate = num('engagementRate', 'engagement_rate', 'engagement')
  const contentFrequency = num('contentFrequency', 'postsPerWeek')

  // Derive engagement rate from avg interactions / followers when possible.
  if (engagementRate === undefined && candidate.followers > 0 && (avgLikes || avgComments)) {
    const interactions = (avgLikes || 0) + (avgComments || 0)
    engagementRate = round((interactions / candidate.followers) * 100, 3)
  }

  const known = engagementRate !== undefined || avgLikes !== undefined || avgComments !== undefined
  return { engagementRate, avgLikes, avgComments, avgViews, contentFrequency, known }
}

// ── Fake-follower / authenticity detection ──────────────────────
export function detectFakeFollowers(
  candidate: DiscoveredCandidate,
  engagement: EngagementMetrics
): AuthenticityResult {
  const signals: string[] = []
  let fakePct = 0

  const { followers, following, posts, verified } = candidate

  // 1. Mass-following pattern (following >> followers is a classic bot/growth-hack signal)
  if (following !== undefined && followers > 0) {
    const ratio = following / Math.max(followers, 1)
    if (followers > 5000 && following > followers) {
      fakePct += 25
      signals.push('following exceeds followers on a large account')
    } else if (following > 7500 && ratio > 0.5) {
      fakePct += 12
      signals.push('unusually high following count')
    }
  }

  // 2. Engagement far below the expected band for the account size.
  if (engagement.known && engagement.engagementRate !== undefined && followers > 0) {
    const er = engagement.engagementRate
    // Expected minimum ER drops as audience grows.
    let floor: number
    if (followers >= 1_000_000) floor = 0.4
    else if (followers >= 100_000) floor = 0.8
    else if (followers >= 10_000) floor = 1.2
    else floor = 1.5
    if (er > 0 && er < floor * 0.4) {
      fakePct += 35
      signals.push(`engagement (${er}%) far below expected for audience size`)
    } else if (er > 0 && er < floor) {
      fakePct += 18
      signals.push(`engagement (${er}%) below expected for audience size`)
    }
  }

  // 3. Large audience but almost no content (bought-follower shell account).
  if (posts !== undefined && followers > 10_000 && posts < 3) {
    fakePct += 20
    signals.push('large audience with almost no posts')
  }

  // 4. Weak supporting signal: big account, no bio and no website.
  if (followers > 20_000 && !candidate.bio?.trim() && !candidate.website?.trim()) {
    fakePct += 5
    signals.push('large account with empty bio and no website')
  }

  // Verified accounts get a benefit of the doubt.
  if (verified && fakePct > 0) {
    fakePct = Math.round(fakePct * 0.5)
    signals.push('verified account — penalty reduced')
  }

  fakePct = clamp(fakePct, 0, 95)
  const suspected = fakePct >= 25

  return {
    isFakeFollowersSuspected: suspected,
    fakeFollowersPercentage: round(fakePct, 1),
    authenticityScore: round(100 - fakePct, 1),
    signals,
  }
}

// ── Dimension scorers ───────────────────────────────────────────
export function scoreFollowers(followers: number, max: number): number {
  if (followers <= 0) return 0
  const log = Math.log10(Math.max(followers, 1))
  const normalized = clamp((log - 2) / (7.5 - 2), 0, 1)
  return round(max * normalized ** 0.85)
}

export function scoreEngagement(e: EngagementMetrics, max: number): number {
  // Unknown engagement: conservative baseline (~30% of max) rather than a
  // misleading full score. Real data should always beat an unknown profile.
  if (!e.known || e.engagementRate === undefined) return round(max * 0.3)

  const er = e.engagementRate
  let base: number
  if (er <= 0) base = 0
  else if (er >= 6) base = 1
  else if (er >= 4) base = 0.6 + ((er - 4) / 2) * 0.4
  else if (er >= 2) base = 0.3 + ((er - 2) / 2) * 0.3
  else if (er >= 1) base = 0.15 + (er - 1) * 0.15
  else base = er * 0.15

  let qualityBonus = 0
  if (e.avgLikes && e.avgComments && e.avgLikes > 0) {
    const cr = e.avgComments / e.avgLikes
    if (cr >= 0.01 && cr <= 0.05) qualityBonus = 0.1
    else if (cr >= 0.005 && cr < 0.01) qualityBonus = 0.05
  }

  let consistencyBonus = 0
  if (e.contentFrequency !== undefined) {
    if (e.contentFrequency >= 3) consistencyBonus = 0.1
    else if (e.contentFrequency >= 1) consistencyBonus = 0.05
  }

  return round(max * clamp(base + qualityBonus + consistencyBonus, 0, 1))
}

export function scoreSaudiRelevance(
  candidate: DiscoveredCandidate,
  plan: SearchPlan,
  max: number
): number {
  const text = `${candidate.displayName} ${candidate.bio} ${candidate.username}`.toLowerCase()
  let score = 0

  const cityHit =
    SAUDI_CITIES.some((c) => text.includes(c)) ||
    (plan.city && text.includes(plan.city.toLowerCase()))
  const keywordHit = SAUDI_KEYWORDS.some((k) => text.includes(k.toLowerCase()))

  if (keywordHit) score += 8 // strong country/identity signal
  if (cityHit) score += 4
  if (hasArabic(`${candidate.displayName} ${candidate.bio}`)) score += 3

  return round(clamp(score, 0, max))
}

export function scoreCommercialValue(
  candidate: DiscoveredCandidate,
  plan: SearchPlan,
  engagement: EngagementMetrics,
  max: number
): number {
  const niche = `${plan.category} ${candidate.bio}`.toLowerCase()
  let score = 0

  if (HIGH_VALUE_NICHES.some((n) => niche.includes(n))) score += 4
  else if (MEDIUM_VALUE_NICHES.some((n) => niche.includes(n))) score += 2.5
  else score += 1.5

  if (candidate.website) score += 1
  if (candidate.verified) score += 2 // proxy for business/established presence

  const er = engagement.engagementRate ?? 0
  if (er >= 2) score += 1
  else if (er >= 1) score += 0.5

  return round(clamp(score, 0, max))
}

export function scoreContactAvailability(candidate: DiscoveredCandidate, max: number): number {
  let score = 0
  if (candidate.contactEmail && candidate.contactEmail.trim()) score += 5
  if (candidate.website && candidate.website.trim()) score += 2
  const bio = (candidate.bio || '').toLowerCase()
  if (!candidate.contactEmail && bio.includes('@') && bio.includes('.')) score += 1
  return round(clamp(score, 0, max))
}

export function scoreBrandSafety(authenticity: AuthenticityResult, max: number): number {
  // No content-level brand-safety signals are collected yet (no flagged-keyword,
  // NSFW, or controversy detection). Instead of handing every profile a flat
  // ~70% baseline — which inflated the total score uniformly and weakened the
  // quality filter — we anchor on the ONE real signal we have: authenticity.
  // A clean profile gets a neutral score (content still unverified); a suspected
  // fake-follower account is penalised in proportion to how bad it looks.
  let fraction: number
  if (authenticity.isFakeFollowersSuspected) {
    const pct = authenticity.fakeFollowersPercentage
    if (pct >= 40) fraction = 0.1
    else if (pct >= 30) fraction = 0.25
    else fraction = 0.4
  } else {
    fraction = 0.5 // neutral: clean authenticity, but content not yet verified
  }

  return round(clamp(fraction * max, 0, max))
}

export function scoreSignupProbability(
  candidate: DiscoveredCandidate,
  plan: SearchPlan,
  engagement: EngagementMetrics,
  saudiScore: number,
  max: number
): number {
  let score = 0
  const er = engagement.engagementRate ?? 0
  if (er >= 2) score += 1
  else if (er >= 1) score += 0.5
  score += 1 // brand-safe default
  if (candidate.contactEmail) score += 0.5
  if (saudiScore >= 8) score += 0.5
  return round(clamp(score, 0, max))
}

// ── Tier ─────────────────────────────────────────────────────────
export function classifyTier(total: number): Tier {
  if (total >= 80) return 'platinum'
  if (total >= 60) return 'gold'
  if (total >= 40) return 'silver'
  if (total >= 20) return 'bronze'
  return 'unqualified'
}

// ── Main entry point ────────────────────────────────────────────
export function scoreCandidate(
  candidate: DiscoveredCandidate,
  plan: SearchPlan,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoreResult {
  const engagement = extractEngagement(candidate)
  const authenticity = detectFakeFollowers(candidate, engagement)

  const followersScore = scoreFollowers(candidate.followers, weights.followers)
  const engagementScore = scoreEngagement(engagement, weights.engagement)
  const saudiRelevanceScore = scoreSaudiRelevance(candidate, plan, weights.saudiRelevance)
  const commercialValueScore = scoreCommercialValue(candidate, plan, engagement, weights.commercialValue)
  const contactAvailabilityScore = scoreContactAvailability(candidate, weights.contactAvailability)
  const brandSafetyScore = scoreBrandSafety(authenticity, weights.brandSafety)
  const signupProbabilityScore = scoreSignupProbability(
    candidate, plan, engagement, saudiRelevanceScore, weights.signupProbability
  )

  const totalScore = round(
    followersScore +
      engagementScore +
      saudiRelevanceScore +
      commercialValueScore +
      contactAvailabilityScore +
      brandSafetyScore +
      signupProbabilityScore
  )

  // Data completeness: reward records that actually have the signals we need.
  let completeness = 0.3
  if (candidate.followers > 0) completeness += 0.2
  if (candidate.following !== undefined) completeness += 0.1
  if (candidate.posts !== undefined) completeness += 0.1
  if (engagement.known) completeness += 0.2
  if (candidate.contactEmail || candidate.website) completeness += 0.1
  completeness = round(clamp(completeness, 0, 1), 2)

  return {
    followersScore,
    engagementScore,
    saudiRelevanceScore,
    commercialValueScore,
    contactAvailabilityScore,
    brandSafetyScore,
    signupProbabilityScore,
    totalScore,
    tier: classifyTier(totalScore),
    engagementRate: engagement.engagementRate ?? 0,
    engagementKnown: engagement.known,
    authenticity,
    dataCompleteness: completeness,
    details: {
      weights,
      engagement,
      authenticity,
    },
  }
}
