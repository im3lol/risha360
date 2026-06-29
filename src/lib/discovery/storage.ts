import { supabaseServer as supabase } from '@/lib/supabase-server'
import { scoreCandidate, type ScoreResult } from './scoring'
import { classifyPerson } from './is-person'
import type { DiscoveredCandidate, SearchPlan } from './types'

export async function saveCandidates(
  batchId: string,
  plan: SearchPlan,
  candidates: DiscoveredCandidate[]
) {
  const unique = new Map<string, DiscoveredCandidate>()
  for (const candidate of candidates) {
    if (candidate.followers < plan.minFollowers) continue
    if (plan.maxFollowers && candidate.followers > plan.maxFollowers) continue
    // Automatic quality gate: only persons/creators are saved — never
    // restaurants, shops, places, or news/guide pages, whatever the source.
    const meta = candidate.sourceMetadata || {}
    if (
      !classifyPerson({
        username: candidate.username,
        fullName: candidate.displayName,
        bio: candidate.bio,
        category: (meta.accountCategory as string) || (meta.category as string) || (meta.persona as string) || '',
        isBusiness: (meta.isBusiness ?? meta.is_business) as boolean | undefined,
        isVerified: candidate.verified,
      }).isPerson
    ) {
      continue
    }
    unique.set(`${candidate.platform}:${candidate.username.toLowerCase()}`, candidate)
  }

  let created = 0
  let updated = 0
  let errors = 0

  for (const candidate of unique.values()) {
    try {
      const result = scoreCandidate(candidate, plan)
      const { data, error } = await supabase.rpc('save_discovered_candidate', {
        p_batch_id: batchId,
        p_candidate: {
          ...candidate,
          profile: profilePayload(candidate, result),
        },
        p_plan: plan,
        p_score: scorePayload(result),
      })
      if (error) throw error
      if (data === 'created') created += 1
      else updated += 1
    } catch (error) {
      console.error('Failed to save discovery candidate', candidate.username, error)
      errors += 1
    }
  }

  return { found: unique.size, created, updated, errors }
}

/** The real tool that produced this profile — never mislabel it as Apify. */
function sourceTool(candidate: DiscoveredCandidate): string {
  if (candidate.enrichment?.provider) return candidate.enrichment.provider
  const meta = (candidate.sourceMetadata || {}) as Record<string, unknown>
  if (typeof meta.sourceTool === 'string' && meta.sourceTool) return meta.sourceTool
  if (typeof meta.provider === 'string' && meta.provider) return meta.provider
  return 'self_scrape'
}

function profilePayload(candidate: DiscoveredCandidate, result: ScoreResult) {
  return {
    platform: candidate.platform,
    platform_username: candidate.username,
    platform_display_name: candidate.displayName,
    profile_url: candidate.profileUrl,
    profile_image_url: candidate.profileImageUrl || null,
    is_verified: candidate.verified,
    followers_count: candidate.followers,
    following_count: candidate.following || null,
    posts_count: candidate.posts || null,
    bio: candidate.bio,
    bio_links: candidate.website || null,
    contact_email: candidate.contactEmail || null,
    source_tool: sourceTool(candidate),
    fetched_by_agent: candidate.enrichment ? 'instagram_scraping_agent' : 'discovery_agent',
    source_url: candidate.profileUrl,
    source_metadata: JSON.stringify(candidate.sourceMetadata),
    last_synced_at: new Date().toISOString(),
    // Real quality signals from the scoring engine.
    engagement_rate: result.engagementRate,
    is_fake_followers_suspected: result.authenticity.isFakeFollowersSuspected,
    fake_followers_percentage: result.authenticity.fakeFollowersPercentage,
    data_completeness: result.dataCompleteness,
  }
}

/**
 * Maps the engine's ScoreResult to the JSON shape the save_discovered_candidate
 * RPC consumes. Keeps the original keys (total/followers/saudiRelevance/
 * contactAvailability) for backward compatibility and adds the full set of
 * sub-scores + authenticity so the updated RPC and score_breakdown capture them.
 */
function scorePayload(result: ScoreResult) {
  return {
    total: result.totalScore,
    followers: result.followersScore,
    engagement: result.engagementScore,
    saudiRelevance: result.saudiRelevanceScore,
    commercialValue: result.commercialValueScore,
    contactAvailability: result.contactAvailabilityScore,
    brandSafety: result.brandSafetyScore,
    signupProbability: result.signupProbabilityScore,
    tier: result.tier,
    engagementRate: result.engagementRate,
    engagementKnown: result.engagementKnown,
    isFakeFollowersSuspected: result.authenticity.isFakeFollowersSuspected,
    fakeFollowersPercentage: result.authenticity.fakeFollowersPercentage,
    authenticityScore: result.authenticity.authenticityScore,
    authenticitySignals: result.authenticity.signals,
  }
}
