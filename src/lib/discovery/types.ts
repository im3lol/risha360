export type DiscoveryPlatform = 'instagram' | 'tiktok'

export type DiscoveryStage =
  | 'planned'
  | 'searching'
  | 'processing'
  | 'completed'
  | 'failed'

export interface SearchPlan {
  version: 1
  category: string
  city: string
  platforms: DiscoveryPlatform[]
  minFollowers: number
  maxFollowers?: number
  country?: string
  targetCount: number
  queries: string[]
  hashtags: string[]
  createdAt: string
  planner?: 'gemini' | 'openrouter' | 'openai' | 'deterministic'
  rationale?: string
}

export type DiscoverySourceKind = 'apify' | 'self_scrape' | 'browser_session'

export interface ProviderRun {
  platform: DiscoveryPlatform
  actorId: string
  runId: string
  datasetId?: string
  status: string
  /** Which discovery backend produced this run. Absent = legacy Apify run. */
  source?: DiscoverySourceKind
  /** Self-scrape / browser runs carry the plan inputs needed to collect later. */
  queries?: string[]
  hashtags?: string[]
  niche?: string
  targetCount?: number
  minFollowers?: number
}

export interface DiscoveryAgentConfig {
  stage: DiscoveryStage
  plan: SearchPlan
  runs: ProviderRun[]
  currentStep: string
  lastSyncedAt?: string
}

export interface DiscoveryAgentSettings {
  enabled: boolean
  interval_minutes: number
  categories: string
  cities: string
  platforms: string
  target_count: number
  min_followers: number
  max_active_batches: number
  // Dashboard-controlled data filters + LLM config (migration 004).
  max_followers?: number | null
  country?: string
  custom_instructions?: string | null
  planner_provider?: string
  openrouter_api_key?: string | null
  openrouter_model?: string | null
  openrouter_vision_model?: string | null
  gemini_api_key?: string | null
  gemini_model?: string | null
  last_tick_at?: string
  last_started_at?: string
  next_run_at?: string
  tick_locked_until?: string
  last_error?: string
  total_runs: number
  updated_at?: string
}

export interface DiscoveredCandidate {
  platform: DiscoveryPlatform
  username: string
  displayName: string
  bio: string
  profileUrl: string
  profileImageUrl?: string
  followers: number
  following?: number
  posts?: number
  verified: boolean
  website?: string
  contactEmail?: string
  enrichment?: {
    provider: 'scrapling' | 'crawl4ai' | 'browser-use'
    sourceUrl: string
    retrievedAt: string
    textSnippet?: string
  }
  sourceMetadata: Record<string, unknown>
}
