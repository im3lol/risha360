// GET /api/stats - Dashboard statistics
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const [influencersRes, leadsRes, batchesRes, conversationsRes, tasksRes, activityRes, nicheRes] = await Promise.all([
      supabase.from('influencers').select('id, status, primary_niche', { count: 'exact' }),
      supabase.from('leads').select('id, stage, priority, score', { count: 'exact' }),
      supabase.from('discovery_batches').select('id, status', { count: 'exact' }),
      supabase.from('conversations').select('id, outreach_state, is_responded', { count: 'exact' }),
      supabase.from('agent_tasks').select('id, status', { count: 'exact' }),
      supabase.from('activity_log').select('id, event_type, message, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('influencers').select('primary_niche'),
    ])

    // If tables don't exist yet, return empty stats
    if (influencersRes.error?.code === 'PGRST205') {
      return NextResponse.json({ dbReady: false, stats: null })
    }

    const totalInfluencers = influencersRes.count || 0
    const totalLeads = leadsRes.count || 0
    const hotLeads = leadsRes.data?.filter((l: any) => l.priority === 'critical' || l.priority === 'high').length || 0
    const registeredCount = leadsRes.data?.filter((l: any) => l.stage === 'closed_won').length || 0
    const activeBatches = batchesRes.data?.filter((b: any) => b.status === 'running' || b.status === 'pending').length || 0
    const responded = conversationsRes.data?.filter((c: any) => c.is_responded).length || 0
    const totalConversations = conversationsRes.count || 0
    const activeTasks = tasksRes.data?.filter((t: any) => t.status === 'running').length || 0

    // Build funnel data from lead stages
    const stageCounts: Record<string, number> = {}
    leadsRes.data?.forEach((l: any) => {
      stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1
    })
    const stageMap: Record<string, string> = {
      new: 'Discovered', qualified: 'Qualified', outreach_queued: 'Assigned',
      outreach_sent: 'Contacted', engaged: 'Replied', closed_won: 'Registered',
    }
    const stageOrder = ['new', 'qualified', 'outreach_queued', 'outreach_sent', 'engaged', 'closed_won']
    const stageNames = ['Discovered', 'Qualified', 'Assigned', 'Contacted', 'Replied', 'Registered']
    const funnelData = stageOrder.map((stage, i) => {
      const count = Object.entries(stageCounts)
        .filter(([s]) => stageMap[s] === stageNames[i])
        .reduce((sum, [, c]) => sum + c, 0)
      return {
        stage: stageNames[i],
        count,
        rate: totalLeads > 0 ? Math.round((count / totalLeads) * 1000) / 10 : 0,
      }
    })

    // Build category distribution from niches
    const nicheCounts: Record<string, number> = {}
    nicheRes.data?.forEach((n: any) => {
      const niche = n.primary_niche || 'Other'
      nicheCounts[niche] = (nicheCounts[niche] || 0) + 1
    })
    const categoryDistribution = Object.entries(nicheCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalInfluencers > 0 ? Math.round((count / totalInfluencers) * 1000) / 10 : 0,
      }))

    // Build recent activity
    const recentActivity = activityRes.data?.map((a: any) => {
      const typeMap: Record<string, string> = { score: 'score', batch: 'batch', outreach: 'outreach', registration: 'registration', alert: 'alert', enrichment: 'enrichment' }
      return {
        id: a.id,
        type: typeMap[a.event_type] || a.event_type,
        message: a.message,
        timestamp: formatTimeAgo(a.created_at),
      }
    }) || []

    return NextResponse.json({
      dbReady: true,
      stats: {
        totalInfluencers,
        totalLeads,
        hotLeads,
        registeredCount,
        activeBatches,
        respondedConversations: responded,
        totalConversations,
        activeTasks,
        responseRate: totalConversations > 0 ? Math.round((responded / totalConversations) * 100) : 0,
        funnelData,
        categoryDistribution,
        recentActivity,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ dbReady: false, stats: null, error: error.message }, { status: 500 })
  }
}

function formatTimeAgo(d?: string): string {
  if (!d) return 'N/A'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
