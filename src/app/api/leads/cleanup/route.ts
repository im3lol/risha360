// POST /api/leads/cleanup — scan saved profiles and remove the ones that are
// NOT individual people/creators (restaurants, shops, places, news/guide pages).
// Body: { dryRun?: boolean } — dryRun returns what WOULD be removed without
// deleting. Authenticated (logged-in user OR the agent secret, so the worker
// can run it automatically).
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser, verifyAgentSecret } from '@/lib/api-auth'
import { serverError } from '@/lib/api-validation'
import { supabaseServer as supabase } from '@/lib/supabase-server'
import { classifyPerson } from '@/lib/discovery/is-person'

export async function POST(request: NextRequest) {
  if (!verifyAgentSecret(request)) {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError
  }

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dryRun === true

  try {
    const { data: profiles, error } = await supabase
      .from('social_profiles')
      .select('influencer_id, platform_username, bio, is_verified, influencer:influencers(display_name, bio, primary_niche)')
      .limit(5000)
    if (error) return serverError(error, 'POST /api/leads/cleanup')

    const flagged: { influencerId: string; handle: string; reason: string }[] = []
    for (const p of profiles || []) {
      const inf = (Array.isArray(p.influencer) ? p.influencer[0] : p.influencer) as
        | { display_name?: string; bio?: string; primary_niche?: string }
        | undefined
      const verdict = classifyPerson({
        username: p.platform_username,
        fullName: inf?.display_name,
        bio: p.bio || inf?.bio,
        category: inf?.primary_niche,
        isVerified: p.is_verified,
      })
      if (!verdict.isPerson && p.influencer_id) {
        flagged.push({
          influencerId: p.influencer_id,
          handle: p.platform_username,
          reason: verdict.reason,
        })
      }
    }

    const ids = [...new Set(flagged.map((f) => f.influencerId))]
    if (!dryRun && ids.length) {
      // Remove leads → profiles → influencers for every flagged account.
      await supabase.from('leads').delete().in('influencer_id', ids)
      await supabase.from('social_profiles').delete().in('influencer_id', ids)
      await supabase.from('influencers').delete().in('id', ids)
    }

    return NextResponse.json({
      dryRun,
      scanned: profiles?.length || 0,
      flagged: flagged.length,
      removed: dryRun ? 0 : ids.length,
      samples: flagged.slice(0, 25),
    })
  } catch (error) {
    return serverError(error, 'POST /api/leads/cleanup')
  }
}
