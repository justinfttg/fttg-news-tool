-- Migration: Social Listener Schema
-- Creates tables for viral posts, watched trends, and trend snapshots

-- ============================================================================
-- 1. social_posts: Individual viral posts from platforms
-- ============================================================================
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  platform VARCHAR(20) CHECK (platform IN ('x', 'reddit', 'google_trends', 'youtube', 'tiktok', 'instagram')) NOT NULL,
  external_id VARCHAR(255) NOT NULL,

  -- Content
  author_handle VARCHAR(255),
  author_name VARCHAR(255),
  author_followers INT,
  content TEXT NOT NULL,
  post_url TEXT,
  media_urls JSONB DEFAULT '[]',

  -- Engagement metrics
  likes INT DEFAULT 0,
  reposts INT DEFAULT 0,
  comments INT DEFAULT 0,
  views INT DEFAULT 0,
  engagement_score INT GENERATED ALWAYS AS (likes + (reposts * 2) + (comments * 3)) STORED,

  -- Classification
  hashtags JSONB DEFAULT '[]',
  topics JSONB DEFAULT '[]',
  region VARCHAR(50),
  category VARCHAR(50),

  -- Timestamps
  posted_at TIMESTAMP,
  scraped_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_engagement ON social_posts(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_hashtags ON social_posts USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_social_posts_region ON social_posts(region, scraped_at DESC);

-- ============================================================================
-- 2. watched_trends: User-saved topics for persistent monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS watched_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,

  -- What to watch
  query TEXT NOT NULL,
  query_type VARCHAR(20) CHECK (query_type IN ('hashtag', 'keyword', 'phrase')) NOT NULL DEFAULT 'keyword',

  -- Configuration
  platforms JSONB DEFAULT '["reddit", "google_trends", "x"]',
  regions JSONB DEFAULT '["global"]',
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_scraped_at TIMESTAMP,

  -- Prevent duplicate watches per user/project
  UNIQUE(user_id, project_id, query)
);

CREATE INDEX IF NOT EXISTS idx_watched_trends_user ON watched_trends(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_trends_project ON watched_trends(project_id);
CREATE INDEX IF NOT EXISTS idx_watched_trends_active ON watched_trends(is_active, last_scraped_at);

-- ============================================================================
-- 3. trend_snapshots: Historical data for momentum calculation
-- ============================================================================
CREATE TABLE IF NOT EXISTS trend_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Topic identification
  topic_hash VARCHAR(64) NOT NULL,
  topic_name TEXT NOT NULL,
  watched_trend_id UUID REFERENCES watched_trends(id) ON DELETE SET NULL,

  -- Snapshot data
  snapshot_at TIMESTAMP DEFAULT NOW(),

  -- Metrics at this point
  total_engagement INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  platforms_data JSONB DEFAULT '{}',

  -- Pre-calculated hourly bucket for efficient queries
  snapshot_hour TIMESTAMP GENERATED ALWAYS AS (date_trunc('hour', snapshot_at)) STORED
);

CREATE INDEX IF NOT EXISTS idx_snapshots_topic ON trend_snapshots(topic_hash, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_watched ON trend_snapshots(watched_trend_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_hourly ON trend_snapshots(snapshot_hour DESC);

-- ============================================================================
-- 4. hashtag_metrics: Aggregated hashtag performance with momentum
-- ============================================================================
CREATE TABLE IF NOT EXISTS hashtag_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  hashtag VARCHAR(255) NOT NULL,
  hashtag_normalized VARCHAR(255) NOT NULL,

  -- Current metrics
  current_posts INT DEFAULT 0,
  current_engagement INT DEFAULT 0,

  -- Historical for momentum (updated hourly)
  engagement_1h_ago INT DEFAULT 0,
  engagement_24h_ago INT DEFAULT 0,
  posts_24h_ago INT DEFAULT 0,

  -- Calculated momentum (-100 to +100)
  momentum_score INT DEFAULT 0,
  momentum_direction VARCHAR(10) CHECK (momentum_direction IN ('rising', 'falling', 'stable')) DEFAULT 'stable',
  percent_change INT DEFAULT 0,

  -- Platform breakdown
  platform_breakdown JSONB DEFAULT '{}',

  -- Peak tracking
  peak_engagement INT DEFAULT 0,
  peak_at TIMESTAMP,

  last_updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(hashtag_normalized)
);

CREATE INDEX IF NOT EXISTS idx_hashtag_metrics_momentum ON hashtag_metrics(momentum_score DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_metrics_engagement ON hashtag_metrics(current_engagement DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_metrics_direction ON hashtag_metrics(momentum_direction, current_engagement DESC);

-- ============================================================================
-- 5. Cleanup: Auto-delete old data
-- ============================================================================
-- Social posts older than 7 days
-- Snapshots older than 30 days
-- (These should be run via cron job, not as DB triggers for Supabase compatibility)
