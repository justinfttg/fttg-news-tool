-- =============================================
-- FTTG Content Intelligence Platform
-- Combined Migration: Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/qzvulqjuvloatwbkidxm/sql
-- =============================================

-- =============================================
-- MIGRATION 001: Initial Schema
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations Table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('fttg_internal', 'licensed_client', 'trial')) NOT NULL,
  license_type VARCHAR(50) CHECK (license_type IN ('main_account', 'sub_account')) DEFAULT 'main_account',
  seat_limit INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  is_fttg_team BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects Table (Core Entity)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  posting_frequency VARCHAR(50) CHECK (posting_frequency IN ('daily', 'weekly', 'bi-weekly', 'monthly', 'custom')) DEFAULT 'weekly',
  custom_frequency_days INT,
  video_quota_per_year INT,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) CHECK (status IN ('active', 'archived', 'paused')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project Members Table (Collaboration)
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) CHECK (role IN ('owner', 'editor', 'viewer')) NOT NULL,
  can_create_stories BOOLEAN DEFAULT TRUE,
  can_approve_stories BOOLEAN DEFAULT FALSE,
  can_generate_scripts BOOLEAN DEFAULT FALSE,
  can_invite_members BOOLEAN DEFAULT FALSE,
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Storytelling Frameworks Table
CREATE TABLE storytelling_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) CHECK (type IN ('fttg_investigative', 'educational_deepdive', 'social_viral', 'custom')) NOT NULL,
  description TEXT,
  framework_steps JSONB NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_team_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audience Profiles Table
CREATE TABLE audience_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  age_range VARCHAR(50),
  location VARCHAR(100),
  education_level VARCHAR(100),
  values JSONB DEFAULT '[]',
  fears JSONB DEFAULT '[]',
  aspirations JSONB DEFAULT '[]',
  preferred_tone VARCHAR(50) CHECK (preferred_tone IN ('investigative', 'educational', 'balanced', 'provocative', 'conversational')),
  depth_preference VARCHAR(50) CHECK (depth_preference IN ('surface', 'medium', 'deep_dive')),
  political_sensitivity INT CHECK (political_sensitivity BETWEEN 1 AND 10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- News Stories Table
CREATE TABLE news_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  source VARCHAR(255) NOT NULL,
  url TEXT,
  region VARCHAR(50) CHECK (region IN ('asia', 'southeast_asia', 'east_asia', 'apac', 'global')),
  category VARCHAR(100) NOT NULL,
  is_trending BOOLEAN DEFAULT FALSE,
  social_platforms JSONB DEFAULT '[]',
  trend_score INT DEFAULT 0,
  published_at TIMESTAMP,
  scraped_at TIMESTAMP DEFAULT NOW(),
  search_vector TSVECTOR
);

