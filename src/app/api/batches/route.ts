// GET /api/batches - List discovery batches
// POST /api/batches - Create a new discovery batch
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isDiscoveryConfigured } from '@/lib/discovery/source'
import { createBatch } from '@/lib/discovery/orchestrator'
import { createSearchPlan } from '@/lib/discovery/query-planner'
import { hasServiceRole, supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const { data, error } = await supabase
      .from('discovery_batches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result = data?.map((b: any) => {
      const config = parseConfig(b.agent_config)
      const fallbackPlan = createSearchPlan({
        category: b.niches?.split(',')[0] || 'Other',
        city: b.location_filter || 'All',
        platforms: b.platforms?.split(',').filter(Boolean) || ['instagram'],
        minFollowers: b.min_followers || 20000,
        targetCount: b.target_count || 100,
        extraKeywords: b.keywords,
      })
      const plan = config?.plan || fallbackPlan
      return {
        id: b.id,
        name: b.name,
        category: b.niches?.split(',')[0] || 'Other',
        city: b.location_filter || 'All',
        platform: (b.platforms?.split(',').filter(Boolean) || [])
          .map(mapPlatform)
          .join(' + ') || 'Unknown',
        platforms: b.platforms?.split(',').filter(Boolean) || [],
        target: b.target_count,
        found: b.total_profiles_found,
        processed: b.profiles_processed,
        leadsCreated: b.leads_created,
        errors: b.errors_count,
        status: mapStatus(b.status),
        stage: config?.stage || b.status,
        currentStep: config?.currentStep || 'Search plan ready',
        queries: plan.queries,
        hashtags: plan.hashtags,
        providerRuns: config?.runs || [],
        providerReady: isDiscoveryConfigured(),
        startedAt: formatDate(b.started_at),
        estimatedCompletion: b.completed_at ? formatDate(b.completed_at) : 'Not estimated',
      }
    }) || []

    return NextResponse.json({ data: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasServiceRole) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is required for discovery writes.' },
        { status: 503 }
      )
    }
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const body = await request.json()
    const data = await createBatch({
      name: String(body.name || `${body.location_filter} ${body.niches} Creator Discovery`),
      category: String(body.niches || 'Other'),
      city: String(body.location_filter || 'All'),
      platforms: ['instagram'],
      minFollowers: Math.max(0, Number(body.min_followers) || 20000),
      targetCount: Math.min(1000, Math.max(1, Number(body.target_count) || 100)),
      extraKeywords: body.keywords,
      triggeredBy: 'manual',
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function mapPlatform(p: string): string {
  const map: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitter: 'X (Twitter)', snapchat: 'Snapchat' }
  return map[p] || p || 'Unknown'
}
function mapStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'Planned',
    running: 'Searching',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    partial: 'Processing',
  }
  return map[s] || 'Planned'
}
function formatDate(d?: string): string { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A' }

function parseConfig(value?: string): import('@/lib/discovery/types').DiscoveryAgentConfig | null {
  if (!value) return null
  try {
    return JSON.parse(value) as import('@/lib/discovery/types').DiscoveryAgentConfig
  } catch {
    return null
  }
}
