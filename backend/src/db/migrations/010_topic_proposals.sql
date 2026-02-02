-- Migration: Topic Proposals & Generator Settings
-- Replaces individual story angle generation with aggregated topic proposals

-- ============================================================================
-- Topic Proposals Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS topic_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Content
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  audience_care_statement TEXT,
  talking_points JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{point, supporting_detail, duration_estimate_seconds, audience_framing}]

  research_citations JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{title, url, source_type, snippet, accessed_at, relevance_to_audience}]

  -- Clustering metadata
  source_story_ids JSONB NOT NULL DEFAULT '[]',
  cluster_theme TEXT,
  cluster_keywords JSONB DEFAULT '[]',

  -- Duration configuration
  duration_type VARCHAR(20) CHECK (duration_type IN ('short', 'standard', 'long', 'custom')) NOT NULL,
  duration_seconds INT NOT NULL,

  -- Generation metadata
  generation_trigger VARCHAR(20) CHECK (generation_trigger IN ('auto', 'manual')) NOT NULL,
  audience_profile_id UUID REFERENCES audience_profiles(id) ON DELETE SET NULL,
  comparison_regions JSONB DEFAULT '[]',

  -- Trending/social context used in generation
  trending_context JSONB DEFAULT '[]',
  -- Structure: [{trend_query, platforms, viral_posts}]

  -- Status workflow
  status VARCHAR(20) CHECK (status IN ('draft', 'reviewed', 'approved', 'rejected', 'archived')) DEFAULT 'draft',
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_topic_proposals_project ON topic_proposals(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_proposals_status ON topic_proposals(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_proposals_audience ON topic_proposals(audience_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_proposals_trigger ON topic_proposals(generation_trigger, created_at DESC);

-- ============================================================================
-- Topic Generator Settings Table (per project)
-- ============================================================================
CREATE TABLE IF NOT EXISTS topic_generator_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE REFERENCES projects(id) ON DELETE CASCADE NOT NULL,

  -- Auto-generation settings
  auto_generation_enabled BOOLEAN DEFAULT true,
  auto_generation_time TIME DEFAULT '06:00:00',
  auto_generation_timezone VARCHAR(50) DEFAULT 'Asia/Singapore',

  -- Story aggregation settings
  time_window_days INT DEFAULT 7 CHECK (time_window_days BETWEEN 1 AND 30),
  min_stories_for_cluster INT DEFAULT 2 CHECK (min_stories_for_cluster >= 1),
  max_proposals_per_run INT DEFAULT 5 CHECK (max_proposals_per_run BETWEEN 1 AND 20),

  -- Content focus
  focus_categories JSONB DEFAULT '[]',
  -- e.g., ["Politics", "Technology", "Business", "Social Issues"]

  -- Default comparison regions
  comparison_regions JSONB DEFAULT '["Singapore", "Malaysia", "United States"]',

  -- Default duration
  default_duration_type VARCHAR(20) DEFAULT 'standard' CHECK (default_duration_type IN ('short', 'standard', 'long', 'custom')),
  default_duration_seconds INT DEFAULT 180,

  -- Default audience profile for auto-generation
  default_audience_profile_id UUID REFERENCES audience_profiles(id) ON DELETE SET NULL,

  -- Include social trends in generation
  include_trending_context BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Topic Clusters Cache Table (optional - for preview before generation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS topic_clusters_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  audience_profile_id UUID REFERENCES audience_profiles(id) ON DELETE CASCADE,

  -- Cluster data
  clusters JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{theme, keywords, storyIds, relevanceScore, audienceRelevance}]

  -- Source data checksums (to detect stale cache)
  stories_hash VARCHAR(64),
  trends_hash VARCHAR(64),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_topic_clusters_cache_project ON topic_clusters_cache(project_id, audience_profile_id, created_at DESC);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE topic_proposals IS 'AI-generated topic proposals aggregated from flagged stories, tailored to audience profiles';
COMMENT ON TABLE topic_generator_settings IS 'Per-project settings for topic proposal generation';
COMMENT ON TABLE topic_clusters_cache IS 'Cached story clusters for preview before proposal generation';

COMMENT ON COLUMN topic_proposals.talking_points IS 'JSON array: [{point, supporting_detail, duration_estimate_seconds, audience_framing}]';
COMMENT ON COLUMN topic_proposals.research_citations IS 'JSON array: [{title, url, source_type, snippet, accessed_at, relevance_to_audience}]';
COMMENT ON COLUMN topic_proposals.duration_type IS 'short (1-2min), standard (3-4min), long (5-10min), custom';
COMMENT ON COLUMN topic_generator_settings.focus_categories IS 'Filter which news categories to include in clustering';
