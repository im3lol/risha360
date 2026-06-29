// GET /api/discovery/activity
// Live, human-readable view of what the discovery agent is doing right now:
// a running/idle status + the latest activity-log events. Polled by the
// dashboard's live monitor.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { serverError } from '@/lib/api-validation'
import { supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 30, 1), 100)

    const [settingsRes, activeRes, eventsRes] = await Promise.all([
      supabase
        .from('discovery_agent_settings')
        .select('enabled, last_tick_at, next_run_at, last_error, tick_locked_until')
        .eq('singleton', true)
        .maybeSingle(),
      supabase
        .from('discovery_batches')
        .select('id, name, status, agent_config, created_at')
        .in('status', ['running', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('activity_log')
        .select('id, event_type, message, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
    ])

    const settings = (settingsRes.data || {}) as Record<string, unknown>
    const active = (activeRes.data || [])[0] as { name?: string; agent_config?: string } | undefined
    const lockedUntil = settings.tick_locked_until ? new Date(String(settings.tick_locked_until)).getTime() : 0
    const ticking = lockedUntil > Date.now()
    const running = Boolean(active) || ticking

    let currentStep: string | null = null
    if (active?.agent_config) {
      try {
        currentStep = (JSON.parse(active.agent_config).currentStep as string) || null
      } catch {
        currentStep = null
      }
    }

    const events = (eventsRes.data || []).map((row: { id: string; event_type: string; message: string; created_at: string }) => ({
      id: row.id,
      type: row.event_type,
      message: row.message,
      at: timeAgo(row.created_at),
      createdAt: row.created_at,
    }))

    return NextResponse.json({
      status: {
        enabled: settings.enabled === true,
        running,
        currentStep,
        activeBatch: active?.name || null,
        lastTick: settings.last_tick_at || null,
        nextRun: settings.next_run_at || null,
        lastError: settings.last_error || null,
      },
      events,
    })
  } catch (error) {
    return serverError(error, 'GET /api/discovery/activity')
  }
}

function timeAgo(d?: string): string {
  if (!d) return ''
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `قبل ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `قبل ${hrs} س`
  return `قبل ${Math.floor(hrs / 24)} يوم`
}
