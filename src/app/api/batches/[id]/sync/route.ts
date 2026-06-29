import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { syncBatch } from '@/lib/discovery/orchestrator'
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
    const result = await syncBatch(id)
    return NextResponse.json({ data: result.config, result: result.result })
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : 'Discovery sync failed'
    return NextResponse.json(
      { error: message },
      { status: message.includes('no provider runs') ? 400 : 502 }
    )
  }
}
