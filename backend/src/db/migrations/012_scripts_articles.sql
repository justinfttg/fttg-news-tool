-- ============================================================================
-- Migration: Scripts & Articles with Versioning, Feedback, and Approval
-- ============================================================================

-- Content type enum values: 'video_script', 'article'

-- ============================================================================
-- 1. Episode Content Table (stores scripts and articles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES production_episodes(id) ON DELETE CASCADE NOT NULL,
  content_type VARCHAR(20) NOT NULL, -- 'video_script' | 'article'

  -- Current state
  current_version INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'in_review' | 'needs_revision' | 'approved' | 'locked'

  -- Approval tracking
  approved_at TIMESTAMP,
  approved_by_user_id UUID REFERENCES users(id),
  locked_at TIMESTAMP,
  locked_by_user_id UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id),

  -- Only one script and one article per episode
  UNIQUE(episode_id, content_type)
);

-- ============================================================================
-- 2. Content Versions Table (version history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES episode_content(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL,

  -- Content
  title VARCHAR(500),
  body TEXT NOT NULL,

  -- Metadata
  word_count INT,
  change_summary TEXT, -- What changed in this version

  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id),

  UNIQUE(content_id, version_number)
);

-- ============================================================================
-- 3. Content Feedback Table (inline comments with highlighting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES episode_content(id) ON DELETE CASCADE NOT NULL,
  version_id UUID REFERENCES episode_content_versions(id) ON DELETE CASCADE NOT NULL,

  -- Feedback content
  comment TEXT NOT NULL,
  feedback_type VARCHAR(20) DEFAULT 'comment', -- 'comment' | 'revision_request' | 'approval'

  -- Highlight selection (for inline feedback)
  highlight_start INT, -- Character position start
  highlight_end INT,   -- Character position end
  highlighted_text TEXT, -- The selected text (for reference)

  -- Threading
  parent_feedback_id UUID REFERENCES episode_content_feedback(id) ON DELETE CASCADE,

  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by_user_id UUID REFERENCES users(id),

  -- Author
  author_user_id UUID REFERENCES users(id) NOT NULL,
  is_client_feedback BOOLEAN DEFAULT FALSE, -- True if from client (Mediacorp)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 4. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_content_episode ON episode_content(episode_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON episode_content(status);
CREATE INDEX IF NOT EXISTS idx_versions_content ON episode_content_versions(content_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_content ON episode_content_feedback(content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_version ON episode_content_feedback(version_id);
CREATE INDEX IF NOT EXISTS idx_feedback_unresolved ON episode_content_feedback(content_id, is_resolved) WHERE is_resolved = FALSE;

-- ============================================================================
-- 5. Add milestone_id to calendar_items for linking
-- ============================================================================

ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES production_milestones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_milestone ON calendar_items(milestone_id) WHERE milestone_id IS NOT NULL;
