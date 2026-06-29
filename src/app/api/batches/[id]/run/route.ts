import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { startBatch } from '@/lib/discovery/orchestrator'
import { hasServiceRole } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasServiceRole) {
    return NextResponse.json({ error: 'Server writes are not configured' }, { status: 503 })
  }
  const authError = await requireAuthenticatedUser(request)
  if (authError) return authError
  const { id } = await params

  try {
    const runs = await startBatch(id)
    return NextResponse.json({ success: true, runs })
  } catch (runError) {
    const message = runError instanceof Error ? runError.message : 'Discovery start failed'
    const status = message.includes('not configured') ? 503 : message.includes('already running') ? 409 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
