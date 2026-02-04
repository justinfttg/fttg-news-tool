-- Migration: Production Workflow for Calendar Episodes
-- Enables TX date scheduling, milestone tracking, and client collaboration

-- ============================================================================
-- Production Episodes Table
-- Links topic proposals to calendar with full production workflow
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

-- Indexes for production episodes
CREATE INDEX IF NOT EXISTS idx_episodes_project ON production_episodes(project_id, tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON production_episodes(project_id, production_status);
CREATE INDEX IF NOT EXISTS idx_episodes_proposal ON production_episodes(topic_proposal_id);

-- ============================================================================
-- Production Milestones Table
-- Tracks individual deadlines and tasks for each episode
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES production_episodes(id) ON DELETE CASCADE NOT NULL,

  milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN (
    'topic_confirmation', 'script_deadline', 'script_approval', 'production_day',
    'post_production', 'draft_1_review', 'draft_2_review', 'final_delivery',
    'topic_approval', 'custom'
  )),

  label VARCHAR(100), -- Custom label for display (defaults to milestone_type if null)

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

-- Indexes for milestones
CREATE INDEX IF NOT EXISTS idx_milestones_episode ON production_milestones(episode_id, deadline_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON production_milestones(status, deadline_date);
CREATE INDEX IF NOT EXISTS idx_milestones_deadline ON production_milestones(deadline_date, status);

-- ============================================================================
-- Proposal Comments Table
-- Threaded discussion for FTTG + Client collaboration on proposals
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

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_proposal ON proposal_comments(topic_proposal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON proposal_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_unresolved ON proposal_comments(topic_proposal_id, is_resolved) WHERE is_resolved = FALSE;

-- ============================================================================
-- Workflow Templates Table
-- Configurable production workflow templates per project
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,

  name VARCHAR(100) NOT NULL,
  description TEXT,
  timeline_type VARCHAR(20) NOT NULL CHECK (timeline_type IN ('normal', 'breaking_news', 'emergency')),
  is_default BOOLEAN DEFAULT FALSE,

  -- JSON array of milestone offsets from TX date
  -- Structure: [{"milestone_type": "script_approval", "days_offset": -4, "time": "12:00", "label": "Script Approval", "is_client_facing": true, "requires_client_approval": true}]
  milestone_offsets JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for templates
CREATE INDEX IF NOT EXISTS idx_templates_project ON production_workflow_templates(project_id, timeline_type);

-- ============================================================================
-- Extend topic_proposals table
-- ============================================================================
ALTER TABLE topic_proposals ADD COLUMN IF NOT EXISTS scheduled_tx_date DATE;
ALTER TABLE topic_proposals ADD COLUMN IF NOT EXISTS linked_episode_id UUID REFERENCES production_episodes(id) ON DELETE SET NULL;

-- Index for scheduled proposals
CREATE INDEX IF NOT EXISTS idx_proposals_scheduled ON topic_proposals(scheduled_tx_date) WHERE scheduled_tx_date IS NOT NULL;

-- ============================================================================
-- Extend calendar_items table
-- ============================================================================
ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES production_episodes(id) ON DELETE SET NULL;
ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS milestone_type VARCHAR(50);
ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT FALSE;

-- Index for episode calendar items
CREATE INDEX IF NOT EXISTS idx_calendar_episode ON calendar_items(episode_id) WHERE episode_id IS NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE production_episodes IS 'Production episodes linking approved proposals to calendar with full workflow tracking';
COMMENT ON TABLE production_milestones IS 'Individual milestones/deadlines for each production episode';
COMMENT ON TABLE proposal_comments IS 'Threaded comments for collaboration on topic proposals';
COMMENT ON TABLE production_workflow_templates IS 'Configurable workflow templates with milestone offsets from TX date';

COMMENT ON COLUMN production_episodes.timeline_type IS 'normal (7-day), breaking_news (3-day), emergency (fast-track)';
COMMENT ON COLUMN production_episodes.production_status IS 'Current stage in the production workflow';
COMMENT ON COLUMN production_milestones.milestone_type IS 'Type of milestone: topic_confirmation, script_deadline, script_approval, production_day, post_production, draft_1_review, draft_2_review, final_delivery, topic_approval, custom';
COMMENT ON COLUMN production_milestones.is_client_facing IS 'Whether this milestone is visible to client users';
COMMENT ON COLUMN production_milestones.requires_client_approval IS 'Whether this milestone requires explicit client approval';
COMMENT ON COLUMN proposal_comments.comment_type IS 'internal (team only), client_feedback (from client), revision_request (requires changes)';
COMMENT ON COLUMN production_workflow_templates.milestone_offsets IS 'JSON array: [{milestone_type, days_offset, time, label, is_client_facing, requires_client_approval}]';
