import { supabase } from '../client';
import type {
  TopicProposal,
  TopicGeneratorSettings,
  TopicCluster,
  TopicClustersCache,
  TalkingPoint,
  ResearchCitation,
  TrendingContext,
} from '../../types';

// ============================================================================
// Column selections
// ============================================================================

const PROPOSAL_COLUMNS = `
  id, project_id, created_by_user_id,
  title, hook, audience_care_statement,
  talking_points, research_citations,
  source_story_ids, cluster_theme, cluster_keywords,
  duration_type, duration_seconds,
  generation_trigger, audience_profile_id, comparison_regions, trending_context,
  status, review_notes,
  created_at, updated_at
`;

const SETTINGS_COLUMNS = `
  id, project_id,
  auto_generation_enabled, auto_generation_time, auto_generation_timezone,
  time_window_days, min_stories_for_cluster, max_proposals_per_run,
  focus_categories, comparison_regions,
  default_duration_type, default_duration_seconds, default_audience_profile_id,
  include_trending_context,
  created_at, updated_at
`;

// ============================================================================
// Input types
// ============================================================================

export interface CreateTopicProposalInput {
  projectId: string;
  createdByUserId?: string;
  title: string;
  hook: string;
  audienceCareStatement?: string;
  talkingPoints: TalkingPoint[];
  researchCitations: ResearchCitation[];
  sourceStoryIds: string[];
  clusterTheme?: string;
  clusterKeywords?: string[];
  durationType: 'short' | 'standard' | 'long' | 'custom';
  durationSeconds: number;
  generationTrigger: 'auto' | 'manual';
  audienceProfileId?: string;
  comparisonRegions?: string[];
  trendingContext?: TrendingContext[];
}

export interface UpdateTopicProposalInput {
  title?: string;
  hook?: string;
  audienceCareStatement?: string | null;
  talkingPoints?: TalkingPoint[];
  researchCitations?: ResearchCitation[];
  sourceStoryIds?: string[];
  status?: 'draft' | 'reviewed' | 'approved' | 'rejected' | 'archived';
  reviewNotes?: string | null;
}

export interface TopicGeneratorSettingsInput {
  projectId: string;
  autoGenerationEnabled?: boolean;
  autoGenerationTime?: string;
  autoGenerationTimezone?: string;
  timeWindowDays?: number;
  minStoriesForCluster?: number;
  maxProposalsPerRun?: number;
  focusCategories?: string[];
  comparisonRegions?: string[];
  defaultDurationType?: 'short' | 'standard' | 'long' | 'custom';
  defaultDurationSeconds?: number;
  defaultAudienceProfileId?: string | null;
  includeTrendingContext?: boolean;
}

// ============================================================================
// Topic Proposals CRUD
// ============================================================================

export async function getTopicProposals(
  projectId: string,
  options?: {
    status?: string;
    audienceProfileId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<TopicProposal[]> {
  let query = supabase
    .from('topic_proposals')
    .select(`${PROPOSAL_COLUMNS}, audience_profiles(id, name, preferred_tone, market_region)`)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.audienceProfileId) {
    query = query.eq('audience_profile_id', options.audienceProfileId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(row => {
    const { audience_profiles, ...rest } = row as any;
    return {
      ...rest,
      audience_profile: audience_profiles,
    };
  }) as TopicProposal[];
}

export async function getTopicProposalById(id: string): Promise<TopicProposal | null> {
  const { data, error } = await supabase
    .from('topic_proposals')
    .select(`
      ${PROPOSAL_COLUMNS},
      audience_profiles(*),
      news_stories:source_story_ids
    `)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  const { audience_profiles, ...rest } = data as any;
  return {
    ...rest,
    audience_profile: audience_profiles,
  } as TopicProposal;
}

export async function createTopicProposal(input: CreateTopicProposalInput): Promise<TopicProposal> {
  const { data, error } = await supabase
    .from('topic_proposals')
    .insert({
      project_id: input.projectId,
      created_by_user_id: input.createdByUserId || null,
      title: input.title,
      hook: input.hook,
      audience_care_statement: input.audienceCareStatement || null,
      talking_points: input.talkingPoints,
      research_citations: input.researchCitations,
      source_story_ids: input.sourceStoryIds,
      cluster_theme: input.clusterTheme || null,
      cluster_keywords: input.clusterKeywords || [],
      duration_type: input.durationType,
      duration_seconds: input.durationSeconds,
      generation_trigger: input.generationTrigger,
      audience_profile_id: input.audienceProfileId || null,
      comparison_regions: input.comparisonRegions || [],
      trending_context: input.trendingContext || [],
      status: 'draft',
    })
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create topic proposal');
  }

  return data as TopicProposal;
}

export async function updateTopicProposal(
  id: string,
  input: UpdateTopicProposalInput
): Promise<TopicProposal> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) payload.title = input.title;
  if (input.hook !== undefined) payload.hook = input.hook;
  if (input.audienceCareStatement !== undefined) payload.audience_care_statement = input.audienceCareStatement;
  if (input.talkingPoints !== undefined) payload.talking_points = input.talkingPoints;
  if (input.researchCitations !== undefined) payload.research_citations = input.researchCitations;
  if (input.sourceStoryIds !== undefined) payload.source_story_ids = input.sourceStoryIds;
  if (input.status !== undefined) payload.status = input.status;
  if (input.reviewNotes !== undefined) payload.review_notes = input.reviewNotes;

  const { data, error } = await supabase
    .from('topic_proposals')
    .update(payload)
    .eq('id', id)
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update topic proposal');
  }

  return data as TopicProposal;
}

