-- FTTG Content Intelligence Platform
-- Migration 001: Initial Schema
-- All core tables for projects, calendar, frameworks, and collaboration

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
