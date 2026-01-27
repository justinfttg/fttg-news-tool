// Shared types between frontend and backend

export type PostingFrequency = 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
export type ProjectStatus = 'active' | 'archived' | 'paused';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type CalendarItemStatus = 'draft' | 'pending_review' | 'approved' | 'in_production' | 'published' | 'cancelled';
export type FrameworkType = 'fttg_investigative' | 'educational_deepdive' | 'social_viral' | 'custom';
export type ScriptFormat = 'broadcast_short' | 'broadcast_long' | 'podcast' | 'educational' | 'social_media';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';
export type Region = 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global';
export type PreferredTone = 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational';
export type DepthPreference = 'surface' | 'medium' | 'deep_dive';
