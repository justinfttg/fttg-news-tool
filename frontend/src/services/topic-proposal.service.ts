import api from './api';
import type {
  TopicProposal,
  TopicGeneratorSettings,
  TopicCluster,
  TalkingPoint,
  ResearchCitation,
  DurationType,
  ProposalStatus,
  NewsStory,
} from '../types';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ListProposalsParams {
  projectId: string;
  status?: ProposalStatus;
  audienceProfileId?: string;
  limit?: number;
  offset?: number;
}

export interface GenerateProposalsParams {
  projectId: string;
  audienceProfileId: string;
  durationType: DurationType;
  durationSeconds?: number;
  comparisonRegions?: string[];
  clusterIds?: number[];
  maxProposals?: number;
}

export interface PreviewClustersParams {
  projectId: string;
  audienceProfileId: string;
  forceRefresh?: boolean;
}

export interface UpdateProposalParams {
  title?: string;
  hook?: string;
  audienceCareStatement?: string | null;
  talkingPoints?: TalkingPoint[];
  researchCitations?: ResearchCitation[];
  status?: ProposalStatus;
  reviewNotes?: string | null;
}

export interface SettingsUpdateParams {
  projectId: string;
  autoGenerationEnabled?: boolean;
  autoGenerationTime?: string;
  autoGenerationTimezone?: string;
  timeWindowDays?: number;
  minStoriesForCluster?: number;
  maxProposalsPerRun?: number;
  focusCategories?: string[];
  comparisonRegions?: string[];
  defaultDurationType?: DurationType;
  defaultDurationSeconds?: number;
  defaultAudienceProfileId?: string | null;
  includeTrendingContext?: boolean;
}

// Response types
export interface ListProposalsResponse {
  proposals: TopicProposal[];
}

export interface GenerateProposalsResponse {
  proposals: TopicProposal[];
  clustersProcessed: number;
  totalClusters: number;
}

export interface PreviewClustersResponse {
  clusters: (TopicCluster & { stories?: NewsStory[] })[];
  stories: NewsStory[];
  trendingContext?: any[];
  fromCache: boolean;
  message?: string;
}

export interface SettingsResponse {
  settings: TopicGeneratorSettings;
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byTrigger: Record<string, number>;
    lastAutoGeneration: string | null;
  };
  isDefault: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

export async function getTopicProposals(params: ListProposalsParams): Promise<TopicProposal[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('projectId', params.projectId);
  if (params.status) searchParams.set('status', params.status);
  if (params.audienceProfileId) searchParams.set('audienceProfileId', params.audienceProfileId);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));

  const response = await api.get<ListProposalsResponse>(`/topics/proposals?${searchParams}`);
  return response.data.proposals;
}

export async function getTopicProposalById(id: string): Promise<TopicProposal> {
  const response = await api.get<{ proposal: TopicProposal }>(`/topics/proposals/${id}`);
  return response.data.proposal;
}

export async function generateTopicProposals(params: GenerateProposalsParams): Promise<GenerateProposalsResponse> {
  const response = await api.post<GenerateProposalsResponse>('/topics/proposals', params);
  return response.data;
}

export async function updateTopicProposal(id: string, params: UpdateProposalParams): Promise<TopicProposal> {
  const response = await api.patch<{ proposal: TopicProposal }>(`/topics/proposals/${id}`, params);
  return response.data.proposal;
}

export async function deleteTopicProposal(id: string): Promise<void> {
  await api.delete(`/topics/proposals/${id}`);
}

export async function previewClusters(params: PreviewClustersParams): Promise<PreviewClustersResponse> {
  const response = await api.post<PreviewClustersResponse>('/topics/preview-clusters', params);
  return response.data;
}

export async function getTopicGeneratorSettings(projectId: string): Promise<SettingsResponse> {
  const response = await api.get<SettingsResponse>(`/topics/settings?projectId=${projectId}`);
  return response.data;
}

export async function updateTopicGeneratorSettings(params: SettingsUpdateParams): Promise<TopicGeneratorSettings> {
  const response = await api.put<{ settings: TopicGeneratorSettings }>('/topics/settings', params);
  return response.data.settings;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getDurationLabel(type: DurationType, seconds?: number): string {
  switch (type) {
    case 'short':
      return 'Short (1-2 min)';
    case 'standard':
      return 'Standard (3-4 min)';
    case 'long':
      return 'Long (5-10 min)';
    case 'custom':
      return seconds ? `Custom (${Math.round(seconds / 60)} min)` : 'Custom';
    default:
      return type;
  }
}

export function getStatusColor(status: ProposalStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'reviewed':
      return 'bg-blue-100 text-blue-800';
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'archived':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
