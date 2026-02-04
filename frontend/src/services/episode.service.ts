import api from './api';
import type {
  ProductionEpisode,
  ProductionMilestone,
  EpisodeSummary,
  TimelineType,
  ProductionStatus,
  MilestoneStatus,
} from '../types';

// ---------------------------------------------------------------------------
// Episode API
// ---------------------------------------------------------------------------

export interface ListEpisodesParams {
  projectId: string;
  startDate?: string;
  endDate?: string;
  status?: ProductionStatus[];
  includeMilestones?: boolean;
}

export async function getEpisodes(params: ListEpisodesParams): Promise<ProductionEpisode[]> {
  const { data } = await api.get<ProductionEpisode[]>('/episodes', {
    params: {
      projectId: params.projectId,
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status?.join(','),
      includeMilestones: params.includeMilestones ? 'true' : undefined,
    },
  });
  return data;
}

export async function getEpisode(id: string): Promise<ProductionEpisode> {
  const { data } = await api.get<ProductionEpisode>(`/episodes/${id}`);
  return data;
}

export interface CreateEpisodeInput {
  projectId: string;
  topicProposalId?: string;
  title: string;
  txDate: string;
  txTime?: string;
  timelineType?: TimelineType;
  templateId?: string;
  episodeNumber?: number;
  internalNotes?: string;
}

export async function createEpisode(input: CreateEpisodeInput): Promise<ProductionEpisode> {
  const { data } = await api.post<ProductionEpisode>('/episodes', input);
  return data;
}

export interface UpdateEpisodeInput {
  title?: string;
  episodeNumber?: number | null;
  txTime?: string | null;
  timelineType?: TimelineType;
  productionStatus?: ProductionStatus;
  internalNotes?: string | null;
  clientFeedback?: string | null;
}

export async function updateEpisode(id: string, input: UpdateEpisodeInput): Promise<ProductionEpisode> {
  const { data } = await api.patch<ProductionEpisode>(`/episodes/${id}`, input);
  return data;
}

export async function deleteEpisode(id: string): Promise<void> {
  await api.delete(`/episodes/${id}`);
}

export interface RescheduleEpisodeInput {
  newTxDate: string;
  newTxTime?: string | null;
  preserveMilestoneStatus?: boolean;
}

export async function rescheduleEpisode(id: string, input: RescheduleEpisodeInput): Promise<ProductionEpisode> {
  const { data } = await api.post<ProductionEpisode>(`/episodes/${id}/reschedule`, input);
  return data;
}

export async function cancelEpisode(id: string): Promise<ProductionEpisode> {
  const { data } = await api.post<ProductionEpisode>(`/episodes/${id}/cancel`);
  return data;
}

export async function getEpisodeSummary(projectId: string): Promise<EpisodeSummary> {
  const { data } = await api.get<EpisodeSummary>('/episodes/summary', {
    params: { projectId },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Milestone API
// ---------------------------------------------------------------------------

export async function getEpisodeMilestones(episodeId: string): Promise<ProductionMilestone[]> {
  const { data } = await api.get<ProductionMilestone[]>(`/episodes/${episodeId}/milestones`);
  return data;
}

export interface UpdateMilestoneInput {
  label?: string | null;
  deadlineDate?: string;
  deadlineTime?: string | null;
  status?: MilestoneStatus;
  notes?: string | null;
  isClientFacing?: boolean;
  requiresClientApproval?: boolean;
}

export async function updateMilestone(
  episodeId: string,
  milestoneId: string,
  input: UpdateMilestoneInput
): Promise<ProductionMilestone> {
  const { data } = await api.patch<ProductionMilestone>(
    `/episodes/${episodeId}/milestones/${milestoneId}`,
    input
  );
  return data;
}

export async function completeMilestone(
  episodeId: string,
  milestoneId: string,
  notes?: string
): Promise<ProductionMilestone> {
  const { data } = await api.post<ProductionMilestone>(
    `/episodes/${episodeId}/milestones/${milestoneId}/complete`,
    { notes }
  );
  return data;
}

export interface UpcomingMilestonesParams {
  projectId: string;
  days?: number;
  clientFacingOnly?: boolean;
}

export async function getUpcomingMilestones(
  params: UpcomingMilestonesParams
): Promise<(ProductionMilestone & { episode: ProductionEpisode })[]> {
  const { data } = await api.get<(ProductionMilestone & { episode: ProductionEpisode })[]>(
    '/milestones/upcoming',
    {
      params: {
        projectId: params.projectId,
        days: params.days,
        clientFacingOnly: params.clientFacingOnly ? 'true' : undefined,
      },
    }
  );
  return data;
}

export async function getOverdueMilestones(
  projectId: string
): Promise<(ProductionMilestone & { episode: ProductionEpisode })[]> {
  const { data } = await api.get<(ProductionMilestone & { episode: ProductionEpisode })[]>(
    '/milestones/overdue',
    { params: { projectId } }
  );
  return data;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function formatMilestoneLabel(milestone: ProductionMilestone): string {
  if (milestone.label) return milestone.label;

  const labels: Record<string, string> = {
    topic_confirmation: 'Topic Confirmation',
    script_deadline: 'Script Deadline',
    script_approval: 'Script Approval',
    production_day: 'Production Day',
    post_production: 'Post-Production',
    draft_1_review: 'Draft 1 Review',
    draft_2_review: 'Draft 2 Review',
    final_delivery: 'Final Delivery',
    topic_approval: 'Topic Approval',
    custom: 'Custom Milestone',
  };

  return labels[milestone.milestone_type] || milestone.milestone_type;
}

export function getMilestoneStatusColor(status: MilestoneStatus): string {
  const colors: Record<MilestoneStatus, string> = {
    pending: 'gray',
    in_progress: 'blue',
    completed: 'green',
    overdue: 'red',
    skipped: 'gray',
  };
  return colors[status];
}

export function getProductionStatusLabel(status: ProductionStatus): string {
  const labels: Record<ProductionStatus, string> = {
    topic_pending: 'Topic Pending',
    topic_approved: 'Topic Approved',
    script_development: 'Script Development',
    script_review: 'Script Review',
    script_approved: 'Script Approved',
    in_production: 'In Production',
    post_production: 'Post-Production',
    draft_review: 'Draft Review',
    final_review: 'Final Review',
    delivered: 'Delivered',
    published: 'Published',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

export function getTimelineTypeLabel(type: TimelineType): string {
  const labels: Record<TimelineType, string> = {
    normal: 'Standard (7-Day)',
    breaking_news: 'Breaking News (3-Day)',
    emergency: 'Emergency (Same-Day)',
  };
  return labels[type];
}
