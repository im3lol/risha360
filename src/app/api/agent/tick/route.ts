import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentSecret } from '@/lib/api-auth'
import { runAgentTick } from '@/lib/discovery/orchestrator'

export async function POST(request: NextRequest) {
  if (!verifyAgentSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized agent tick' }, { status: 401 })
  }

  try {
    return NextResponse.json(await runAgentTick())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent tick failed' },
      { status: 500 }
    )
  }
}
