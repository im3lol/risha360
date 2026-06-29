// Risha360 - Supabase Client Configuration
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types for our database
export interface InfluencerRecord {
  id: string
  display_name: string
  real_name?: string
  bio?: string
  profile_image_url?: string
  email?: string
  phone?: string
  website?: string
  country?: string
  city?: string
  nationality?: string
  language_codes?: string
  gender?: string
  age_range?: string
  primary_niche?: string
  secondary_niches?: string
  content_languages?: string
  content_style?: string
  total_score?: number
  followers_score?: number
  engagement_score?: number
  saudi_relevance_score?: number
  commercial_value_score?: number
  contact_availability_score?: number
  brand_safety_score?: number
  signup_probability_score?: number
  total_followers?: number
  avg_engagement_rate?: number
  status: string
  discovery_source?: string
  discovered_by_agent?: string
  is_brand_safe: boolean
  brand_safety_flags?: string
  created_at: string
  updated_at: string
}

export interface SocialProfileRecord {
  id: string
  influencer_id: string
  platform: string
  platform_username: string
  platform_display_name?: string
  platform_user_id?: string
  profile_url?: string
  profile_image_url?: string
  is_verified: boolean
  is_business_account: boolean
  followers_count?: number
  following_count?: number
  posts_count?: number
  avg_likes?: number
  avg_comments?: number
  engagement_rate?: number
  bio?: string
  contact_email?: string
  contact_phone?: string
  source_tool: string
  fetched_by_agent: string
  fetched_at: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeadRecord {
  id: string
  influencer_id: string
  priority: string
  source: string
  stage: string
  score?: number
  score_breakdown?: string
  outreach_status?: string
  outreach_attempts: number
  last_outreach_at?: string
  responded_at?: string
  response_sentiment?: string
  discovery_batch_id?: string
  tags?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface DiscoveryBatchRecord {
  id: string
  name: string
  description?: string
  status: string
  platforms: string
  niches?: string
  keywords?: string
  location_filter?: string
  target_count: number
  total_profiles_found: number
  profiles_processed: number
  profiles_enriched: number
  profiles_scored: number
  leads_created: number
  errors_count: number
  started_at?: string
  completed_at?: string
  triggered_by: string
  created_at: string
  updated_at: string
}

export interface ConversationRecord {
  id: string
  influencer_id: string
  lead_id?: string
  channel: string
  status: string
  outreach_state: string
  message_count: number
  last_message_at?: string
  is_responded: boolean
  ai_generated_draft?: string
  created_at: string
  updated_at: string
}

export interface MessageRecord {
  id: string
  conversation_id: string
  direction: string
  status: string
  body: string
  is_ai_generated: boolean
  compliance_checks?: string
  sent_at?: string
  created_at: string
  updated_at: string
}

export interface AgentTaskRecord {
  id: string
  agent_type: string
  task_name: string
  status: string
  input_data?: string
  output_data?: string
  error_message?: string
  progress: number
  current_step?: string
  total_steps?: number
  completed_steps: number
  started_at?: string
  completed_at?: string
  duration_seconds?: number
  retry_count: number
  priority: number
  created_at: string
  updated_at: string
}

export interface ActivityLogRecord {
  id: string
  event_type: string
  message: string
  entity_type?: string
  entity_id?: string
  metadata?: string
  created_at: string
}
