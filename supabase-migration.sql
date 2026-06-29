-- ============================================================
-- Risha360 Database Schema - Supabase Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for AI deduplication
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 1. INFLUENCERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS influencers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name VARCHAR(255) NOT NULL,
    real_name VARCHAR(255),
    bio TEXT,
    profile_image_url VARCHAR(1024),
    email VARCHAR(512),
    phone VARCHAR(32),
    website VARCHAR(1024),

    -- Demographics
    country VARCHAR(3) DEFAULT 'SAU',
    city VARCHAR(128),
    nationality VARCHAR(128),
    language_codes VARCHAR(255),
    gender VARCHAR(32),
    age_range VARCHAR(32),

    -- Content
    primary_niche VARCHAR(128),
    secondary_niches VARCHAR(512),
    content_languages VARCHAR(255),
    content_style VARCHAR(128),

    -- Scoring
    total_score FLOAT,
    followers_score FLOAT,
    engagement_score FLOAT,
    saudi_relevance_score FLOAT,
    commercial_value_score FLOAT,
    contact_availability_score FLOAT,
    brand_safety_score FLOAT,
    signup_probability_score FLOAT,

    -- Aggregate Metrics
    total_followers INTEGER,
    avg_engagement_rate FLOAT,

    -- Pipeline Status
    status VARCHAR(32) NOT NULL DEFAULT 'discovered',

    -- Source Attribution
    discovery_source VARCHAR(128),
    discovered_by_agent VARCHAR(128),

    -- Brand Safety
    is_brand_safe BOOLEAN NOT NULL DEFAULT TRUE,
    brand_safety_flags VARCHAR(512),

    -- Embedding
    embedding vector(1536),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for influencers
CREATE INDEX IF NOT EXISTS ix_influencers_country_status ON influencers(country, status);
CREATE INDEX IF NOT EXISTS ix_influencers_total_score ON influencers(total_score);
CREATE INDEX IF NOT EXISTS ix_influencers_primary_niche ON influencers(primary_niche);
CREATE INDEX IF NOT EXISTS ix_influencers_status_created ON influencers(status, created_at);
CREATE INDEX IF NOT EXISTS ix_influencers_email ON influencers(email);
CREATE INDEX IF NOT EXISTS ix_influencers_status ON influencers(status);

-- ============================================================
-- 2. SOCIAL PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS social_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

    -- Platform Identity
    platform VARCHAR(32) NOT NULL,
    platform_username VARCHAR(255) NOT NULL,
    platform_display_name VARCHAR(255),
    platform_user_id VARCHAR(255),
    profile_url VARCHAR(1024),
    profile_image_url VARCHAR(1024),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_business_account BOOLEAN NOT NULL DEFAULT FALSE,

    -- Follower Metrics
    followers_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,

    -- Engagement Metrics
    avg_likes FLOAT,
    avg_comments FLOAT,
    avg_shares FLOAT,
    avg_views FLOAT,
    engagement_rate FLOAT,

    -- Content Metrics
    content_frequency FLOAT,
    top_hashtags TEXT,
    content_categories VARCHAR(512),
    recent_caption TEXT,

    -- Bio
    bio TEXT,
    bio_links TEXT,

    -- Contact Info
    contact_email VARCHAR(512),
    contact_phone VARCHAR(32),
    has_contact_button BOOLEAN NOT NULL DEFAULT FALSE,

    -- Source Attribution
    source_tool VARCHAR(64) NOT NULL DEFAULT 'manual',
    fetched_by_agent VARCHAR(64) NOT NULL DEFAULT 'system',
    source_url VARCHAR(1024),
    source_metadata TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Data Freshness
    last_synced_at TIMESTAMPTZ,
    sync_count INTEGER NOT NULL DEFAULT 0,
    is_data_stale BOOLEAN NOT NULL DEFAULT FALSE,

    -- Quality Flags
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_fake_followers_suspected BOOLEAN NOT NULL DEFAULT FALSE,
    fake_followers_percentage FLOAT,
    data_completeness FLOAT NOT NULL DEFAULT 0.0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for social_profiles
