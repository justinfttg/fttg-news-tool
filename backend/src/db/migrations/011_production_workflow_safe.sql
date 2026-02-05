-- Migration: Production Workflow for Calendar Episodes (SAFE VERSION)
-- Only creates tables/columns that don't exist

-- ============================================================================
-- Production Episodes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  topic_proposal_id UUID REFERENCES topic_proposals(id) ON DELETE SET NULL,
  calendar_item_id UUID REFERENCES calendar_items(id) ON DELETE SET NULL UNIQUE,

  title VARCHAR(500) NOT NULL,
  episode_number INT,
  tx_date DATE NOT NULL,
  tx_time TIME,
  timeline_type VARCHAR(20) DEFAULT 'normal' CHECK (timeline_type IN ('normal', 'breaking_news', 'emergency')),

  production_status VARCHAR(30) DEFAULT 'topic_pending' CHECK (production_status IN (
    'topic_pending', 'topic_approved', 'script_development', 'script_review',
    'script_approved', 'in_production', 'post_production', 'draft_review',
    'final_review', 'delivered', 'published', 'cancelled'
  )),

  client_approved_at TIMESTAMP,
  client_approved_by_user_id UUID REFERENCES users(id),
  internal_notes TEXT,
  client_feedback TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id)
);

-- ============================================================================
-- Production Milestones Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES production_episodes(id) ON DELETE CASCADE NOT NULL,

  milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN (
    'topic_confirmation', 'script_deadline', 'script_approval', 'production_day',
    'post_production', 'draft_1_review', 'draft_2_review', 'final_delivery',
    'topic_approval', 'custom'
  )),

  label VARCHAR(100),

  deadline_date DATE NOT NULL,
  deadline_time TIME,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'skipped')),
  completed_at TIMESTAMP,
  completed_by_user_id UUID REFERENCES users(id),
  notes TEXT,
  is_client_facing BOOLEAN DEFAULT FALSE,
  requires_client_approval BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Proposal Comments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_proposal_id UUID REFERENCES topic_proposals(id) ON DELETE CASCADE NOT NULL,

  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES proposal_comments(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) NOT NULL,
  comment_type VARCHAR(20) DEFAULT 'internal' CHECK (comment_type IN ('internal', 'client_feedback', 'revision_request')),

  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by_user_id UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Workflow Templates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,

  name VARCHAR(100) NOT NULL,
  description TEXT,
  timeline_type VARCHAR(20) NOT NULL CHECK (timeline_type IN ('normal', 'breaking_news', 'emergency')),
  is_default BOOLEAN DEFAULT FALSE,

  milestone_offsets JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Add columns to topic_proposals (if they don't exist)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_proposals' AND column_name = 'scheduled_tx_date') THEN
    ALTER TABLE topic_proposals ADD COLUMN scheduled_tx_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_proposals' AND column_name = 'linked_episode_id') THEN
    ALTER TABLE topic_proposals ADD COLUMN linked_episode_id UUID REFERENCES production_episodes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- Add columns to calendar_items (if they don't exist)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_items' AND column_name = 'episode_id') THEN
    ALTER TABLE calendar_items ADD COLUMN episode_id UUID REFERENCES production_episodes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_items' AND column_name = 'milestone_type') THEN
    ALTER TABLE calendar_items ADD COLUMN milestone_type VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_items' AND column_name = 'is_milestone') THEN
    ALTER TABLE calendar_items ADD COLUMN is_milestone BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================================
-- Create indexes (IF NOT EXISTS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_episodes_project ON production_episodes(project_id, tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON production_episodes(project_id, production_status);
CREATE INDEX IF NOT EXISTS idx_episodes_proposal ON production_episodes(topic_proposal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_episode ON production_milestones(episode_id, deadline_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON production_milestones(status, deadline_date);
CREATE INDEX IF NOT EXISTS idx_milestones_deadline ON production_milestones(deadline_date, status);
CREATE INDEX IF NOT EXISTS idx_comments_proposal ON proposal_comments(topic_proposal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON proposal_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_templates_project ON production_workflow_templates(project_id, timeline_type);
