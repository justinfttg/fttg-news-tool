// Frontend type definitions

export interface User {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  is_fttg_team: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  user_role?: 'owner' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'editor' | 'viewer';
  can_create_stories: boolean;
  can_approve_stories: boolean;
  can_generate_scripts: boolean;
  can_invite_members: boolean;
}

export interface NewsStory {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  source: string;
  url: string | null;
  region: string | null;
  category: string;
  is_trending: boolean;
  trend_score: number;
  published_at: string | null;
  thumbnail_url: string | null;
}

export interface StoryAngle {
  id: string;
  news_story_id: string;
  framework_id: string | null;
  project_id: string;
  angle_data: Record<string, any>;
  audience_care_statement: string;
  status: 'draft' | 'approved' | 'archived';
}

export interface AudienceProfile {
  id: string;
  project_id: string;
  name: string;
  // Demographics
  age_range: string | null;
  location: string | null;
  education_level: string | null;
  // Language & Market
  primary_language: string | null;
  secondary_languages: string[];
  market_region: string | null;
  // Platform Info
  platform_url: string | null;
  platform_name: string | null;
  platform_type: 'digital_media' | 'broadcast_tv' | 'radio' | 'print' | 'social_media' | 'podcast' | 'other' | null;
  content_categories: string[];
  audience_size: string | null;
  // Psychographics
  values: string[];
  fears: string[];
  aspirations: string[];
  key_demographics: string | null;
  cultural_context: string | null;
  // Content Preferences
  preferred_tone: 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational' | null;
  depth_preference: 'surface' | 'medium' | 'deep_dive' | null;
  political_sensitivity: number | null;
  created_at: string;
  updated_at: string;
}
