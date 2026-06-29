import {
  discoveryReadinessMessage,
  getDiscoverySource,
  getRun,
  getRunCandidates,
  isDiscoveryConfigured,
  startSearchRun,
} from './source'
import { enrichCandidates } from './enrichment'
import { createIntelligentSearchPlan, createSearchPlan } from './query-planner'
import { saveCandidates } from './storage'
import { mapAgentProfile, type AgentProfile } from './browser-session'
import { decideNextAction, type AgentState, type RoundStat } from './agent-brain'
import { buildCreatorNameQueries } from './query-planner'
import { applyAgentConfig } from './runtime-config'
import type {
  DiscoveredCandidate,
  DiscoveryAgentConfig,
  DiscoveryAgentSettings,
  DiscoveryPlatform,
  SearchPlan,
} from './types'
import { supabaseServer as supabase } from '@/lib/supabase-server'

const terminalStatuses = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'])

export async function createBatch(input: {
  name: string
  category: string
  city: string
  platforms: string[]
  minFollowers: number
  maxFollowers?: number
  targetCount: number
  country?: string
  customInstructions?: string
  extraKeywords?: string
  triggeredBy: 'manual' | 'autonomous_agent'
  offset?: number
}) {
  const plan = await createIntelligentSearchPlan({
    category: input.category,
    city: input.city,
    platforms: ['instagram'],
    minFollowers: input.minFollowers,
    targetCount: input.targetCount,
    extraKeywords: input.extraKeywords,
  })
  plan.maxFollowers = input.maxFollowers
  plan.country = input.country

  // Autonomous runs search by real creator NAMES (the only queries that surface
  // diverse real creators — generic keywords return a fixed brand-heavy set and
  // the similar-accounts graph is disabled). Rotates by offset so each run hits
  // new creators. Curated pool is always available; Gemini expands it when set,
  // steered by the user's country + custom data instructions.
  if (input.triggeredBy === 'autonomous_agent') {
    const nameQueries = await buildCreatorNameQueries({
      category: input.category,
      city: input.city,
      country: input.country,
      instructions: input.customInstructions,
      offset: input.offset ?? 0,
      count: 10,
    })
    if (nameQueries.length) plan.queries = nameQueries
  }
  const config: DiscoveryAgentConfig = {
    stage: 'planned',
    plan,
    runs: [],
    currentStep: isDiscoveryConfigured()
      ? `${plan.planner === 'deterministic' ? 'Template' : 'AI'} search plan ready`
      : discoveryReadinessMessage(),
  }

  const { data, error } = await supabase
    .from('discovery_batches')
    .insert({
      name: input.name,
      platforms: plan.platforms.join(','),
      niches: input.category,
      keywords: plan.queries.join(','),
      hashtags: plan.hashtags.join(','),
      location_filter: input.city,
      min_followers: plan.minFollowers,
      target_count: plan.targetCount,
      status: 'pending',
      scraping_tools: getDiscoverySource(),
      ai_query: `${plan.category} creators in ${plan.city}`,
      agent_config: JSON.stringify(config),
      triggered_by: input.triggeredBy,
      triggered_by_agent: 'discovery_director',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Ingest pre-harvested profiles (from the browser extension running in the
 * operator's real, logged-in session) straight into the scoring + storage
 * pipeline — no server-side scraping, no proxy needed.
 */
export async function ingestCandidates(input: {
  platform?: 'instagram' | 'tiktok'
  category: string
  city: string
  minFollowers?: number
  candidates: AgentProfile[]
}) {
  const platform = input.platform === 'tiktok' ? 'tiktok' : 'instagram'
  const plan = createSearchPlan({
    category: input.category || 'Other',
    city: input.city || 'All',
    platforms: [platform],
    minFollowers: input.minFollowers ?? 0,
    targetCount: Math.max(input.candidates.length, 1),
  })

  const { data: batch, error } = await supabase
    .from('discovery_batches')
    .insert({
      name: `${plan.city} ${plan.category} ${platform} Extension Harvest`,
      platforms: platform,
      niches: plan.category,
      keywords: plan.queries.join(','),
      location_filter: plan.city,
      min_followers: plan.minFollowers,
      target_count: plan.targetCount,
      status: 'processing',
      scraping_tools: 'browser_extension',
      ai_query: `${plan.category} creators in ${plan.city}`,
      triggered_by: 'manual',
      triggered_by_agent: 'browser_extension',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error || !batch) throw error || new Error('Failed to create ingest batch')

  const mapped = input.candidates
    .map((p) => mapAgentProfile({ ...p, platform: p.platform || platform }))
    .filter((c): c is DiscoveredCandidate => c !== null)
    .map((c) => ({
      ...c,
      // These came from the browser extension running in the operator's session.
      sourceMetadata: { ...c.sourceMetadata, source: 'browser_extension', sourceTool: 'browser_extension' },
    }))

  const result = await saveCandidates(batch.id, plan, mapped)
  const { data: routed } = await supabase.rpc('route_qualified_leads_to_sales', {
    p_batch_id: batch.id,
  })
  const routedCount = Number(routed || 0)

  await supabase
    .from('discovery_batches')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_profiles_found: result.found,
      profiles_processed: result.found,
      profiles_scored: result.created,
      leads_created: result.created,
      errors_count: result.errors,
    })
    .eq('id', batch.id)

  await logActivity(
    'batch',
    `Extension harvest: ${result.found} profiles, ${result.created} leads created, ${routedCount} routed`,
    'discovery_batch',
    batch.id,
    { found: result.found, created: result.created, routed: routedCount }
  )

  return { batchId: batch.id, ...result, routed: routedCount }
}

export async function startBatch(id: string) {
  if (!isDiscoveryConfigured()) throw new Error(discoveryReadinessMessage())

  const batch = await getBatch(id)
  const config = parseConfig(batch.agent_config) || {
    stage: 'planned' as const,
    plan: createSearchPlan({
      category: batch.niches?.split(',')[0] || 'Other',
      city: batch.location_filter || 'All',
      platforms: batch.platforms?.split(',').filter(Boolean) || ['instagram'],
      minFollowers: batch.min_followers || 20000,
      targetCount: batch.target_count || 100,
      extraKeywords: batch.keywords,
    }),
    runs: [],
    currentStep: 'Search plan ready',
  }

  if (config.runs.some((run) => ['READY', 'RUNNING'].includes(run.status))) {
    throw new Error('This batch is already running')
  }

  const runs = await Promise.all(
    config.plan.platforms.map((platform) => startSearchRun(platform, config.plan))
  )
  const nextConfig: DiscoveryAgentConfig = {
    ...config,
    stage: 'searching',
    runs,
    currentStep: 'Searching platforms for matching creator profiles',
    lastSyncedAt: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('discovery_batches')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      agent_config: JSON.stringify(nextConfig),
    })
    .eq('id', id)
  if (error) throw error

  await supabase.from('agent_tasks').insert({
    agent_type: 'discovery',
    task_name: `Search: ${batch.name}`,
    status: 'running',
    discovery_batch_id: id,
    progress: 10,
    current_step: nextConfig.currentStep,
    total_steps: 4,
    completed_steps: 1,
    input_data: JSON.stringify(config.plan),
    output_data: JSON.stringify({ runs }),
    started_at: new Date().toISOString(),
    priority: 8,
  })

  await logActivity('batch', `Started discovery batch: ${batch.name}`, 'discovery_batch', id)

  return runs
}

export async function syncBatch(id: string) {
  const batch = await getBatch(id)
  const config = parseConfig(batch.agent_config)
  if (!config?.runs.length) throw new Error('Batch has no provider runs')

  const runs = await Promise.all(config.runs.map(getRun))
  const failed = runs.some((run) => ['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status))
  const finished = runs.every((run) => terminalStatuses.has(run.status))

  if (failed) {
    const nextConfig: DiscoveryAgentConfig = {
      ...config,
      runs,
      stage: 'failed',
      currentStep: 'One or more search providers failed',
      lastSyncedAt: new Date().toISOString(),
    }
    await supabase.from('discovery_batches').update({
      status: 'failed',
      errors_count: (batch.errors_count || 0) + 1,
      error_log: runs.map((run) => `${run.platform}: ${run.status}`).join('\n'),
      agent_config: JSON.stringify(nextConfig),
    }).eq('id', id)
    return { config: nextConfig }
  }

  if (!finished) {
    const nextConfig: DiscoveryAgentConfig = {
      ...config,
      runs,
      stage: 'searching',
      currentStep: 'Search providers are still collecting profiles',
      lastSyncedAt: new Date().toISOString(),
    }
    await supabase.from('discovery_batches')
      .update({ agent_config: JSON.stringify(nextConfig) })
      .eq('id', id)
    return { config: nextConfig }
  }

  await supabase.from('discovery_batches').update({ status: 'processing' }).eq('id', id)
  try {
  await logActivity(
    'agent',
    `🔎 بدأ البحث: بفحص ${config.plan.queries.length} اسم/كلمة في ${config.plan.category}/${config.plan.city} (متابعين ≥ ${config.plan.minFollowers.toLocaleString()})…`,
    'discovery_batch',
    id
  )
  const candidateGroups = await Promise.all(runs.map(getRunCandidates))
  await upsertPipelineTask(id, 'enrichment', 'running', {
    progress: 30,
    current_step: 'Scraping discovered Instagram profile pages',
    total_steps: 3,
    completed_steps: 1,
  })
  const candidates = await enrichCandidates(candidateGroups.flat())
  await logActivity(
    'agent',
    `👁️ فحص ${candidates.length} حساب — بيقيّم ويحفظ المؤثرين الحقيقيين…`,
    'discovery_batch',
    id
  )
  const result = await saveCandidates(id, config.plan, candidates)
  const { data: routed, error: routingError } = await supabase.rpc(
    'route_qualified_leads_to_sales',
    { p_batch_id: id }
  )
  if (routingError) throw routingError
  const routedCount = Number(routed || 0)
  await upsertPipelineTask(id, 'enrichment', 'completed', {
    progress: 100,
    current_step: `Scraped ${result.found} Instagram profiles`,
    total_steps: 3,
    completed_steps: 3,
    output_data: JSON.stringify(result),
    completed_at: new Date().toISOString(),
  })
  const nextConfig: DiscoveryAgentConfig = {
    ...config,
    runs,
    stage: 'completed',
    currentStep: `Completed: ${result.created} leads saved, ${routedCount} assigned to sales`,
    lastSyncedAt: new Date().toISOString(),
  }

  await supabase.from('discovery_batches').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    total_profiles_found: result.found,
    profiles_processed: result.found,
    profiles_deduplicated: result.updated,
    profiles_scored: result.created,
    leads_created: result.created,
    errors_count: result.errors,
    top_profiles_summary: JSON.stringify(candidates.slice(0, 10)),
    agent_config: JSON.stringify(nextConfig),
  }).eq('id', id)

  await supabase.from('agent_tasks').update({
    status: 'completed',
    progress: 100,
    current_step: nextConfig.currentStep,
    completed_steps: 4,
    output_data: JSON.stringify(result),
    completed_at: new Date().toISOString(),
  }).eq('discovery_batch_id', id).eq('agent_type', 'discovery')

  await logActivity(
    'agent',
    `✅ خلص: ${result.created} مؤثر جديد اتحفظ${result.updated ? ` (+${result.updated} تحديث)` : ''}، ${routedCount} اتوزّع على المبيعات — من ${result.found} حساب.`,
    'discovery_batch',
    id,
    { found: result.found, created: result.created, updated: result.updated, routed: routedCount }
  )

  return { config: nextConfig, result: { ...result, routed: routedCount } }
  } catch (error) {
    // Never leave a batch stuck in 'processing' — mark it failed so it isn't
    // re-synced forever on every tick.
    await supabase.from('discovery_batches').update({
      status: 'failed',
      errors_count: (batch.errors_count || 0) + 1,
      error_log: errorMessage(error),
    }).eq('id', id)
    await logActivity('batch', `Batch ${batch.name} failed during processing: ${errorMessage(error)}`, 'discovery_batch', id)
    return { config, stage: 'failed' as const, error: errorMessage(error) }
  }
}

export async function runAgentTick() {
  // Shorter lock so a slow/crashed sync can't block the 60s worker for long.
  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_discovery_agent_tick',
    { p_lock_seconds: 300 }
  )
  // Surface a real Error (Supabase errors are plain objects → otherwise the
  // route returns a generic 500 "Agent tick failed").
  if (claimError) throw new Error(claimError.message || 'claim_discovery_agent_tick failed')
  if (!claimed) return { status: 'already_running' }

  try {
    const settings = await getAgentSettings()
    applyAgentConfig(settings) // dashboard-set LLM keys/models override .env
    const now = new Date()
    await updateSettings({ last_tick_at: now.toISOString(), last_error: null })

    if (!settings.enabled) return { status: 'disabled' }
    if (!isDiscoveryConfigured()) {
      const message = `Waiting for discovery provider: ${discoveryReadinessMessage()}`
      await updateSettings({ last_error: message })
      return { status: 'waiting_for_provider', message }
    }

    const { data: active, error } = await supabase
      .from('discovery_batches')
      .select('id,status')
      .in('status', ['running', 'processing'])
      .order('created_at', { ascending: true })
    if (error) throw error

    const syncResults: unknown[] = []
    for (const batch of active || []) {
      try {
        syncResults.push(await syncBatch(batch.id))
      } catch (syncError) {
        syncResults.push({ error: errorMessage(syncError), batchId: batch.id })
      }
    }

    if ((active?.length || 0) >= settings.max_active_batches) {
      return { status: 'syncing', active: active?.length || 0, syncResults }
    }

    const nextRun = settings.next_run_at ? new Date(settings.next_run_at) : null
    if (nextRun && nextRun > now) {
      return { status: 'waiting', nextRunAt: nextRun.toISOString(), syncResults }
    }

    const next = await chooseNextSegment(settings)
    const batch = await createBatch({
      name: `${next.city} ${next.category} Autonomous Discovery`,
      category: next.category,
      city: next.city,
      platforms: ['instagram'],
      minFollowers: next.minFollowers,
      maxFollowers: settings.max_followers ?? undefined,
      targetCount: settings.target_count,
      country: settings.country,
      customInstructions: settings.custom_instructions ?? undefined,
      triggeredBy: 'autonomous_agent',
      offset: (settings.total_runs || 0) * 10,
    })
    await startBatch(batch.id)
    await logActivity(
      'agent',
      `Agent brain chose ${next.category}/${next.city} (followers ≥ ${next.minFollowers}): ${next.reason}`,
      'discovery_batch',
      batch.id,
      next
    )

    const nextRunAt = new Date(now.getTime() + settings.interval_minutes * 60_000)
    await updateSettings({
      last_started_at: now.toISOString(),
      next_run_at: nextRunAt.toISOString(),
      total_runs: (settings.total_runs || 0) + 1,
      last_error: null,
    })
    return { status: 'started', batchId: batch.id, nextRunAt: nextRunAt.toISOString() }
  } catch (error) {
    await updateSettings({ last_error: errorMessage(error) })
    throw error
  } finally {
    await updateSettings({ tick_locked_until: null })
  }
}

/**
 * Autonomous segment selection driven by the agent brain. Instead of a blind
 * `total_runs % categories.length` rotation, we feed the brain recent per-batch
 * yields so it can steer toward under-explored, high-yield segments — and away
 * from ones that have been mined dry. Always resolves to a concrete runnable
 * segment so the worker never stalls.
 */
async function chooseNextSegment(settings: DiscoveryAgentSettings): Promise<{
  category: string
  city: string
  minFollowers: number
  reason: string
}> {
  const categories = csv(settings.categories)
  const cities = csv(settings.cities)
  const candidateSegments = categories.flatMap((category) =>
    cities.map((city) => ({ category, city }))
  )
  const fallback = {
    category: categories[0] || 'Lifestyle',
    city: cities[0] || 'Riyadh',
    minFollowers: settings.min_followers,
    reason: 'Default first segment.',
  }
  if (!candidateSegments.length) return fallback

  // Recent autonomous batches → per-segment performance.
  const { data: recent } = await supabase
    .from('discovery_batches')
    .select('niches,location_filter,leads_created,total_profiles_found,profiles_deduplicated,created_at')
    .eq('triggered_by', 'autonomous_agent')
    .order('created_at', { ascending: false })
    .limit(40)

  const stats = new Map<string, { attempts: number; leads: number; lastLeads: number }>()
  const history: RoundStat[] = []
  for (const b of recent || []) {
    const key = `${b.niches}|${b.location_filter}`.toLowerCase()
    const leads = Number(b.leads_created || 0)
    const prev = stats.get(key) || { attempts: 0, leads: 0, lastLeads: leads }
    stats.set(key, { attempts: prev.attempts + 1, leads: prev.leads + leads, lastLeads: prev.lastLeads })
    history.push({
      action: 'batch',
      kept: leads,
      seen: Number(b.total_profiles_found || 0),
      duplicates: Number(b.profiles_deduplicated || 0),
    })
  }

  const segKey = (c: string, city: string) => `${c}|${city}`.toLowerCase()
  // Exhausted = tried ≥2 times with no leads on the latest run.
  const exhaustedSegments = candidateSegments
    .filter((s) => {
      const st = stats.get(segKey(s.category, s.city))
      return st && st.attempts >= 2 && st.lastLeads === 0
    })
    .map((s) => segKey(s.category, s.city))

  // Exploration order: never-tried first, then fewest attempts.
  const ordered = [...candidateSegments].sort((a, b) => {
    const sa = stats.get(segKey(a.category, a.city))?.attempts ?? -1
    const sb = stats.get(segKey(b.category, b.city))?.attempts ?? -1
    return sa - sb
  })

  const lastBatch = (recent || [])[0]
  const current = lastBatch
    ? { category: String(lastBatch.niches || ordered[0].category), city: String(lastBatch.location_filter || ordered[0].city) }
    : ordered[0]

  const platform: DiscoveryPlatform = csv(settings.platforms).includes('tiktok')
    ? 'tiktok'
    : 'instagram'

  const state: AgentState = {
    goal: { targetCount: settings.target_count, minFollowers: settings.min_followers, platform },
    segment: current,
    totals: { kept: 0, seen: 0, rounds: history.length },
    history: history.slice(0, 8),
    frontier: { queries: [], seedAccounts: [] },
    topAccounts: [],
    exhaustedSegments,
    candidateSegments: ordered,
  }

  const action = await decideNextAction(state).catch(() => null)
  // Prefer the least-explored non-exhausted segment as the safe default.
  const defaultSeg =
    ordered.find((s) => !exhaustedSegments.includes(segKey(s.category, s.city))) || ordered[0]

  if (action?.type === 'switch_segment' && action.category && action.city) {
    return { category: action.category, city: action.city, minFollowers: settings.min_followers, reason: action.reason }
  }
  if (action?.type === 'broaden') {
    return { category: defaultSeg.category, city: defaultSeg.city, minFollowers: action.minFollowers, reason: action.reason }
  }
  return {
    category: defaultSeg.category,
    city: defaultSeg.city,
    minFollowers: settings.min_followers,
    reason: action?.reason || 'Exploring least-visited segment.',
  }
}

async function upsertPipelineTask(
  batchId: string,
  agentType: string,
  status: string,
  values: Record<string, unknown>
) {
  const { data: existing } = await supabase
    .from('agent_tasks')
    .select('id')
    .eq('discovery_batch_id', batchId)
    .eq('agent_type', agentType)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('agent_tasks')
      .update({ status, ...values })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('agent_tasks').insert({
    agent_type: agentType,
    task_name: 'Instagram profile scraping and enrichment',
    status,
    discovery_batch_id: batchId,
    priority: 8,
    started_at: new Date().toISOString(),
    ...values,
  })
  if (error) throw error
}

export async function getAgentSettings(): Promise<DiscoveryAgentSettings> {
  const { data, error } = await supabase
    .from('discovery_agent_settings')
    .select('*')
    .eq('singleton', true)
    .single()
  if (error) throw error
  return data
}

export async function updateAgentSettings(
  values: Partial<Pick<DiscoveryAgentSettings,
    'enabled' | 'interval_minutes' | 'categories' | 'cities' | 'platforms' |
    'target_count' | 'min_followers' | 'max_active_batches' | 'max_followers' |
    'country' | 'custom_instructions' | 'planner_provider' | 'openrouter_api_key' |
    'openrouter_model' | 'openrouter_vision_model' | 'gemini_api_key' | 'gemini_model'>>
) {
  await updateSettings(values)
  return getAgentSettings()
}

async function updateSettings(values: Record<string, unknown>) {
  const { error } = await supabase
    .from('discovery_agent_settings')
    .update(values)
    .eq('singleton', true)
  if (error) throw error
}

async function getBatch(id: string) {
  const { data, error } = await supabase
    .from('discovery_batches')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw error || new Error('Batch not found')
  return data
}

function parseConfig(value?: string): DiscoveryAgentConfig | null {
  try {
    return value ? JSON.parse(value) as DiscoveryAgentConfig : null
  } catch {
    return null
  }
}

function csv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown discovery error'
}

/** Best-effort activity feed entry. Never throws — logging must not break the pipeline. */
async function logActivity(
  eventType: string,
  message: string,
  entityType?: string,
  entityId?: string,
  metadata?: unknown
) {
  try {
    await supabase.from('activity_log').insert({
      event_type: eventType,
      message,
      entity_type: entityType || null,
      entity_id: entityId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
  } catch {
    // intentionally swallowed
  }
}