-- Story Angles Table
CREATE TABLE story_angles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_story_id UUID REFERENCES news_stories(id) ON DELETE CASCADE,
  framework_id UUID REFERENCES storytelling_frameworks(id) ON DELETE SET NULL,
  audience_profile_id UUID REFERENCES audience_profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  angle_data JSONB NOT NULL,
  audience_care_statement TEXT NOT NULL,
  related_stories JSONB DEFAULT '[]',
  comparison_regions JSONB DEFAULT '[]',
  status VARCHAR(50) CHECK (status IN ('draft', 'approved', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scripts Table
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_angle_id UUID REFERENCES story_angles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  duration_seconds INT NOT NULL,
  format VARCHAR(50) CHECK (format IN ('broadcast_short', 'broadcast_long', 'podcast', 'educational', 'social_media')) NOT NULL,
  framework_id UUID REFERENCES storytelling_frameworks(id) ON DELETE SET NULL,
  script_content TEXT NOT NULL,
  word_count INT,
  production_notes JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  is_exported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Calendar Items Table (Planned Stories)
CREATE TABLE calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  news_story_id UUID REFERENCES news_stories(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_seconds INT,
  status VARCHAR(50) CHECK (status IN ('draft', 'pending_review', 'approved', 'in_production', 'published', 'cancelled')) DEFAULT 'draft',
  selected_angle_id UUID REFERENCES story_angles(id) ON DELETE SET NULL,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Approvals Table (Workflow Tracking)
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id UUID REFERENCES calendar_items(id) ON DELETE CASCADE,
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')) NOT NULL,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage Logs Table
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search trigger for news_stories
CREATE TRIGGER news_search_vector_update
BEFORE INSERT OR UPDATE ON news_stories
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.english', title, content, summary);

-- =============================================
-- MIGRATION 002: Seed Storytelling Frameworks
-- =============================================

INSERT INTO storytelling_frameworks (name, type, description, framework_steps, system_prompt, user_prompt_template, is_active, is_team_only)
VALUES (
  'FTTG Investigative',
  'fttg_investigative',
  'Contrarian, emotionally-driven investigative storytelling. Best for breaking news, policy analysis, and exposing disconnects.',
  '[
    {"step": "contrarian_headline", "instruction": "Create a headline that challenges the mainstream narrative. Use definitive language. Create cognitive dissonance.", "output_format": "Single impactful headline (5-10 words)"},
    {"step": "narrative_extraction", "instruction": "Identify the official narrative: What is being publicly stated? Who is promoting it? What are the stated goals/benefits?", "output_format": "2-3 sentence summary of the official position"},
    {"step": "contradiction_finder", "instruction": "Find data that challenges the narrative. Look for: implementation failures, delays, budget overruns, quotes from affected parties, statistical evidence contradicting claims.", "output_format": "List of 3-5 specific contradictions with sources"},
    {"step": "comparison_framework", "instruction": "Find how other countries/organizations handled similar situations. Highlight approach differences and outcomes.", "output_format": "Comparison between subject and 1-2 contrasting examples"},
    {"step": "emotional_core", "instruction": "Identify who is being affected (common people, small businesses). What is the hidden cost? Use specific numbers, prices, personal impacts.", "output_format": "Emotional hook with concrete examples"},
    {"step": "authority_challenge", "instruction": "Question the real motive. Expose misalignment between stated goals and actual priorities. Use insider knowledge or direct quotes if available.", "output_format": "Critical analysis of underlying motives"},
    {"step": "conclusion", "instruction": "Reframe the why. Expose the betrayal or disconnect. Make it memorable and punchy.", "output_format": "Single powerful concluding statement"}
  ]'::jsonb,
  'You are an investigative journalist AI trained in FTTG''s contrarian storytelling framework.

Your approach:
- Challenge mainstream narratives with evidence
- Expose disconnects between stated goals and reality
- Use specific data (prices, percentages, quotes) over generalities
- Show don''t tell: Paint scenes, use concrete examples
- Question authority''s true motives

Generate angles that make audiences think: "Wait, that''s not what I was told."

Output Structure: Follow the 7-step FTTG Investigative framework precisely.',
  'STORY TO ANALYZE:
Title: {{news_title}}
Content: {{news_content}}
Source: {{news_source}}
Published: {{published_at}}

AUDIENCE CONTEXT:
Demographics: {{audience_age_range}}, {{audience_location}}
Values: {{audience_values}}
Fears: {{audience_fears}}
Aspirations: {{audience_aspirations}}

COMPARISON SCOPE: {{comparison_regions}}

TASK: Generate 3 distinct investigative angles using the 7-step framework.

For each angle:
1. contrarian_headline: Challenge the mainstream narrative (5-10 words)
2. narrative_extraction: Official story (2-3 sentences)
3. contradiction_finder: 3-5 contradictions with specific data/sources
4. comparison_framework: How 1-2 other regions handled this differently
5. emotional_core: Who is affected? Use specific numbers/prices/quotes
6. authority_challenge: Question the real motive
7. conclusion: Punchy reframe of the "why"

Also include:
- audience_care_statement: Why should THIS audience care? (connect to their fears/aspirations)
- supporting_evidence: List of source IDs/URLs for further research

Return JSON array of 3 angles.',
  true,
  false
);

INSERT INTO storytelling_frameworks (name, type, description, framework_steps, system_prompt, user_prompt_template, is_active, is_team_only)
VALUES (
  'Educational Deep-Dive',
  'educational_deepdive',
  'John Oliver-style comprehensive topic education with humor and systemic analysis. Best for explainer videos, complex issues, and weekly commentary.',
  '[
    {"step": "timely_hook", "instruction": "Connect topic to current event. Why should we talk about this NOW? Use humor if appropriate.", "output_format": "Opening hook (2-3 sentences) with relevance anchor"},
    {"step": "context_setup", "instruction": "Explain the basics: What is this issue? Who is involved? Assume audience knows nothing. Be clear and simple.", "output_format": "Plain-language explanation (3-5 sentences)"},
    {"step": "problem_breakdown", "instruction": "Identify the core problem. Break complex issue into digestible parts. Use numbered lists or categories.", "output_format": "3-5 key problems or aspects, clearly delineated"},
    {"step": "evidence_layering", "instruction": "Build the case with evidence: statistics, expert quotes, news clips, historical data. Layer from recent to historical. Include absurdities or contradictions.", "output_format": "5-10 evidence points with sources, organized chronologically or thematically"},
    {"step": "human_impact", "instruction": "Show real people affected. Use specific stories, testimonials, or scenarios that humanize the issue.", "output_format": "2-3 human impact examples with details"},
    {"step": "systemic_analysis", "instruction": "Zoom out: Why does this keep happening? What systems, incentives, or structures enable this? Connect dots between evidence points.", "output_format": "Systemic explanation (3-5 sentences) identifying root causes"},
    {"step": "visual_suggestions", "instruction": "Suggest visuals that would aid understanding: graphics, charts, clips, reenactments. Think about how to make abstract concepts concrete.", "output_format": "List of 5-10 visual aids with descriptions"},
    {"step": "call_to_action", "instruction": "What needs to change? Who needs to do what? Be specific about solutions or reforms needed.", "output_format": "Clear call to action (2-3 specific recommendations)"}
  ]'::jsonb,
  'You are an educational content AI trained in John Oliver''s Last Week Tonight style of explanatory journalism.

Your approach:
- Make complex topics accessible without dumbing them down
- Use humor to maintain engagement (absurdity, irony, relatable analogies)
- Build from simple to complex progressively
- Layer evidence systematically (data, clips, expert voices)
- Show human impact with specific stories
- Identify systemic causes, not just symptoms
- Suggest visual aids that clarify concepts
- End with actionable takeaways

Your tone: Conversational, witty, empathetic, educational
Your goal: Audiences leave understanding WHY this matters and WHAT should change

Output Structure: Follow the 8-step Educational Deep-Dive framework precisely.',
  'TOPIC TO EXPLAIN:
Title: {{news_title}}
Content: {{news_content}}
Source: {{news_source}}

RELATED CONTEXT:
{{related_stories}}

AUDIENCE CONTEXT:
Education level: {{audience_education_level}}
Values: {{audience_values}}
Depth preference: {{audience_depth_preference}}

TASK: Create an educational deep-dive using the 8-step framework.

Generate 2-3 angle options, each following:
1. timely_hook: Why talk about this NOW? (2-3 sentences, use humor)
2. context_setup: Explain basics assuming zero knowledge (3-5 sentences)
3. problem_breakdown: What are the 3-5 key issues?
4. evidence_layering: 5-10 evidence points (stats, quotes, clips) with sources
5. human_impact: 2-3 real-world impact examples
6. systemic_analysis: WHY does this keep happening? (root causes)
7. visual_suggestions: 5-10 visual aids (charts, clips, graphics) that would help
8. call_to_action: What needs to change? (2-3 specific recommendations)

Also include:
- audience_care_statement: Why should THIS audience care?
- humor_opportunities: 3-5 moments where humor could enhance retention
- estimated_duration: How long would this take to explain thoroughly?

Return JSON array of 2-3 educational angles.',
  true,
  false
);

-- =============================================
-- MIGRATION 003: Performance Indexes
-- =============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);