export async function deleteTopicProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from('topic_proposals')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================================
// Topic Generator Settings CRUD
// ============================================================================

export async function getTopicGeneratorSettings(projectId: string): Promise<TopicGeneratorSettings | null> {
  const { data, error } = await supabase
    .from('topic_generator_settings')
    .select(SETTINGS_COLUMNS)
    .eq('project_id', projectId)
    .single();

  if (error) {
    return null;
  }

  return data as TopicGeneratorSettings;
}

export async function upsertTopicGeneratorSettings(
  input: TopicGeneratorSettingsInput
): Promise<TopicGeneratorSettings> {
  const payload: Record<string, unknown> = {
    project_id: input.projectId,
    updated_at: new Date().toISOString(),
  };

  if (input.autoGenerationEnabled !== undefined) payload.auto_generation_enabled = input.autoGenerationEnabled;
  if (input.autoGenerationTime !== undefined) payload.auto_generation_time = input.autoGenerationTime;
  if (input.autoGenerationTimezone !== undefined) payload.auto_generation_timezone = input.autoGenerationTimezone;
  if (input.timeWindowDays !== undefined) payload.time_window_days = input.timeWindowDays;
  if (input.minStoriesForCluster !== undefined) payload.min_stories_for_cluster = input.minStoriesForCluster;
  if (input.maxProposalsPerRun !== undefined) payload.max_proposals_per_run = input.maxProposalsPerRun;
  if (input.focusCategories !== undefined) payload.focus_categories = input.focusCategories;
  if (input.comparisonRegions !== undefined) payload.comparison_regions = input.comparisonRegions;
  if (input.defaultDurationType !== undefined) payload.default_duration_type = input.defaultDurationType;
  if (input.defaultDurationSeconds !== undefined) payload.default_duration_seconds = input.defaultDurationSeconds;
  if (input.defaultAudienceProfileId !== undefined) payload.default_audience_profile_id = input.defaultAudienceProfileId;
  if (input.includeTrendingContext !== undefined) payload.include_trending_context = input.includeTrendingContext;

  const { data, error } = await supabase
    .from('topic_generator_settings')
    .upsert(payload, { onConflict: 'project_id' })
    .select(SETTINGS_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save topic generator settings');
  }

  return data as TopicGeneratorSettings;
}

// ============================================================================
// Flagged Stories Aggregation (for clustering)
// ============================================================================