CREATE UNIQUE INDEX IF NOT EXISTS ix_social_profiles_platform_username ON social_profiles(platform, platform_username);
CREATE INDEX IF NOT EXISTS ix_social_profiles_influencer_platform ON social_profiles(influencer_id, platform);
CREATE INDEX IF NOT EXISTS ix_social_profiles_source_tool ON social_profiles(source_tool);
CREATE INDEX IF NOT EXISTS ix_social_profiles_followers ON social_profiles(followers_count);

-- ============================================================
-- 3. DISCOVERY BATCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS discovery_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    -- Discovery Parameters
    platforms VARCHAR(255) NOT NULL,
    niches VARCHAR(512),
    keywords VARCHAR(1024),
    hashtags VARCHAR(1024),
    location_filter VARCHAR(128),
    language_filter VARCHAR(64),
    min_followers INTEGER,
    max_followers INTEGER,
    min_engagement_rate FLOAT,
    max_engagement_rate FLOAT,

    -- Advanced Parameters
    ai_query TEXT,
    scraping_tools VARCHAR(512),
    agent_config TEXT,

    -- Progress Tracking
    target_count INTEGER NOT NULL DEFAULT 0,
    total_profiles_found INTEGER NOT NULL DEFAULT 0,
    profiles_processed INTEGER NOT NULL DEFAULT 0,
    profiles_enriched INTEGER NOT NULL DEFAULT 0,
    profiles_deduplicated INTEGER NOT NULL DEFAULT 0,
    profiles_scored INTEGER NOT NULL DEFAULT 0,
    leads_created INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_duration_minutes FLOAT,

    -- Cost Tracking
    api_calls_made INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd FLOAT,
    tokens_used INTEGER NOT NULL DEFAULT 0,

    -- Results Summary
    top_profiles_summary TEXT,
    error_log TEXT,

    -- Triggered By
    triggered_by VARCHAR(128) NOT NULL DEFAULT 'manual',
    triggered_by_agent VARCHAR(128),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_discovery_batches_status ON discovery_batches(status);
CREATE INDEX IF NOT EXISTS ix_discovery_batches_created ON discovery_batches(created_at);