-- Projects
CREATE INDEX idx_projects_org ON projects(owner_org_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Project Members
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Calendar Items
CREATE INDEX idx_calendar_project_date ON calendar_items(project_id, scheduled_date DESC);
CREATE INDEX idx_calendar_status ON calendar_items(status);

-- Storytelling Frameworks
CREATE INDEX idx_frameworks_type ON storytelling_frameworks(type);

-- Audience Profiles
CREATE INDEX idx_audience_project ON audience_profiles(project_id);

-- News Stories
CREATE INDEX idx_news_region_category ON news_stories(region, category);
CREATE INDEX idx_news_trending ON news_stories(is_trending DESC, trend_score DESC);
CREATE INDEX idx_news_published ON news_stories(published_at DESC);
CREATE INDEX idx_news_search ON news_stories USING GIN(search_vector);

-- Story Angles
CREATE INDEX idx_angles_story ON story_angles(news_story_id);
CREATE INDEX idx_angles_project ON story_angles(project_id);
CREATE INDEX idx_angles_framework ON story_angles(framework_id);

-- Scripts
CREATE INDEX idx_scripts_angle ON scripts(story_angle_id);
CREATE INDEX idx_scripts_project ON scripts(project_id);

-- Approvals
CREATE INDEX idx_approvals_calendar_item ON approvals(calendar_item_id);

-- Usage Logs
CREATE INDEX idx_usage_user_date ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_project_date ON usage_logs(project_id, created_at DESC);

-- =============================================
-- Done! All tables, seed data, and indexes created.
-- =============================================
