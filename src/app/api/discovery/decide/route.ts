// POST /api/discovery/decide
// The adaptive agent brain: the caller (browser extension or server worker)
// posts the current run state and gets back ONE next action to execute
// (snowball / refine_queries / broaden / switch_segment / stop). This is what
// turns discovery into a Plan → Act → Observe → Decide loop.
// Authenticated with the shared agent secret (or a logged-in user).
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentSecret, requireAuthenticatedUser } from '@/lib/api-auth'
import { badRequest, decideSchema, serverError } from '@/lib/api-validation'
import { decideNextAction, type AgentState } from '@/lib/discovery/agent-brain'
import { getAgentSettings } from '@/lib/discovery/orchestrator'
import { applyAgentConfig } from '@/lib/discovery/runtime-config'

export async function POST(request: NextRequest) {
  if (!verifyAgentSecret(request)) {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError
  }

  const parsed = decideSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return badRequest(parsed.error)

  try {
    await applyAgentConfig(await getAgentSettings().catch(() => null))
    const action = await decideNextAction(parsed.data as AgentState)
    return NextResponse.json({ action })
  } catch (error) {
    return serverError(error, 'POST /api/discovery/decide')
  }
}
