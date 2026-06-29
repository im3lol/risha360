// POST /api/discovery/plan
// Returns AI-generated search queries + hashtags (Gemini/OpenRouter, with a
// deterministic fallback) for the browser extension and the stealth agent to
// drive smarter discovery. Authenticated with the shared agent secret.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentSecret, requireAuthenticatedUser } from '@/lib/api-auth'
import { badRequest, planRequestSchema, serverError } from '@/lib/api-validation'
import { createIntelligentSearchPlan } from '@/lib/discovery/query-planner'
import { getAgentSettings } from '@/lib/discovery/orchestrator'
import { applyAgentConfig } from '@/lib/discovery/runtime-config'

export async function POST(request: NextRequest) {
  // Allow either the shared agent secret (extension/agent) or a logged-in user.
  if (!verifyAgentSecret(request)) {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError
  }

  const parsed = planRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return badRequest(parsed.error)
  const input = parsed.data

  try {
    await applyAgentConfig(await getAgentSettings().catch(() => null))
    const plan = await createIntelligentSearchPlan({
      category: input.category,
      city: input.city,
      platforms: ['instagram'],
      minFollowers: input.minFollowers ?? 0,
      targetCount: input.targetCount ?? 30,
      extraKeywords: input.extraKeywords,
    })
    return NextResponse.json({
      queries: plan.queries,
      hashtags: plan.hashtags,
      planner: plan.planner,
      rationale: plan.rationale ?? null,
    })
  } catch (error) {
    return serverError(error, 'POST /api/discovery/plan')
  }
}
