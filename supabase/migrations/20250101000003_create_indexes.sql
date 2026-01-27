-- FTTG Content Intelligence Platform
-- Migration 003: Performance Indexes

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
