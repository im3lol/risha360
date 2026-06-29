// GET /api/tasks - List agent tasks
// POST /api/tasks - Create a new agent task
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { badRequest, serverError, taskCreateSchema } from '@/lib/api-validation'
import { hasServiceRole, supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const { data, error } = await supabase
      .from('agent_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return serverError(error, 'GET /api/tasks')

    const result = data?.map((t: any) => ({
      id: t.id,
      taskType: mapType(t.agent_type),
      agent: mapAgent(t.agent_type),
      status: mapStatus(t.status),
      priority: mapPriority(t.priority),
      created: formatDate(t.created_at),
      duration: t.duration_seconds ? formatDuration(t.duration_seconds) : '—',
      details: t.current_step || t.task_name,
      error: t.error_message || undefined,
    })) || []

    return NextResponse.json({ data: result })
  } catch (error) {
    return serverError(error, 'GET /api/tasks')
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasServiceRole) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is required for task writes.' },
        { status: 503 }
      )
    }
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const parsed = taskCreateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest(parsed.error)
    const body = parsed.data

    const { data, error } = await supabase
      .from('agent_tasks')
      .insert({
        agent_type: body.agent_type || 'discovery',
        task_name: body.task_name || 'New Task',
        status: 'pending',
        priority: body.priority ?? 5,
        input_data: body.input_data ? JSON.stringify(body.input_data) : null,
      })
      .select()
      .single()

    if (error) return serverError(error, 'POST /api/tasks')

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return serverError(error, 'POST /api/tasks')
  }
}

function mapType(t: string): string {
  const map: Record<string, string> = { discovery: 'Instagram Discovery', enrichment: 'Profile Scraping', scoring: 'Scoring', outreach: 'Outreach', sales_assignment: 'Sales Assignment', monitoring: 'Monitoring', dedup: 'Dedup Check', analytics: 'Coverage Analysis' }
  return map[t] || t
}
function mapAgent(t: string): string {
  const map: Record<string, string> = { discovery: 'Discovery Agent', enrichment: 'Scraping Agent', scoring: 'Qualification Agent', outreach: 'Sales Outreach Agent', sales_assignment: 'Sales Router Agent', monitoring: 'Market Coverage Agent', dedup: 'Discovery Agent', analytics: 'Market Coverage Agent' }
  return map[t] || t
}
function mapStatus(s: string): string {
  const map: Record<string, string> = { pending: 'Pending', queued: 'Pending', running: 'Running', completed: 'Completed', failed: 'Failed', retrying: 'Running' }
  return map[s] || 'Pending'
}
function mapPriority(p: number): string { return p >= 8 ? 'Hot' : p >= 6 ? 'High' : p >= 4 ? 'Normal' : 'Low' }
function formatDate(d?: string): string { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A' }
function formatDuration(s: number): string { return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` }
