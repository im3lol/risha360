// POST /api/discovery/ingest
// Receives profiles harvested by the browser extension (running in the
// operator's real, logged-in Instagram session) and runs them through the
// scoring + storage pipeline. Authenticated with the shared agent secret
// (x-agent-secret) so the extension doesn't need a Supabase login.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentSecret } from '@/lib/api-auth'
import { badRequest, ingestSchema, serverError } from '@/lib/api-validation'
import { ingestCandidates } from '@/lib/discovery/orchestrator'
import { hasServiceRole } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  if (!hasServiceRole) {
    return NextResponse.json({ error: 'Server writes are not configured' }, { status: 503 })
  }
  if (!verifyAgentSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized ingest' }, { status: 401 })
  }

  const parsed = ingestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return badRequest(parsed.error)

  try {
    const result = await ingestCandidates(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    return serverError(error, 'POST /api/discovery/ingest')
  }
}
