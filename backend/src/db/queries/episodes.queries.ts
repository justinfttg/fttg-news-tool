import { supabase } from '../client';
import type { ProductionEpisode, ProductionMilestone } from '../../types';

// ---------------------------------------------------------------------------
// Column selection (single source of truth)
// ---------------------------------------------------------------------------

const EPISODE_COLUMNS = `
  id, project_id, topic_proposal_id, calendar_item_id, title, episode_number,
  tx_date, tx_time, timeline_type, production_status, client_approved_at,
  client_approved_by_user_id, internal_notes, client_feedback,
  created_at, updated_at, created_by_user_id
`;

const MILESTONE_COLUMNS = `
  id, episode_id, milestone_type, label, deadline_date, deadline_time,
  status, completed_at, completed_by_user_id, notes, is_client_facing,
  requires_client_approval, created_at, updated_at
`;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateEpisodeInput {
  projectId: string;
  topicProposalId?: string;
  calendarItemId?: string;
  title: string;
  episodeNumber?: number;
  txDate: string;
  txTime?: string;
  timelineType?: 'normal' | 'breaking_news' | 'emergency';
  productionStatus?: ProductionEpisode['production_status'];
  internalNotes?: string;
  createdByUserId: string;
}

export interface UpdateEpisodeInput {
  title?: string;
  episodeNumber?: number | null;
  txDate?: string;
  txTime?: string | null;
  timelineType?: 'normal' | 'breaking_news' | 'emergency';
  productionStatus?: ProductionEpisode['production_status'];
  clientApprovedAt?: string | null;
  clientApprovedByUserId?: string | null;
  internalNotes?: string | null;
  clientFeedback?: string | null;
  calendarItemId?: string | null;
}

export interface CreateMilestoneInput {
  episodeId: string;
  milestoneType: ProductionMilestone['milestone_type'];
  label?: string;
  deadlineDate: string;
  deadlineTime?: string;
  isClientFacing?: boolean;
  requiresClientApproval?: boolean;
  notes?: string;
}

export interface UpdateMilestoneInput {
  label?: string | null;
  deadlineDate?: string;
  deadlineTime?: string | null;
  status?: ProductionMilestone['status'];
  completedAt?: string | null;
  completedByUserId?: string | null;
  notes?: string | null;
  isClientFacing?: boolean;
  requiresClientApproval?: boolean;
}

// ---------------------------------------------------------------------------
// Episode Queries
// ---------------------------------------------------------------------------

/**
 * Get all episodes for a project, optionally filtered by date range
 */
