// GET /api/leads - List leads with filters
// POST /api/leads - Create a new lead
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { badRequest, leadCreateSchema, serverError } from '@/lib/api-validation'
import { hasServiceRole, supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const searchParams = request.nextUrl.searchParams
    const priority = searchParams.get('priority')
    const stage = searchParams.get('stage')
    const niche = searchParams.get('niche')
    const city = searchParams.get('city')
    const search = searchParams.get('search')
    const limit = clampInteger(searchParams.get('limit'), 50, 1, 200)
    const offset = clampInteger(searchParams.get('offset'), 0, 0, 100000)
    const hasInfluencerFilter = Boolean(niche || city || search)

    let query = supabase
      .from('leads')
      .select(
        `*, influencer:influencers${hasInfluencerFilter ? '!inner' : ''}(*)`,
        { count: 'exact' }
      )
      .order('score', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (priority) query = query.eq('priority', priority)
    if (stage) query = query.eq('stage', stage)
    if (niche) query = query.eq('influencer.primary_niche', niche)
    if (city) query = query.eq('influencer.city', city)
    if (search) query = query.ilike('influencer.display_name', `%${escapeLike(search)}%`)

    const { data: leads, count, error } = await query

    if (error) {
      return serverError(error, 'GET /api/leads')
    }

    // Fetch social profiles for all influencer IDs
    const infIds = leads?.map((l: any) => l.influencer_id).filter(Boolean) || []
    let profiles: any[] = []
    if (infIds.length > 0) {
      const { data: profData } = await supabase
        .from('social_profiles')
        .select('*')
        .in('influencer_id', infIds)
      profiles = profData || []
    }

    // Combine into frontend-friendly format
    const result = leads?.map((lead: any) => {
      const inf = lead.influencer || {}
      const profs = profiles.filter((p: any) => p.influencer_id === inf.id)
      const primary = profs[0]

      return {
        id: lead.id,
        name: inf.display_name || 'Unknown',
        handle: primary?.platform_username || '',
        category: inf.primary_niche || 'Other',
        city: inf.city || 'Unknown',
        followers: primary?.followers_count || inf.total_followers || 0,
        score: Math.round(lead.score || 0),
        scoreBreakdown: parseJsonObject(lead.score_breakdown),
        priority: mapPriority(lead.priority),
        stage: mapStage(lead.stage),
        email: primary?.contact_email || inf.email || '',
        phone: primary?.contact_phone || inf.phone || '',
        platform: mapPlatform(primary?.platform || ''),
        bio: primary?.bio || inf.bio || '',
        verified: primary?.is_verified || false,
        lastActive: formatTimeAgo(lead.updated_at),
        avatar: getInitials(inf.display_name || ''),
        socialLinks: profs.map((p: any) => ({
          platform: mapPlatform(p.platform),
          url: p.profile_url || '',
          handle: p.platform_username,
          followers: p.followers_count,
          verified: p.is_verified,
        })),
        discoveryTool: mapTool(primary?.source_tool || ''),
        accountCategory: accountCategoryOf(primary?.source_metadata),
        engagementRate: engagementOf(primary),
        discoveredAt: formatDate(inf.created_at),
        assignedAgent: lead.assigned_to || lead.assigned_agent || 'Unassigned',
      }
    }) || []

    return NextResponse.json({ data: result, count: count || 0 })
  } catch (error) {
    return serverError(error, 'GET /api/leads')
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasServiceRole) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is required for lead writes.' },
        { status: 503 }
      )
    }
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const parsed = leadCreateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest(parsed.error)
    const body = parsed.data

    // First create or find the influencer
    const { data: inf, error: infError } = await supabase
      .from('influencers')
      .upsert({
        display_name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        city: body.city || null,
        primary_niche: body.category || null,
        bio: body.bio || null,
        country: 'SAU',
        status: 'discovered',
        is_brand_safe: true,
      }, { onConflict: 'email' })
      .select('id')
      .single()

    if (infError || !inf) {
      return serverError(infError, 'POST /api/leads (influencer upsert)')
    }

    // Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        influencer_id: inf.id,
        priority: 'medium',
        source: body.source || 'manual_search',
        stage: 'new',
      })
      .select()
      .single()

    if (leadError) {
      return serverError(leadError, 'POST /api/leads (lead insert)')
    }

    return NextResponse.json({ data: lead }, { status: 201 })
  } catch (error) {
    return serverError(error, 'POST /api/leads')
  }
}

function mapPriority(p: string): string {
  const map: Record<string, string> = { critical: 'Hot', high: 'High', medium: 'Normal', low: 'Low' }
  return map[p] || 'Normal'
}
function mapStage(s: string): string {
  const map: Record<string, string> = { new: 'Discovered', qualified: 'Qualified', outreach_queued: 'Assigned', outreach_sent: 'Contacted', engaged: 'Replied', closed_won: 'Registered' }
  return map[s] || 'Discovered'
}
function mapPlatform(p: string): string {
  const map: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitter: 'X (Twitter)', snapchat: 'Snapchat' }
  return map[p] || p || 'Unknown'
}
function mapTool(t: string): string {
  const map: Record<string, string> = {
    browser_extension: 'Risha Agent (Extension)',
    instagram_agent: 'Stealth Browser Agent',
    self_scrape: 'Self-hosted Scraper',
    crawl4ai: 'Crawl4AI',
    scrapling: 'Scrapling',
    'browser-use': 'Browser-use',
    apify_instagram: 'Apify Instagram Scraper',
    apify_tiktok: 'Apify TikTok Scraper',
    manual: 'Manual Import',
  }
  return map[t] || 'Self-hosted Scraper'
}
function getInitials(n: string): string { return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
function formatDate(d?: string): string { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A' }
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

function clampInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function escapeLike(value: string) {
  return value.trim().replace(/[%_\\]/g, '\\$&')
}

/** Real engagement rate — from the column (if Migration 003 ran) or metadata JSON. */
function engagementOf(profile?: { engagement_rate?: number; source_metadata?: string }): number {
  if (!profile) return 0
  if (typeof profile.engagement_rate === 'number' && profile.engagement_rate > 0) {
    return Math.round(profile.engagement_rate * 100) / 100
  }
  const meta = parseJsonObject(profile.source_metadata) as Record<string, unknown>
  const er = meta.engagementRate
  return typeof er === 'number' && er > 0 ? Math.round(er * 100) / 100 : 0
}

/** The AI persona (influencer/celebrity/artist…) or IG category captured in metadata. */
function accountCategoryOf(sourceMetadata?: string): string {
  const meta = parseJsonObject(sourceMetadata) as Record<string, unknown>
  if (typeof meta.persona === 'string' && meta.persona && meta.persona !== 'unknown') {
    return meta.persona
  }
  const cat = meta.accountCategory
  return typeof cat === 'string' ? cat : ''
}

function parseJsonObject(value?: string) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
