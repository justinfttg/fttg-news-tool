// Core entity types matching database schema

export interface Organization {
  id: string;
  name: string;
  type: 'fttg_internal' | 'licensed_client' | 'trial';
  license_type: 'main_account' | 'sub_account';
  seat_limit: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  is_fttg_team: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_org_id: string;
  created_by_user_id: string;
  posting_frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
  custom_frequency_days: number | null;
  video_quota_per_year: number | null;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'archived' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  can_create_stories: boolean;
  can_approve_stories: boolean;
  can_generate_scripts: boolean;
  can_invite_members: boolean;
  invited_by_user_id: string | null;
  invited_at: string;
}

export interface CalendarItem {
  id: string;
  project_id: string;
  news_story_id: string | null;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_seconds: number | null;
  status: 'draft' | 'pending_review' | 'approved' | 'in_production' | 'published' | 'cancelled';
  selected_angle_id: string | null;
  script_id: string | null;
  created_by_user_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorytellingFramework {
  id: string;
  name: string;
  type: 'fttg_investigative' | 'educational_deepdive' | 'social_viral' | 'custom';
  description: string;
  framework_steps: FrameworkStep[];
  system_prompt: string;
  user_prompt_template: string;
  is_active: boolean;
  is_team_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface FrameworkStep {
  step: string;
  instruction: string;
  output_format: string;
}

export interface AudienceProfile {
  id: string;
  project_id: string;
  name: string;
  age_range: string | null;
  location: string | null;
  education_level: string | null;
  values: string[];
  fears: string[];
  aspirations: string[];
  preferred_tone: 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational' | null;
  depth_preference: 'surface' | 'medium' | 'deep_dive' | null;
  political_sensitivity: number | null;
  created_at: string;
  updated_at: string;
}

export interface NewsStory {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  source: string;
  url: string | null;
  region: 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global' | 'singapore' | 'china' | null;
  category: string;
  is_trending: boolean;
  social_platforms: string[];
  trend_score: number;
  published_at: string | null;
  scraped_at: string;
  thumbnail_url: string | null;
}

export interface StoryAngle {
  id: string;
  news_story_id: string;
  framework_id: string | null;
  audience_profile_id: string | null;
  project_id: string;
  created_by_user_id: string | null;
  angle_data: Record<string, any>;
  audience_care_statement: string;
  related_stories: string[];
  comparison_regions: string[];
  status: 'draft' | 'approved' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Script {
  id: string;
  story_angle_id: string;
  project_id: string;
  created_by_user_id: string | null;
  duration_seconds: number;
  format: 'broadcast_short' | 'broadcast_long' | 'podcast' | 'educational' | 'social_media';
  framework_id: string | null;
  script_content: string;
  word_count: number | null;
  production_notes: Record<string, any>;
  version: number;
  is_exported: boolean;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  calendar_item_id: string;
  approver_user_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  comments: string | null;
  created_at: string;
}
