-- Migration: Marked Stories
-- Allows users to mark/bookmark news stories for later reference

-- ============================================================================
-- 1. marked_stories: User-marked news articles
-- ============================================================================
CREATE TABLE IF NOT EXISTS marked_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  news_story_id UUID NOT NULL,

  -- Metadata
  marked_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate marks per user/story
  UNIQUE(user_id, news_story_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_marked_stories_user ON marked_stories(user_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS idx_marked_stories_project ON marked_stories(project_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS idx_marked_stories_story ON marked_stories(news_story_id);