export async function getEpisodes(
  projectId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    status?: ProductionEpisode['production_status'][];
    includeMilestones?: boolean;
  }
): Promise<ProductionEpisode[]> {
  let query = supabase
    .from('production_episodes')
    .select(EPISODE_COLUMNS)
    .eq('project_id', projectId)
    .order('tx_date', { ascending: true });

  if (options?.startDate) {
    query = query.gte('tx_date', options.startDate);
  }
  if (options?.endDate) {
    query = query.lte('tx_date', options.endDate);
  }
  if (options?.status && options.status.length > 0) {
    query = query.in('production_status', options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let episodes = (data || []) as ProductionEpisode[];

  // Fetch milestones if requested
  if (options?.includeMilestones && episodes.length > 0) {
    const episodeIds = episodes.map((e) => e.id);
    const milestones = await getMilestonesByEpisodeIds(episodeIds);

    const milestonesMap = new Map<string, ProductionMilestone[]>();
    for (const m of milestones) {
      const arr = milestonesMap.get(m.episode_id) || [];
      arr.push(m);
      milestonesMap.set(m.episode_id, arr);
    }

    episodes = episodes.map((e) => ({
      ...e,
      milestones: milestonesMap.get(e.id) || [],
    }));
  }

  return episodes;
}

/**
 * Get a single episode by ID
 */
export async function getEpisodeById(
  id: string,
  includeMilestones = true
): Promise<ProductionEpisode | null> {
  const { data, error } = await supabase
    .from('production_episodes')
    .select(EPISODE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  const episode = data as ProductionEpisode;

  if (includeMilestones) {
    episode.milestones = await getMilestonesByEpisodeId(id);
  }

  return episode;
}

/**
 * Get episode by topic proposal ID
 */
export async function getEpisodeByProposalId(
  proposalId: string
): Promise<ProductionEpisode | null> {
  const { data, error } = await supabase
    .from('production_episodes')
    .select(EPISODE_COLUMNS)
    .eq('topic_proposal_id', proposalId)
    .single();

  if (error) {
    return null;
  }

  return data as ProductionEpisode;
}

/**
 * Create a new episode
 */
export async function createEpisode(input: CreateEpisodeInput): Promise<ProductionEpisode> {
  const { data, error } = await supabase
    .from('production_episodes')
    .insert({
      project_id: input.projectId,
      topic_proposal_id: input.topicProposalId || null,
      calendar_item_id: input.calendarItemId || null,
      title: input.title,
      episode_number: input.episodeNumber || null,
      tx_date: input.txDate,
      tx_time: input.txTime || null,
      timeline_type: input.timelineType || 'normal',
      production_status: input.productionStatus || 'topic_pending',
      internal_notes: input.internalNotes || null,
      created_by_user_id: input.createdByUserId,
    })
    .select(EPISODE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create episode');
  }

  return data as ProductionEpisode;
}

/**
 * Update an episode
 */
export async function updateEpisode(
  id: string,
  input: UpdateEpisodeInput
): Promise<ProductionEpisode> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) payload.title = input.title;
  if (input.episodeNumber !== undefined) payload.episode_number = input.episodeNumber;
  if (input.txDate !== undefined) payload.tx_date = input.txDate;
  if (input.txTime !== undefined) payload.tx_time = input.txTime;
  if (input.timelineType !== undefined) payload.timeline_type = input.timelineType;
  if (input.productionStatus !== undefined) payload.production_status = input.productionStatus;
  if (input.clientApprovedAt !== undefined) payload.client_approved_at = input.clientApprovedAt;
  if (input.clientApprovedByUserId !== undefined) payload.client_approved_by_user_id = input.clientApprovedByUserId;
  if (input.internalNotes !== undefined) payload.internal_notes = input.internalNotes;
  if (input.clientFeedback !== undefined) payload.client_feedback = input.clientFeedback;
  if (input.calendarItemId !== undefined) payload.calendar_item_id = input.calendarItemId;

  const { data, error } = await supabase
    .from('production_episodes')
    .update(payload)
    .eq('id', id)
    .select(EPISODE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update episode');
  }

  return data as ProductionEpisode;
}

/**
 * Delete an episode (cascades to milestones)
 */
export async function deleteEpisode(id: string): Promise<void> {
  const { error } = await supabase.from('production_episodes').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get next episode number for a project
 */
export async function getNextEpisodeNumber(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from('production_episodes')
    .select('episode_number')
    .eq('project_id', projectId)
    .not('episode_number', 'is', null)
    .order('episode_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return 1;
  }

  return (data[0].episode_number || 0) + 1;
}

// ---------------------------------------------------------------------------
// Milestone Queries
// ---------------------------------------------------------------------------

/**
 * Get milestones for an episode
 */
export async function getMilestonesByEpisodeId(
  episodeId: string
): Promise<ProductionMilestone[]> {
  const { data, error } = await supabase
    .from('production_milestones')
    .select(MILESTONE_COLUMNS)
    .eq('episode_id', episodeId)
    .order('deadline_date', { ascending: true })
    .order('deadline_time', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ProductionMilestone[];
}

/**
 * Get milestones for multiple episodes
 */
export async function getMilestonesByEpisodeIds(
  episodeIds: string[]
): Promise<ProductionMilestone[]> {
  if (episodeIds.length === 0) return [];

  const { data, error } = await supabase
    .from('production_milestones')
    .select(MILESTONE_COLUMNS)
    .in('episode_id', episodeIds)
    .order('deadline_date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ProductionMilestone[];
}

/**
 * Get a single milestone by ID
 */
export async function getMilestoneById(id: string): Promise<ProductionMilestone | null> {
  const { data, error } = await supabase
    .from('production_milestones')
    .select(MILESTONE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as ProductionMilestone;
}

/**
 * Create a milestone
 */
export async function createMilestone(
  input: CreateMilestoneInput
): Promise<ProductionMilestone> {
  const { data, error } = await supabase
    .from('production_milestones')
    .insert({
      episode_id: input.episodeId,
      milestone_type: input.milestoneType,
      label: input.label || null,
      deadline_date: input.deadlineDate,
      deadline_time: input.deadlineTime || null,
      is_client_facing: input.isClientFacing ?? false,
      requires_client_approval: input.requiresClientApproval ?? false,
      notes: input.notes || null,
      status: 'pending',
    })
    .select(MILESTONE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create milestone');
  }

  return data as ProductionMilestone;
}

/**
 * Create multiple milestones
 */
export async function createMilestones(
  inputs: CreateMilestoneInput[]
): Promise<ProductionMilestone[]> {
  if (inputs.length === 0) return [];

  const rows = inputs.map((input) => ({
    episode_id: input.episodeId,
    milestone_type: input.milestoneType,
    label: input.label || null,
    deadline_date: input.deadlineDate,
    deadline_time: input.deadlineTime || null,
    is_client_facing: input.isClientFacing ?? false,
    requires_client_approval: input.requiresClientApproval ?? false,
    notes: input.notes || null,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('production_milestones')
    .insert(rows)
    .select(MILESTONE_COLUMNS);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create milestones');
  }

  return data as ProductionMilestone[];
}

/**
 * Update a milestone
 */
export async function updateMilestone(
  id: string,
  input: UpdateMilestoneInput
): Promise<ProductionMilestone> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.label !== undefined) payload.label = input.label;
  if (input.deadlineDate !== undefined) payload.deadline_date = input.deadlineDate;
  if (input.deadlineTime !== undefined) payload.deadline_time = input.deadlineTime;
  if (input.status !== undefined) payload.status = input.status;
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt;
  if (input.completedByUserId !== undefined) payload.completed_by_user_id = input.completedByUserId;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.isClientFacing !== undefined) payload.is_client_facing = input.isClientFacing;
  if (input.requiresClientApproval !== undefined) payload.requires_client_approval = input.requiresClientApproval;

  const { data, error } = await supabase
    .from('production_milestones')
    .update(payload)
    .eq('id', id)
    .select(MILESTONE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update milestone');
  }

  return data as ProductionMilestone;
}

/**
 * Delete all milestones for an episode
 */
export async function deleteMilestonesByEpisodeId(episodeId: string): Promise<void> {
  const { error } = await supabase
    .from('production_milestones')
    .delete()
    .eq('episode_id', episodeId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get upcoming milestones across all episodes for a project
 */
export async function getUpcomingMilestones(
  projectId: string,
  options?: {
    days?: number;
    status?: ProductionMilestone['status'][];
    clientFacingOnly?: boolean;
  }
): Promise<(ProductionMilestone & { episode: ProductionEpisode })[]> {
  const days = options?.days ?? 7;
  const today = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let query = supabase
    .from('production_milestones')
    .select(`
      ${MILESTONE_COLUMNS},
      episode:production_episodes!inner(${EPISODE_COLUMNS})
    `)
    .eq('episode.project_id', projectId)
    .gte('deadline_date', today)
    .lte('deadline_date', endDate)
    .order('deadline_date', { ascending: true });

  if (options?.status && options.status.length > 0) {
    query = query.in('status', options.status);
  }
  if (options?.clientFacingOnly) {
    query = query.eq('is_client_facing', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Transform episode array to single object (Supabase returns arrays for joins)
  return (data || []).map((row: any) => ({
    ...row,
    episode: Array.isArray(row.episode) ? row.episode[0] : row.episode,
  })) as (ProductionMilestone & { episode: ProductionEpisode })[];
}

/**
 * Get overdue milestones for a project
 */
export async function getOverdueMilestones(
  projectId: string
): Promise<(ProductionMilestone & { episode: ProductionEpisode })[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('production_milestones')
    .select(`
      ${MILESTONE_COLUMNS},
      episode:production_episodes!inner(${EPISODE_COLUMNS})
    `)
    .eq('episode.project_id', projectId)
    .lt('deadline_date', today)
    .in('status', ['pending', 'in_progress'])
    .order('deadline_date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  // Transform episode array to single object
  return (data || []).map((row: any) => ({
    ...row,
    episode: Array.isArray(row.episode) ? row.episode[0] : row.episode,
  })) as (ProductionMilestone & { episode: ProductionEpisode })[];
}

/**
 * Mark overdue milestones as overdue
 */
export async function markOverdueMilestones(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('production_milestones')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .lt('deadline_date', today)
    .in('status', ['pending', 'in_progress'])
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  return data?.length || 0;
}
