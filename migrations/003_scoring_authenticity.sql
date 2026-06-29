-- ============================================================================
-- Risha 360 — Migration 003: Persist full scoring + authenticity signals
-- ----------------------------------------------------------------------------
-- The previous save_discovered_candidate only persisted total/followers/
-- saudiRelevance/contactAvailability and never wrote engagement, brand safety,
-- or fake-follower signals — even though the columns already exist.
--
-- This migration replaces the function so the new TypeScript scoring engine's
-- output is fully persisted:
--   influencers:      engagement_score, commercial_value_score,
--                     brand_safety_score, signup_probability_score,
--                     avg_engagement_rate
--   social_profiles:  engagement_rate, is_fake_followers_suspected,
--                     fake_followers_percentage
--
-- Safe to run multiple times (CREATE OR REPLACE).
-- ============================================================================

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
    v_total FLOAT := COALESCE((p_score->>'total')::FLOAT, 0);
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
            engagement_score, saudi_relevance_score, commercial_value_score,
            contact_availability_score, brand_safety_score,
            signup_probability_score, avg_engagement_rate, status,
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
            v_total,
            COALESCE((p_score->>'followers')::FLOAT, 0),
            COALESCE((p_score->>'engagement')::FLOAT, 0),
            COALESCE((p_score->>'saudiRelevance')::FLOAT, 0),
            COALESCE((p_score->>'commercialValue')::FLOAT, 0),
            COALESCE((p_score->>'contactAvailability')::FLOAT, 0),
            COALESCE((p_score->>'brandSafety')::FLOAT, 0),
            COALESCE((p_score->>'signupProbability')::FLOAT, 0),
            COALESCE((p_score->>'engagementRate')::FLOAT, 0),
            CASE WHEN v_total >= 60 THEN 'scored' ELSE 'discovered' END,
            (p_candidate->>'platform') || '_search',
            'discovery_orchestrator',
            NOT COALESCE((p_score->>'isFakeFollowersSuspected')::BOOLEAN, FALSE)
        )
        RETURNING id INTO v_influencer_id;

        INSERT INTO social_profiles (
            influencer_id, platform, platform_username, platform_display_name,
            profile_url, profile_image_url, is_verified, followers_count,
            following_count, posts_count, bio, bio_links, contact_email,
            source_tool, fetched_by_agent, source_url, source_metadata,
            engagement_rate, is_fake_followers_suspected, fake_followers_percentage,
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
            COALESCE((v_profile->>'engagement_rate')::FLOAT, 0),
            COALESCE((v_profile->>'is_fake_followers_suspected')::BOOLEAN, FALSE),
            COALESCE((v_profile->>'fake_followers_percentage')::FLOAT, 0),
            NOW(),
            COALESCE((v_profile->>'data_completeness')::FLOAT, 0.4)
        );
    ELSE
        -- Re-discovered: refresh profile signals AND re-score the influencer.
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
            engagement_rate = COALESCE((v_profile->>'engagement_rate')::FLOAT, engagement_rate),
            is_fake_followers_suspected = COALESCE((v_profile->>'is_fake_followers_suspected')::BOOLEAN, is_fake_followers_suspected),
            fake_followers_percentage = COALESCE((v_profile->>'fake_followers_percentage')::FLOAT, fake_followers_percentage),
            last_synced_at = NOW(),
            data_completeness = COALESCE((v_profile->>'data_completeness')::FLOAT, data_completeness)
        WHERE id = v_profile_id;

        UPDATE influencers
        SET total_score = v_total,
            followers_score = COALESCE((p_score->>'followers')::FLOAT, followers_score),
            engagement_score = COALESCE((p_score->>'engagement')::FLOAT, engagement_score),
            saudi_relevance_score = COALESCE((p_score->>'saudiRelevance')::FLOAT, saudi_relevance_score),
            commercial_value_score = COALESCE((p_score->>'commercialValue')::FLOAT, commercial_value_score),
            contact_availability_score = COALESCE((p_score->>'contactAvailability')::FLOAT, contact_availability_score),
            brand_safety_score = COALESCE((p_score->>'brandSafety')::FLOAT, brand_safety_score),
            signup_probability_score = COALESCE((p_score->>'signupProbability')::FLOAT, signup_probability_score),
            avg_engagement_rate = COALESCE((p_score->>'engagementRate')::FLOAT, avg_engagement_rate),
            is_brand_safe = NOT COALESCE((p_score->>'isFakeFollowersSuspected')::BOOLEAN, FALSE)
        WHERE id = v_influencer_id;
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
                WHEN v_total >= 80 THEN 'critical'
                WHEN v_total >= 60 THEN 'high'
                ELSE 'medium'
            END,
            'ai_discovery',
            CASE WHEN v_total >= 60 THEN 'qualified' ELSE 'new' END,
            v_total,
            p_score::TEXT,
            NOW(),
            p_batch_id,
            LEFT(COALESCE(p_plan->'queries', '[]'::JSONB)::TEXT, 500),
            jsonb_build_object(
                'platform', p_candidate->>'platform',
                'source', 'search_engine',
                'tier', p_score->>'tier',
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
