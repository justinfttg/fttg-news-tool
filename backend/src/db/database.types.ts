/**
 * FTTG Content Intelligence Platform
 * Supabase Database Type Definitions
 *
 * Generated from 001_initial_schema.sql — keep in sync with migrations.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          type: 'fttg_internal' | 'licensed_client' | 'trial';
          license_type: 'main_account' | 'sub_account';
          seat_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: 'fttg_internal' | 'licensed_client' | 'trial';
          license_type?: 'main_account' | 'sub_account';
          seat_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: 'fttg_internal' | 'licensed_client' | 'trial';
          license_type?: 'main_account' | 'sub_account';
          seat_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          full_name: string | null;
          org_id: string | null;
          is_fttg_team: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          full_name?: string | null;
          org_id?: string | null;
          is_fttg_team?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          full_name?: string | null;
          org_id?: string | null;
          is_fttg_team?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_org_id: string | null;
          created_by_user_id: string | null;
          posting_frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
          custom_frequency_days: number | null;
          video_quota_per_year: number | null;
          start_date: string;
          end_date: string | null;
          status: 'active' | 'archived' | 'paused';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_org_id?: string | null;
          created_by_user_id?: string | null;
          posting_frequency?: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
          custom_frequency_days?: number | null;
          video_quota_per_year?: number | null;
          start_date: string;
          end_date?: string | null;
          status?: 'active' | 'archived' | 'paused';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_org_id?: string | null;
          created_by_user_id?: string | null;
          posting_frequency?: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
          custom_frequency_days?: number | null;
          video_quota_per_year?: number | null;
          start_date?: string;
          end_date?: string | null;
          status?: 'active' | 'archived' | 'paused';
          created_at?: string;
          updated_at?: string;
        };
      };
      project_members: {
        Row: {
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
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role: 'owner' | 'editor' | 'viewer';
          can_create_stories?: boolean;
          can_approve_stories?: boolean;
          can_generate_scripts?: boolean;
          can_invite_members?: boolean;
          invited_by_user_id?: string | null;
          invited_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: 'owner' | 'editor' | 'viewer';
          can_create_stories?: boolean;
          can_approve_stories?: boolean;
          can_generate_scripts?: boolean;
          can_invite_members?: boolean;
          invited_by_user_id?: string | null;
          invited_at?: string;
        };
      };
      storytelling_frameworks: {
        Row: {
          id: string;
          name: string;
          type: 'fttg_investigative' | 'educational_deepdive' | 'social_viral' | 'custom';
          description: string | null;
          framework_steps: Json;
          system_prompt: string;
          user_prompt_template: string;
          is_active: boolean;
          is_team_only: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: 'fttg_investigative' | 'educational_deepdive' | 'social_viral' | 'custom';
          description?: string | null;
          framework_steps: Json;
          system_prompt: string;
          user_prompt_template: string;
          is_active?: boolean;
          is_team_only?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: 'fttg_investigative' | 'educational_deepdive' | 'social_viral' | 'custom';
          description?: string | null;
          framework_steps?: Json;
          system_prompt?: string;
          user_prompt_template?: string;
          is_active?: boolean;
          is_team_only?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      audience_profiles: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          age_range: string | null;
          location: string | null;
          education_level: string | null;
          values: Json;
          fears: Json;
          aspirations: Json;
          preferred_tone: 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational' | null;
          depth_preference: 'surface' | 'medium' | 'deep_dive' | null;
          political_sensitivity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          age_range?: string | null;
          location?: string | null;
          education_level?: string | null;
          values?: Json;
          fears?: Json;
          aspirations?: Json;
          preferred_tone?: 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational' | null;
          depth_preference?: 'surface' | 'medium' | 'deep_dive' | null;
          political_sensitivity?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          age_range?: string | null;
          location?: string | null;
          education_level?: string | null;
          values?: Json;
          fears?: Json;
          aspirations?: Json;
          preferred_tone?: 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational' | null;
          depth_preference?: 'surface' | 'medium' | 'deep_dive' | null;
          political_sensitivity?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      news_stories: {
        Row: {
          id: string;
          title: string;
          summary: string | null;
          content: string;
          source: string;
          url: string | null;
          region: 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global' | null;
          category: string;
          is_trending: boolean;
          social_platforms: Json;
          trend_score: number;
          published_at: string | null;
          scraped_at: string;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          summary?: string | null;
          content: string;
          source: string;
          url?: string | null;
          region?: 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global' | null;
          category: string;
          is_trending?: boolean;
          social_platforms?: Json;
          trend_score?: number;
          published_at?: string | null;
          scraped_at?: string;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          summary?: string | null;
          content?: string;
          source?: string;
          url?: string | null;
          region?: 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global' | null;
          category?: string;
          is_trending?: boolean;
          social_platforms?: Json;
          trend_score?: number;
          published_at?: string | null;
          scraped_at?: string;
          search_vector?: string | null;
        };
      };
      story_angles: {
        Row: {
          id: string;
          news_story_id: string;
          framework_id: string | null;
          audience_profile_id: string | null;
          project_id: string;
          created_by_user_id: string | null;
          angle_data: Json;
          audience_care_statement: string;
          related_stories: Json;
          comparison_regions: Json;
          status: 'draft' | 'approved' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          news_story_id: string;
          framework_id?: string | null;
          audience_profile_id?: string | null;
          project_id: string;
          created_by_user_id?: string | null;
          angle_data: Json;
          audience_care_statement: string;
          related_stories?: Json;
          comparison_regions?: Json;
          status?: 'draft' | 'approved' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          news_story_id?: string;
          framework_id?: string | null;
          audience_profile_id?: string | null;
          project_id?: string;
          created_by_user_id?: string | null;
          angle_data?: Json;
          audience_care_statement?: string;
          related_stories?: Json;
          comparison_regions?: Json;
          status?: 'draft' | 'approved' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
      };
      scripts: {
        Row: {
          id: string;
          story_angle_id: string;
          project_id: string;
          created_by_user_id: string | null;
          duration_seconds: number;
          format: 'broadcast_short' | 'broadcast_long' | 'podcast' | 'educational' | 'social_media';
          framework_id: string | null;
          script_content: string;
          word_count: number | null;
          production_notes: Json;
          version: number;
          is_exported: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          story_angle_id: string;
          project_id: string;
          created_by_user_id?: string | null;
          duration_seconds: number;
          format: 'broadcast_short' | 'broadcast_long' | 'podcast' | 'educational' | 'social_media';
          framework_id?: string | null;
          script_content: string;
          word_count?: number | null;
          production_notes?: Json;
          version?: number;
          is_exported?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          story_angle_id?: string;
          project_id?: string;
          created_by_user_id?: string | null;
          duration_seconds?: number;
          format?: 'broadcast_short' | 'broadcast_long' | 'podcast' | 'educational' | 'social_media';
          framework_id?: string | null;
          script_content?: string;
          word_count?: number | null;
          production_notes?: Json;
          version?: number;
          is_exported?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      calendar_items: {
        Row: {
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
        };
        Insert: {
          id?: string;
          project_id: string;
          news_story_id?: string | null;
          title: string;
          scheduled_date: string;
          scheduled_time?: string | null;
          duration_seconds?: number | null;
          status?: 'draft' | 'pending_review' | 'approved' | 'in_production' | 'published' | 'cancelled';
          selected_angle_id?: string | null;
          script_id?: string | null;
          created_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          news_story_id?: string | null;
          title?: string;
          scheduled_date?: string;
          scheduled_time?: string | null;
          duration_seconds?: number | null;
          status?: 'draft' | 'pending_review' | 'approved' | 'in_production' | 'published' | 'cancelled';
          selected_angle_id?: string | null;
          script_id?: string | null;
          created_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      approvals: {
        Row: {
          id: string;
          calendar_item_id: string;
          approver_user_id: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
          comments: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          calendar_item_id: string;
          approver_user_id?: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
          comments?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          calendar_item_id?: string;
          approver_user_id?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'changes_requested';
          comments?: string | null;
          created_at?: string;
        };
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string | null;
          project_id: string | null;
          action: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          action: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          action?: string;
          metadata?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience row type aliases for all tables
export type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
export type UserRow = Database['public']['Tables']['users']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectMemberRow = Database['public']['Tables']['project_members']['Row'];
export type StorytellingFrameworkRow = Database['public']['Tables']['storytelling_frameworks']['Row'];
export type AudienceProfileRow = Database['public']['Tables']['audience_profiles']['Row'];
export type NewsStoryRow = Database['public']['Tables']['news_stories']['Row'];
export type StoryAngleRow = Database['public']['Tables']['story_angles']['Row'];
export type ScriptRow = Database['public']['Tables']['scripts']['Row'];
export type CalendarItemRow = Database['public']['Tables']['calendar_items']['Row'];
export type ApprovalRow = Database['public']['Tables']['approvals']['Row'];
export type UsageLogRow = Database['public']['Tables']['usage_logs']['Row'];

// Convenience insert type aliases
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectMemberInsert = Database['public']['Tables']['project_members']['Insert'];
export type StorytellingFrameworkInsert = Database['public']['Tables']['storytelling_frameworks']['Insert'];
export type AudienceProfileInsert = Database['public']['Tables']['audience_profiles']['Insert'];
export type NewsStoryInsert = Database['public']['Tables']['news_stories']['Insert'];
export type StoryAngleInsert = Database['public']['Tables']['story_angles']['Insert'];
export type ScriptInsert = Database['public']['Tables']['scripts']['Insert'];
export type CalendarItemInsert = Database['public']['Tables']['calendar_items']['Insert'];
export type ApprovalInsert = Database['public']['Tables']['approvals']['Insert'];
export type UsageLogInsert = Database['public']['Tables']['usage_logs']['Insert'];

// Convenience update type aliases
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type ProjectMemberUpdate = Database['public']['Tables']['project_members']['Update'];
export type StorytellingFrameworkUpdate = Database['public']['Tables']['storytelling_frameworks']['Update'];
export type AudienceProfileUpdate = Database['public']['Tables']['audience_profiles']['Update'];
export type NewsStoryUpdate = Database['public']['Tables']['news_stories']['Update'];
export type StoryAngleUpdate = Database['public']['Tables']['story_angles']['Update'];
export type ScriptUpdate = Database['public']['Tables']['scripts']['Update'];
export type CalendarItemUpdate = Database['public']['Tables']['calendar_items']['Update'];
export type ApprovalUpdate = Database['public']['Tables']['approvals']['Update'];
export type UsageLogUpdate = Database['public']['Tables']['usage_logs']['Update'];
