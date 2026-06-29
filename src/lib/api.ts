import type {
  CategoryDistribution,
  DiscoveryBatch,
  FunnelData,
  Lead,
  OutreachMessage,
  AgentTask,
} from './domain-types'
import { supabase } from './supabase'
import type { DiscoveryAgentSettings } from './discovery/types'

type ApiEnvelope<T> = {
  data: T
  count?: number
  error?: string
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(options?.headers)
  headers.set('Content-Type', 'application/json')

  if (data.session?.access_token) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`)
  }
  return payload
}

export async function getLeads(filters?: {
  priority?: string
  stage?: string
  niche?: string
  city?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ data: Lead[]; count: number }> {
  const params = new URLSearchParams()
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const result = await apiFetch<ApiEnvelope<Lead[]>>(`/api/leads?${params}`)
  return { data: result.data, count: result.count || 0 }
}

export function deleteLead(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/leads/${id}`, { method: 'DELETE' })
}

export interface CleanupResult {
  dryRun: boolean
  scanned: number
  flagged: number
  removed: number
  samples: { influencerId: string; handle: string; reason: string }[]
}

export function cleanupNonPersons(dryRun = false) {
  return apiFetch<CleanupResult>('/api/leads/cleanup', {
    method: 'POST',
    body: JSON.stringify({ dryRun }),
  })
}

export async function getDiscoveryBatches(): Promise<DiscoveryBatch[]> {
  const result = await apiFetch<ApiEnvelope<DiscoveryBatch[]>>('/api/batches')
  return result.data
}

export async function createDiscoveryBatch(batch: {
  name: string
  platforms: string
  niches?: string
  keywords?: string
  location_filter?: string
  min_followers?: number
  max_followers?: number
  target_count: number
}) {
  const result = await apiFetch<ApiEnvelope<Record<string, unknown>>>('/api/batches', {
    method: 'POST',
    body: JSON.stringify(batch),
  })
  return result.data
}

export function runDiscoveryBatch(batchId: string) {
  return apiFetch<{ success: boolean }>(`/api/batches/${batchId}/run`, {
    method: 'POST',
  })
}

export function syncDiscoveryBatch(batchId: string) {
  return apiFetch<{ data: unknown; result?: unknown }>(`/api/batches/${batchId}/sync`, {
    method: 'POST',
  })
}

export function getDiscoveryConfig() {
  return apiFetch<{
    discoverySource: {
      active: 'apify' | 'self_scrape' | 'browser_session'
      configured: boolean
    }
    providers: {
      apify: {
        configured: boolean
        instagramActor: string
        tiktokActor: string
      }
        aiPlanner: {
          configured: boolean
          provider: string
          model: string
          mode: string
        }
        scrapling: {
          configured: boolean
        }
        crawl4ai: {
          configured: boolean
        }
        browserUse: {
          configured: boolean
        }
      }
  }>('/api/discovery/config')
}

export interface AgentDecision {
  id: string
  message: string
  category: string | null
  city: string | null
  minFollowers: number | null
  reason: string | null
  batchId: string | null
  createdAt: string
}

export interface LiveActivity {
  status: {
    enabled: boolean
    running: boolean
    currentStep: string | null
    activeBatch: string | null
    lastTick: string | null
    nextRun: string | null
    lastError: string | null
  }
  events: { id: string; type: string; message: string; at: string; createdAt: string }[]
}

export function getLiveActivity(limit = 30): Promise<LiveActivity> {
  return apiFetch<LiveActivity>(`/api/discovery/activity?limit=${limit}`)
}

export async function getAgentDecisions(limit = 20): Promise<AgentDecision[]> {
  const result = await apiFetch<ApiEnvelope<AgentDecision[]>>(
    `/api/discovery/decisions?limit=${limit}`
  )
  return result.data
}

export function getDiscoveryAgent() {
  return apiFetch<{
    settings: DiscoveryAgentSettings
    providers: {
      discoverySource: 'apify' | 'self_scrape' | 'browser_session'
      discoveryReady: boolean
      plannerProvider: 'gemini' | 'openrouter' | null
    }
  }>('/api/agent')
}

export function updateDiscoveryAgent(settings: Record<string, unknown>) {
  return apiFetch<{ settings: DiscoveryAgentSettings }>('/api/agent', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function runDiscoveryAgentNow() {
  return apiFetch<{ result: { status: string; message?: string } }>('/api/agent', {
    method: 'POST',
    body: JSON.stringify({ action: 'run_now' }),
  })
}

export async function getOutreachMessages(): Promise<OutreachMessage[]> {
  const result = await apiFetch<ApiEnvelope<OutreachMessage[]>>('/api/outreach')
  return result.data
}

async function outreachAction(
  action: string,
  messageId: string,
  conversationId: string,
  extra?: Record<string, unknown>
) {
  return apiFetch<{ success: boolean }>('/api/outreach', {
    method: 'POST',
    body: JSON.stringify({ action, messageId, conversationId, ...extra }),
  })
}

export function approveOutreachMessage(messageId: string, conversationId: string) {
  return outreachAction('approve', messageId, conversationId)
}

export function rejectOutreachMessage(
  messageId: string,
  conversationId: string,
  feedback?: string
) {
  return outreachAction('reject', messageId, conversationId, { feedback })
}

export function updateOutreachMessage(
  messageId: string,
  conversationId: string,
  body: string
) {
  return outreachAction('edit', messageId, conversationId, { body })
}

export function markOutreachMessageSent(messageId: string, conversationId: string) {
  return outreachAction('send', messageId, conversationId)
}

export async function getAgentTasks(): Promise<AgentTask[]> {
  const result = await apiFetch<ApiEnvelope<AgentTask[]>>('/api/tasks')
  return result.data
}

export async function getFunnelData(): Promise<FunnelData[]> {
  const result = await apiFetch<{
    stats?: { funnelData?: FunnelData[] }
  }>('/api/stats')
  return result.stats?.funnelData || []
}

export async function getCategoryDistribution(): Promise<CategoryDistribution[]> {
  const result = await apiFetch<{
    stats?: { categoryDistribution?: CategoryDistribution[] }
  }>('/api/stats')
  return result.stats?.categoryDistribution || []
}
