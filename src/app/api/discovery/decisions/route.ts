// GET /api/discovery/decisions
// Recent decisions made by the autonomous discovery agent brain (logged to
// activity_log with event_type='agent'). Powers the live "Agent Brain" panel
// in the dashboard so you can watch what the agent chose and why.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { serverError } from '@/lib/api-validation'
import { supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get('limit')) || 20, 1),
      100
    )

    const { data, error } = await supabase
      .from('activity_log')
      .select('id, message, metadata, entity_id, created_at')
      .eq('event_type', 'agent')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return serverError(error, 'GET /api/discovery/decisions')

    const decisions = (data || []).map((row: {
      id: string
      message: string
      metadata: string | null
      entity_id: string | null
      created_at: string
    }) => {
      let meta: Record<string, unknown> = {}
      try {
        meta = row.metadata ? JSON.parse(row.metadata) : {}
      } catch {
        meta = {}
      }
      return {
        id: row.id,
        message: row.message,
        category: typeof meta.category === 'string' ? meta.category : null,
        city: typeof meta.city === 'string' ? meta.city : null,
        minFollowers: typeof meta.minFollowers === 'number' ? meta.minFollowers : null,
        reason: typeof meta.reason === 'string' ? meta.reason : null,
        batchId: row.entity_id,
        createdAt: row.created_at,
      }
    })

    return NextResponse.json({ data: decisions })
  } catch (error) {
    return serverError(error, 'GET /api/discovery/decisions')
  }
}