-- ============================================================
-- 3B. ALWAYS-ON DISCOVERY AGENT SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS discovery_agent_settings (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    interval_minutes INTEGER NOT NULL DEFAULT 120 CHECK (interval_minutes BETWEEN 15 AND 1440),
    categories TEXT NOT NULL DEFAULT 'Food,Fashion,Beauty,Lifestyle,Comedy,Fitness,Tech',
    cities TEXT NOT NULL DEFAULT 'Riyadh,Jeddah,Dammam,Khobar',
    platforms TEXT NOT NULL DEFAULT 'instagram,tiktok',
    target_count INTEGER NOT NULL DEFAULT 100 CHECK (target_count BETWEEN 10 AND 1000),
    min_followers INTEGER NOT NULL DEFAULT 20000 CHECK (min_followers >= 0),
    max_active_batches INTEGER NOT NULL DEFAULT 1 CHECK (max_active_batches BETWEEN 1 AND 3),
    last_tick_at TIMESTAMPTZ,
    last_started_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    tick_locked_until TIMESTAMPTZ,
    last_error TEXT,
    total_runs INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO discovery_agent_settings (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

UPDATE discovery_agent_settings
SET platforms = 'instagram',
    categories = 'Food,Fashion,Beauty,Lifestyle,Comedy,Fitness,Tech,Actor,Artist'
WHERE singleton = TRUE;

-- ============================================================
-- 3C. SALES AGENT ROSTER
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_code VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    round_robin_order INTEGER NOT NULL DEFAULT 0,
    max_active_leads INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sales_agents (agent_code, display_name, round_robin_order)
VALUES
    ('instagram-sales-01', 'Instagram Sales 01', 1),
    ('instagram-sales-02', 'Instagram Sales 02', 2),
    ('instagram-sales-03', 'Instagram Sales 03', 3)
ON CONFLICT (agent_code) DO NOTHING;

CREATE OR REPLACE FUNCTION claim_discovery_agent_tick(
    p_lock_seconds INTEGER DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    claimed BOOLEAN;
BEGIN
    UPDATE discovery_agent_settings
    SET tick_locked_until = NOW() + make_interval(
        secs => GREATEST(60, LEAST(COALESCE(p_lock_seconds, 900), 1800))
    )
    WHERE singleton = TRUE
      AND (tick_locked_until IS NULL OR tick_locked_until < NOW())
    RETURNING TRUE INTO claimed;

    RETURN COALESCE(claimed, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION claim_discovery_agent_tick(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_discovery_agent_tick(INTEGER) TO service_role;

-- ============================================================
-- 4. LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

    -- Lead Classification
    priority VARCHAR(32) NOT NULL DEFAULT 'medium',
    source VARCHAR(32) NOT NULL DEFAULT 'ai_discovery',
    stage VARCHAR(32) NOT NULL DEFAULT 'new',

    -- Scoring Snapshot
    score FLOAT,
    score_breakdown TEXT,
    score_calculated_at TIMESTAMPTZ,

    -- Outreach Tracking
    outreach_status VARCHAR(32) DEFAULT 'new',
    outreach_attempts INTEGER NOT NULL DEFAULT 0,
    last_outreach_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,

    -- Response Tracking
    responded_at TIMESTAMPTZ,
    response_sentiment VARCHAR(32),
    response_summary TEXT,

    -- Assignment
    assigned_to VARCHAR(128),
    assigned_agent VARCHAR(128),

    -- Discovery Context
    discovery_batch_id UUID REFERENCES discovery_batches(id) ON DELETE SET NULL,
    discovery_query VARCHAR(512),
    discovery_metadata TEXT,

    -- Tags and Notes
    tags VARCHAR(512),
    notes TEXT,
    internal_rating FLOAT,

    -- Conversion Tracking
    estimated_value FLOAT,
    conversion_probability FLOAT,
    closed_at TIMESTAMPTZ,
    close_reason VARCHAR(512),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_leads_priority_stage ON leads(priority, stage);
CREATE INDEX IF NOT EXISTS ix_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS ix_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS ix_leads_influencer_id ON leads(influencer_id);
CREATE INDEX IF NOT EXISTS ix_leads_outreach_status ON leads(outreach_status);
CREATE INDEX IF NOT EXISTS ix_leads_stage_created ON leads(stage, created_at);

-- ============================================================
-- 5. CONVERSATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

    -- Conversation Identity
    channel VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',

    -- Outreach State Machine
    outreach_state VARCHAR(32) NOT NULL DEFAULT 'new',
    previous_state VARCHAR(32),
    state_changed_at TIMESTAMPTZ,
    state_change_reason VARCHAR(512),

    -- Message Tracking
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    last_message_direction VARCHAR(16),

    -- Response Tracking
    first_response_at TIMESTAMPTZ,
    response_time_hours FLOAT,
    is_responded BOOLEAN NOT NULL DEFAULT FALSE,

    -- AI Generation
    ai_generated_draft TEXT,
    ai_draft_model VARCHAR(64),
    ai_draft_prompt_version VARCHAR(32),

    -- Sentiment
    overall_sentiment VARCHAR(32),
    sentiment_score FLOAT,

    -- Assignment
    assigned_to VARCHAR(128),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_conversations_influencer_channel ON conversations(influencer_id, channel);
CREATE INDEX IF NOT EXISTS ix_conversations_outreach_state ON conversations(outreach_state);
CREATE INDEX IF NOT EXISTS ix_conversations_lead_id ON conversations(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_lead_channel
ON conversations(lead_id, channel)
WHERE lead_id IS NOT NULL;

-- ============================================================
-- 6. MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Message Identity
    direction VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',

    -- Content
    subject VARCHAR(512),
    body TEXT NOT NULL,
    body_html TEXT,

    -- AI Generation Info
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    ai_model VARCHAR(64),
    ai_prompt_template VARCHAR(128),
    human_edited BOOLEAN NOT NULL DEFAULT FALSE,

    -- Compliance Checks
    compliance_checks TEXT,

    -- Delivery Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_reason VARCHAR(512),

    -- Engagement
    sentiment VARCHAR(32),
    sentiment_score FLOAT,
    intent_detected VARCHAR(64),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS ix_messages_status ON messages(status);

-- ============================================================
-- 7. AGENT TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task Identity
    agent_type VARCHAR(32) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    -- Task Parameters
    input_data TEXT,
    config TEXT,

    -- Related Entities
    influencer_id UUID,
    lead_id UUID,
    discovery_batch_id UUID,
    conversation_id UUID,

    -- Execution Tracking
    progress FLOAT NOT NULL DEFAULT 0.0,
    current_step VARCHAR(255),
    total_steps INTEGER,
    completed_steps INTEGER NOT NULL DEFAULT 0,

    -- Results
    output_data TEXT,
    error_message TEXT,
    error_traceback TEXT,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds FLOAT,

    -- Retry Logic
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- Resource Usage
    api_calls_made INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd FLOAT,

    -- Priority & Scheduling
    priority INTEGER NOT NULL DEFAULT 5,
    scheduled_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_agent_tasks_agent_status ON agent_tasks(agent_type, status);
CREATE INDEX IF NOT EXISTS ix_agent_tasks_status_priority ON agent_tasks(status, priority);
CREATE INDEX IF NOT EXISTS ix_agent_tasks_created ON agent_tasks(created_at);

-- ============================================================
-- 8. ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(64),
    entity_id UUID,
    metadata TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_activity_log_event_type ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS ix_activity_log_created ON activity_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Enable and set policies
-- ============================================================
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Dashboard records require a signed-in user. Writes are performed only by
-- trusted server routes using SUPABASE_SERVICE_ROLE_KEY.
DROP POLICY IF EXISTS "Allow full access to influencers" ON influencers;
DROP POLICY IF EXISTS "Allow full access to social_profiles" ON social_profiles;
DROP POLICY IF EXISTS "Allow full access to discovery_batches" ON discovery_batches;
DROP POLICY IF EXISTS "Allow full access to leads" ON leads;
DROP POLICY IF EXISTS "Allow full access to conversations" ON conversations;
DROP POLICY IF EXISTS "Allow full access to messages" ON messages;
DROP POLICY IF EXISTS "Allow full access to agent_tasks" ON agent_tasks;
DROP POLICY IF EXISTS "Allow full access to activity_log" ON activity_log;
DROP POLICY IF EXISTS "Public read influencers" ON influencers;
DROP POLICY IF EXISTS "Public read social profiles" ON social_profiles;
DROP POLICY IF EXISTS "Public read discovery batches" ON discovery_batches;
DROP POLICY IF EXISTS "Public read leads" ON leads;
DROP POLICY IF EXISTS "Public read conversations" ON conversations;
DROP POLICY IF EXISTS "Public read messages" ON messages;
DROP POLICY IF EXISTS "Public read agent tasks" ON agent_tasks;
DROP POLICY IF EXISTS "Public read activity log" ON activity_log;
DROP POLICY IF EXISTS "Authenticated read influencers" ON influencers;
DROP POLICY IF EXISTS "Authenticated read social profiles" ON social_profiles;
DROP POLICY IF EXISTS "Authenticated read discovery batches" ON discovery_batches;
DROP POLICY IF EXISTS "Authenticated read discovery agent settings" ON discovery_agent_settings;
DROP POLICY IF EXISTS "Authenticated read sales agents" ON sales_agents;
DROP POLICY IF EXISTS "Authenticated read leads" ON leads;
DROP POLICY IF EXISTS "Authenticated read conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated read messages" ON messages;
DROP POLICY IF EXISTS "Authenticated read agent tasks" ON agent_tasks;
DROP POLICY IF EXISTS "Authenticated read activity log" ON activity_log;

REVOKE ALL ON influencers, social_profiles, discovery_batches, discovery_agent_settings, sales_agents, leads, conversations, messages, agent_tasks, activity_log FROM anon;
GRANT SELECT ON influencers, social_profiles, discovery_batches, discovery_agent_settings, sales_agents, leads, conversations, messages, agent_tasks, activity_log TO authenticated;

CREATE POLICY "Authenticated read influencers" ON influencers FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read social profiles" ON social_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read discovery batches" ON discovery_batches FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read discovery agent settings" ON discovery_agent_settings FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read sales agents" ON sales_agents FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read leads" ON leads FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read conversations" ON conversations FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read messages" ON messages FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read agent tasks" ON agent_tasks FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read activity log" ON activity_log FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

-- Atomic server-only outreach state transition.
CREATE OR REPLACE FUNCTION apply_outreach_action(
    p_action TEXT,
    p_conversation_id UUID,
    p_message_id UUID,
    p_message_body TEXT DEFAULT NULL,
    p_feedback TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_lead_id UUID;
    v_message_count INTEGER;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM messages
        WHERE id = p_message_id AND conversation_id = p_conversation_id
    ) THEN
        RAISE EXCEPTION 'Message not found or does not belong to the conversation';
    END IF;

    SELECT lead_id, message_count
    INTO v_lead_id, v_message_count
    FROM conversations
    WHERE id = p_conversation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    CASE p_action
        WHEN 'approve' THEN
            UPDATE messages SET status = 'approved' WHERE id = p_message_id;
            UPDATE conversations
            SET outreach_state = 'approved', state_changed_at = v_now
            WHERE id = p_conversation_id;
        WHEN 'send' THEN
            UPDATE messages
            SET status = 'sent', sent_at = v_now
            WHERE id = p_message_id;
            UPDATE conversations
            SET outreach_state = 'sent',
                state_changed_at = v_now,
                last_message_at = v_now,
                last_message_direction = 'outbound',
                message_count = COALESCE(v_message_count, 0) + 1
            WHERE id = p_conversation_id;
            IF v_lead_id IS NOT NULL THEN
                UPDATE leads
                SET stage = 'outreach_sent',
                    outreach_status = 'sent',
                    last_outreach_at = v_now,
                    outreach_attempts = COALESCE(outreach_attempts, 0) + 1
                WHERE id = v_lead_id;
            END IF;
        WHEN 'edit' THEN
            IF NULLIF(BTRIM(p_message_body), '') IS NULL THEN
                RAISE EXCEPTION 'Message body is required';
            END IF;
            UPDATE messages
            SET body = BTRIM(p_message_body),
                human_edited = TRUE,
                status = 'pending_approval'
            WHERE id = p_message_id;
        WHEN 'reject' THEN
            UPDATE messages
            SET status = 'rejected',
                failed_reason = COALESCE(NULLIF(BTRIM(p_feedback), ''), 'Rejected during human review')
            WHERE id = p_message_id;
            UPDATE conversations
            SET outreach_state = 'drafting',
                state_changed_at = v_now,
                state_change_reason = COALESCE(NULLIF(BTRIM(p_feedback), ''), 'Message rejected')
            WHERE id = p_conversation_id;
        ELSE
            RAISE EXCEPTION 'Invalid outreach action';
    END CASE;
END;
$$;

REVOKE ALL ON FUNCTION apply_outreach_action(TEXT, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_outreach_action(TEXT, UUID, UUID, TEXT, TEXT) TO service_role;

-- Atomic, retry-safe discovery persistence.
CREATE OR REPLACE FUNCTION save_discovered_candidate(
    p_batch_id UUID,
    p_candidate JSONB,
    p_plan JSONB,
    p_score JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_influencer_id UUID;
    v_profile_id UUID;
    v_lead_id UUID;
    v_profile JSONB := p_candidate->'profile';
BEGIN
    SELECT id, influencer_id
    INTO v_profile_id, v_influencer_id
    FROM social_profiles
    WHERE platform = p_candidate->>'platform'
      AND LOWER(platform_username) = LOWER(p_candidate->>'username')
    FOR UPDATE;

    IF v_profile_id IS NULL THEN
        INSERT INTO influencers (
            display_name, bio, profile_image_url, email, website, country, city,
            primary_niche, total_followers, total_score, followers_score,
            saudi_relevance_score, contact_availability_score, status,
            discovery_source, discovered_by_agent, is_brand_safe
        ) VALUES (
            COALESCE(NULLIF(p_candidate->>'displayName', ''), p_candidate->>'username'),
            p_candidate->>'bio',
            NULLIF(p_candidate->>'profileImageUrl', ''),
            NULLIF(p_candidate->>'contactEmail', ''),
            NULLIF(p_candidate->>'website', ''),
            'SAU',
            p_plan->>'city',
            p_plan->>'category',
            COALESCE((p_candidate->>'followers')::INTEGER, 0),
            COALESCE((p_score->>'total')::FLOAT, 0),
            COALESCE((p_score->>'followers')::FLOAT, 0),
            COALESCE((p_score->>'saudiRelevance')::FLOAT, 0),
            COALESCE((p_score->>'contactAvailability')::FLOAT, 0),
            CASE WHEN COALESCE((p_score->>'total')::FLOAT, 0) >= 60 THEN 'scored' ELSE 'discovered' END,
            (p_candidate->>'platform') || '_search',
            'discovery_orchestrator',
            TRUE
        )
        RETURNING id INTO v_influencer_id;

        INSERT INTO social_profiles (
            influencer_id, platform, platform_username, platform_display_name,
            profile_url, profile_image_url, is_verified, followers_count,
            following_count, posts_count, bio, bio_links, contact_email,
            source_tool, fetched_by_agent, source_url, source_metadata,
            last_synced_at, data_completeness
        ) VALUES (
            v_influencer_id,
            v_profile->>'platform',
            v_profile->>'platform_username',
            v_profile->>'platform_display_name',
            v_profile->>'profile_url',
            NULLIF(v_profile->>'profile_image_url', ''),
            COALESCE((v_profile->>'is_verified')::BOOLEAN, FALSE),
            NULLIF(v_profile->>'followers_count', '')::INTEGER,
            NULLIF(v_profile->>'following_count', '')::INTEGER,
            NULLIF(v_profile->>'posts_count', '')::INTEGER,
            v_profile->>'bio',
            NULLIF(v_profile->>'bio_links', ''),
            NULLIF(v_profile->>'contact_email', ''),
            COALESCE(v_profile->>'source_tool', 'apify_search'),
            COALESCE(v_profile->>'fetched_by_agent', 'discovery_orchestrator'),
            v_profile->>'source_url',
            v_profile->>'source_metadata',
            NOW(),
            COALESCE((v_profile->>'data_completeness')::FLOAT, 0.4)
        );
    ELSE
        UPDATE social_profiles
        SET platform_display_name = v_profile->>'platform_display_name',
            profile_url = v_profile->>'profile_url',
            profile_image_url = NULLIF(v_profile->>'profile_image_url', ''),
            is_verified = COALESCE((v_profile->>'is_verified')::BOOLEAN, FALSE),
            followers_count = NULLIF(v_profile->>'followers_count', '')::INTEGER,
            following_count = NULLIF(v_profile->>'following_count', '')::INTEGER,
            posts_count = NULLIF(v_profile->>'posts_count', '')::INTEGER,
            bio = v_profile->>'bio',
            bio_links = NULLIF(v_profile->>'bio_links', ''),
            contact_email = NULLIF(v_profile->>'contact_email', ''),
            source_metadata = v_profile->>'source_metadata',
            last_synced_at = NOW(),
            data_completeness = COALESCE((v_profile->>'data_completeness')::FLOAT, data_completeness)
        WHERE id = v_profile_id;
    END IF;

    SELECT id INTO v_lead_id
    FROM leads
    WHERE influencer_id = v_influencer_id
      AND discovery_batch_id = p_batch_id
    LIMIT 1;

    IF v_lead_id IS NULL THEN
        INSERT INTO leads (
            influencer_id, priority, source, stage, score, score_breakdown,
            score_calculated_at, discovery_batch_id, discovery_query,
            discovery_metadata
        ) VALUES (
            v_influencer_id,
            CASE
                WHEN COALESCE((p_score->>'total')::FLOAT, 0) >= 80 THEN 'critical'
                WHEN COALESCE((p_score->>'total')::FLOAT, 0) >= 60 THEN 'high'
                ELSE 'medium'
            END,
            'ai_discovery',
            CASE WHEN COALESCE((p_score->>'total')::FLOAT, 0) >= 60 THEN 'qualified' ELSE 'new' END,
            COALESCE((p_score->>'total')::FLOAT, 0),
            p_score::TEXT,
            NOW(),
            p_batch_id,
            LEFT(COALESCE(p_plan->'queries', '[]'::JSONB)::TEXT, 500),
            jsonb_build_object(
                'platform', p_candidate->>'platform',
                'source', 'search_engine',
                'enrichment', p_candidate->'enrichment'
            )::TEXT
        );
        RETURN 'created';
    END IF;

    RETURN 'updated';
END;
$$;

REVOKE ALL ON FUNCTION save_discovered_candidate(UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_discovered_candidate(UUID, JSONB, JSONB, JSONB) TO service_role;

-- Assign qualified Instagram leads to the least-loaded active sales agent and
-- prepare a human-reviewed invitation draft.
CREATE OR REPLACE FUNCTION route_qualified_leads_to_sales(
    p_batch_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_lead RECORD;
    v_agent RECORD;
    v_conversation_id UUID;
    v_routed INTEGER := 0;
    v_message TEXT;
BEGIN
    FOR v_lead IN
        SELECT
            l.id AS lead_id,
            l.influencer_id,
            i.display_name,
            sp.platform_username,
            sp.profile_url
        FROM leads l
        JOIN influencers i ON i.id = l.influencer_id
        JOIN social_profiles sp ON sp.influencer_id = i.id
        WHERE l.discovery_batch_id = p_batch_id
          AND l.score >= 60
          AND l.assigned_agent IS NULL
          AND sp.platform = 'instagram'
        ORDER BY l.score DESC, l.created_at
        FOR UPDATE OF l SKIP LOCKED
    LOOP
        SELECT
            sa.agent_code,
            sa.display_name
        INTO v_agent
        FROM sales_agents sa
        WHERE sa.active = TRUE
          AND (
              SELECT COUNT(*)
              FROM leads assigned
              WHERE assigned.assigned_agent = sa.agent_code
                AND assigned.stage NOT IN ('closed_won', 'closed_lost')
          ) < sa.max_active_leads
        ORDER BY
            (
                SELECT COUNT(*)
                FROM leads assigned
                WHERE assigned.assigned_agent = sa.agent_code
                  AND assigned.stage NOT IN ('closed_won', 'closed_lost')
            ),
            sa.round_robin_order,
            sa.agent_code
        LIMIT 1;

        EXIT WHEN v_agent.agent_code IS NULL;

        UPDATE leads
        SET assigned_agent = v_agent.agent_code,
            assigned_to = v_agent.display_name,
            stage = 'outreach_queued',
            outreach_status = 'pending_approval',
            next_follow_up_at = NOW() + INTERVAL '1 day'
        WHERE id = v_lead.lead_id;

        INSERT INTO conversations (
            influencer_id, lead_id, channel, status, outreach_state,
            state_changed_at, assigned_to, ai_draft_model,
            ai_draft_prompt_version
        ) VALUES (
            v_lead.influencer_id, v_lead.lead_id, 'dm_instagram', 'active',
            'pending_approval', NOW(), v_agent.display_name,
            'workflow-template', 'risha-invite-v1'
        )
        ON CONFLICT (lead_id, channel) WHERE lead_id IS NOT NULL
        DO UPDATE SET
            assigned_to = EXCLUDED.assigned_to,
            outreach_state = 'pending_approval',
            state_changed_at = NOW()
        RETURNING id INTO v_conversation_id;

        v_message := FORMAT(
            'مرحبًا %s، معك فريق ريشة. أعجبنا محتواك على إنستغرام ونرى أنه مناسب لفرص التعاون مع العلامات التجارية على منصة ريشة. التسجيل مجاني ويمكنك إنشاء ملفك من هنا: https://risha360.com يسعدنا انضمامك والرد على أي استفسار.',
            COALESCE(NULLIF(v_lead.display_name, ''), '@' || v_lead.platform_username)
        );

        IF NOT EXISTS (
            SELECT 1 FROM messages
            WHERE conversation_id = v_conversation_id
              AND direction = 'outbound'
              AND status IN ('pending_approval', 'approved', 'sent')
        ) THEN
            INSERT INTO messages (
                conversation_id, direction, status, body, is_ai_generated,
                ai_model, ai_prompt_template, compliance_checks
            ) VALUES (
                v_conversation_id, 'outbound', 'pending_approval', v_message, TRUE,
                'workflow-template', 'risha-invite-v1',
                jsonb_build_object(
                    'noIncomePromise', TRUE,
                    'freeRegistrationMentioned', TRUE,
                    'under80Words', TRUE,
                    'arabicLocalization', TRUE,
                    'registrationUrl', 'https://risha360.com',
                    'instagramProfile', v_lead.profile_url
                )::TEXT
            );
        END IF;

        INSERT INTO agent_tasks (
            agent_type, task_name, status, lead_id, conversation_id,
            progress, current_step, total_steps, completed_steps,
            output_data, priority, started_at, completed_at
        ) VALUES (
            'sales_assignment',
            'Assign qualified Instagram lead to sales',
            'completed',
            v_lead.lead_id,
            v_conversation_id,
            100,
            'Assigned to ' || v_agent.display_name || '; invitation pending human approval',
            3,
            3,
            jsonb_build_object(
                'salesAgent', v_agent.agent_code,
                'instagramProfile', v_lead.profile_url,
                'registrationUrl', 'https://risha360.com'
            )::TEXT,
            8,
            NOW(),
            NOW()
        );

        INSERT INTO activity_log (
            event_type, message, entity_type, entity_id, metadata
        ) VALUES (
            'sales_assignment',
            COALESCE(v_lead.display_name, v_lead.platform_username) ||
                ' assigned to ' || v_agent.display_name,
            'lead',
            v_lead.lead_id,
            jsonb_build_object(
                'instagramProfile', v_lead.profile_url,
                'registrationUrl', 'https://risha360.com'
            )::TEXT
        );

        v_routed := v_routed + 1;
    END LOOP;

    RETURN v_routed;
END;
$$;

REVOKE ALL ON FUNCTION route_qualified_leads_to_sales(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION route_qualified_leads_to_sales(UUID) TO service_role;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Apply the trigger to all tables
DROP TRIGGER IF EXISTS update_influencers_updated_at ON influencers;
DROP TRIGGER IF EXISTS update_social_profiles_updated_at ON social_profiles;
DROP TRIGGER IF EXISTS update_discovery_batches_updated_at ON discovery_batches;
DROP TRIGGER IF EXISTS update_discovery_agent_settings_updated_at ON discovery_agent_settings;
DROP TRIGGER IF EXISTS update_sales_agents_updated_at ON sales_agents;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER update_influencers_updated_at BEFORE UPDATE ON influencers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_profiles_updated_at BEFORE UPDATE ON social_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discovery_batches_updated_at BEFORE UPDATE ON discovery_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discovery_agent_settings_updated_at BEFORE UPDATE ON discovery_agent_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_agents_updated_at BEFORE UPDATE ON sales_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'influencers', 'leads', 'discovery_batches',
        'conversations', 'agent_tasks', 'activity_log'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
        END IF;
    END LOOP;
END;
$$;
