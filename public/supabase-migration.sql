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

INSERT INTO discovery_agent_settings (singleton) VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

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

REVOKE ALL ON influencers, social_profiles, discovery_batches, leads, conversations, messages, agent_tasks, activity_log FROM anon;
REVOKE ALL ON discovery_agent_settings FROM anon;
GRANT SELECT ON influencers, social_profiles, discovery_batches, discovery_agent_settings, leads, conversations, messages, agent_tasks, activity_log TO authenticated;

CREATE POLICY "Authenticated read influencers" ON influencers FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read social profiles" ON social_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read discovery batches" ON discovery_batches FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read discovery agent settings" ON discovery_agent_settings FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read leads" ON leads FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read conversations" ON conversations FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read messages" ON messages FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read agent tasks" ON agent_tasks FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Authenticated read activity log" ON activity_log FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables
CREATE TRIGGER update_influencers_updated_at BEFORE UPDATE ON influencers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_profiles_updated_at BEFORE UPDATE ON social_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discovery_batches_updated_at BEFORE UPDATE ON discovery_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE influencers;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE discovery_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