export async function getFlaggedStoriesForClustering(
  projectId: string,
  userId: string,
  options?: {
    timeWindowDays?: number;
    focusCategories?: string[];
    limit?: number;
  }
): Promise<Array<{
  id: string;
  title: string;
  content: string;
  summary: string | null;
  source: string;
  category: string;
  published_at: string | null;
  is_trending: boolean;
  trend_score: number;
}>> {
  const timeWindowDays = options?.timeWindowDays || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

  // Get marked story IDs for this user/project
  const { data: markedStories, error: markedError } = await supabase
    .from('marked_stories')
    .select('news_story_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .gte('marked_at', cutoffDate.toISOString());

  if (markedError) {
    throw new Error(markedError.message);
  }

  if (!markedStories || markedStories.length === 0) {
    return [];
  }

  const storyIds = markedStories.map(m => m.news_story_id);

  // Fetch the actual stories
  let query = supabase
    .from('news_stories')
    .select('id, title, content, summary, source, category, published_at, is_trending, trend_score')
    .in('id', storyIds)
    .order('published_at', { ascending: false });

  if (options?.focusCategories && options.focusCategories.length > 0) {
    query = query.in('category', options.focusCategories);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: stories, error: storiesError } = await query;

  if (storiesError) {
    throw new Error(storiesError.message);
  }

  return stories || [];
}

/**
 * Get all flagged stories for a project (across all users) for auto-generation
 */
export async function getAllFlaggedStoriesForProject(
  projectId: string,
  options?: {
    timeWindowDays?: number;
    focusCategories?: string[];
    limit?: number;
  }
): Promise<Array<{
  id: string;
  title: string;
  content: string;
  summary: string | null;
  source: string;
  category: string;
  published_at: string | null;
  is_trending: boolean;
  trend_score: number;
}>> {
  const timeWindowDays = options?.timeWindowDays || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

  // Get all marked story IDs for this project (all users)
  const { data: markedStories, error: markedError } = await supabase
    .from('marked_stories')
    .select('news_story_id')
    .eq('project_id', projectId)
    .gte('marked_at', cutoffDate.toISOString());

  if (markedError) {
    throw new Error(markedError.message);
  }

  if (!markedStories || markedStories.length === 0) {
    return [];
  }

  // Dedupe story IDs
  const storyIds = [...new Set(markedStories.map(m => m.news_story_id))];

  // Fetch the actual stories
  let query = supabase
    .from('news_stories')
    .select('id, title, content, summary, source, category, published_at, is_trending, trend_score')
    .in('id', storyIds)
    .order('published_at', { ascending: false });

  if (options?.focusCategories && options.focusCategories.length > 0) {
    query = query.in('category', options.focusCategories);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: stories, error: storiesError } = await query;

  if (storiesError) {
    throw new Error(storiesError.message);
  }

  return stories || [];
}

// ============================================================================
// Cluster Cache
// ============================================================================

export async function getCachedClusters(
  projectId: string,
  audienceProfileId: string | null
): Promise<TopicClustersCache | null> {
  const { data, error } = await supabase
    .from('topic_clusters_cache')
    .select('*')
    .eq('project_id', projectId)
    .eq('audience_profile_id', audienceProfileId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data as TopicClustersCache;
}

export async function saveClustersCache(
  projectId: string,
  audienceProfileId: string | null,
  clusters: TopicCluster[],
  storiesHash: string,
  trendsHash: string
): Promise<TopicClustersCache> {
  // Delete old cache first
  await supabase
    .from('topic_clusters_cache')
    .delete()
    .eq('project_id', projectId)
    .eq('audience_profile_id', audienceProfileId);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const { data, error } = await supabase
    .from('topic_clusters_cache')
    .insert({
      project_id: projectId,
      audience_profile_id: audienceProfileId,
      clusters: clusters,
      stories_hash: storiesHash,
      trends_hash: trendsHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save clusters cache');
  }

  return data as TopicClustersCache;
}

// ============================================================================
// Statistics
// ============================================================================

export async function getProposalStats(projectId: string): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byTrigger: Record<string, number>;
  lastAutoGeneration: string | null;
}> {
  const { data, error } = await supabase
    .from('topic_proposals')
    .select('status, generation_trigger, created_at')
    .eq('project_id', projectId);

  if (error) {
    throw new Error(error.message);
  }

  const proposals = data || [];
  const byStatus: Record<string, number> = {};
  const byTrigger: Record<string, number> = {};
  let lastAutoGeneration: string | null = null;

  for (const p of proposals) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byTrigger[p.generation_trigger] = (byTrigger[p.generation_trigger] || 0) + 1;

    if (p.generation_trigger === 'auto') {
      if (!lastAutoGeneration || p.created_at > lastAutoGeneration) {
        lastAutoGeneration = p.created_at;
      }
    }
  }

  return {
    total: proposals.length,
    byStatus,
    byTrigger,
    lastAutoGeneration,
  };
}

// ============================================================================
// Similar Proposals Detection
// ============================================================================

export interface SimilarProposalInfo {
  id: string;
  title: string;
  status: string;
  cluster_theme: string | null;
  source_story_ids: string[];
  created_at: string;
  overlap_count: number;
  overlap_percentage: number;
}

/**
 * Find existing proposals that share source stories with the given story IDs.
 * This helps detect when regenerating might create duplicate content.
 */
export async function findSimilarProposals(
  projectId: string,
  storyIds: string[],
  options?: {
    excludeStatuses?: string[];
    minOverlapPercentage?: number;
  }
): Promise<SimilarProposalInfo[]> {
  if (storyIds.length === 0) return [];

  // Get all proposals for the project
  const { data, error } = await supabase
    .from('topic_proposals')
    .select('id, title, status, cluster_theme, source_story_ids, created_at')
    .eq('project_id', projectId)
    .not('status', 'eq', 'archived');

  if (error) {
    throw new Error(error.message);
  }

  const proposals = data || [];
  const minOverlap = options?.minOverlapPercentage || 50;
  const excludeStatuses = options?.excludeStatuses || [];

  const similar: SimilarProposalInfo[] = [];

  for (const proposal of proposals) {
    if (excludeStatuses.includes(proposal.status)) continue;

    const proposalStoryIds = proposal.source_story_ids as string[];
    if (!proposalStoryIds || proposalStoryIds.length === 0) continue;

    // Calculate overlap
    const overlap = storyIds.filter(id => proposalStoryIds.includes(id));
    const overlapPercentage = (overlap.length / Math.min(storyIds.length, proposalStoryIds.length)) * 100;

    if (overlap.length > 0 && overlapPercentage >= minOverlap) {
      similar.push({
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        cluster_theme: proposal.cluster_theme,
        source_story_ids: proposalStoryIds,
        created_at: proposal.created_at,
        overlap_count: overlap.length,
        overlap_percentage: Math.round(overlapPercentage),
      });
    }
  }

  // Sort by overlap percentage descending
  return similar.sort((a, b) => b.overlap_percentage - a.overlap_percentage);
}
