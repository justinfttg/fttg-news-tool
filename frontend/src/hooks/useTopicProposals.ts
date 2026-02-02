import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTopicProposals,
  getTopicProposalById,
  generateTopicProposals,
  updateTopicProposal,
  deleteTopicProposal,
  previewClusters,
  getTopicGeneratorSettings,
  updateTopicGeneratorSettings,
  ListProposalsParams,
  GenerateProposalsParams,
  UpdateProposalParams,
  PreviewClustersParams,
  SettingsUpdateParams,
} from '../services/topic-proposal.service';
import type { ProposalStatus } from '../types';

// ============================================================================
// Query Keys
// ============================================================================

export const topicProposalKeys = {
  all: ['topicProposals'] as const,
  lists: () => [...topicProposalKeys.all, 'list'] as const,
  list: (params: ListProposalsParams) => [...topicProposalKeys.lists(), params] as const,
  details: () => [...topicProposalKeys.all, 'detail'] as const,
  detail: (id: string) => [...topicProposalKeys.details(), id] as const,
  clusters: (projectId: string, audienceProfileId: string) =>
    [...topicProposalKeys.all, 'clusters', projectId, audienceProfileId] as const,
  settings: (projectId: string) => [...topicProposalKeys.all, 'settings', projectId] as const,
};

// ============================================================================
// Hooks: Topic Proposals
// ============================================================================

export function useTopicProposals(params: ListProposalsParams) {
  return useQuery({
    queryKey: topicProposalKeys.list(params),
    queryFn: () => getTopicProposals(params),
    enabled: !!params.projectId,
  });
}

export function useTopicProposal(id: string | undefined) {
  return useQuery({
    queryKey: topicProposalKeys.detail(id || ''),
    queryFn: () => getTopicProposalById(id!),
    enabled: !!id,
  });
}

export function useGenerateProposals(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GenerateProposalsParams) => generateTopicProposals(params),
    onSuccess: () => {
      // Invalidate all proposal lists for this project
      queryClient.invalidateQueries({
        queryKey: topicProposalKeys.lists(),
        predicate: (query) => {
          const key = query.queryKey as unknown[];
          return key.length >= 3 && (key[2] as any)?.projectId === projectId;
        },
      });
    },
  });
}

export function useUpdateProposal(_projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...params }: UpdateProposalParams & { id: string }) =>
      updateTopicProposal(id, params),
    onSuccess: (updatedProposal) => {
      // Update the cache for this specific proposal
      queryClient.setQueryData(
        topicProposalKeys.detail(updatedProposal.id),
        updatedProposal
      );
      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: topicProposalKeys.lists(),
      });
    },
  });
}

export function useDeleteProposal(_projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTopicProposal(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: topicProposalKeys.detail(deletedId),
      });
      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: topicProposalKeys.lists(),
      });
    },
  });
}

// ============================================================================
// Hooks: Cluster Preview
// ============================================================================

export function usePreviewClusters(params: PreviewClustersParams | null) {
  return useQuery({
    queryKey: params
      ? topicProposalKeys.clusters(params.projectId, params.audienceProfileId)
      : ['disabled'],
    queryFn: () => previewClusters(params!),
    enabled: !!params?.projectId && !!params?.audienceProfileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRefreshClusters(_projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: PreviewClustersParams) =>
      previewClusters({ ...params, forceRefresh: true }),
    onSuccess: (data, params) => {
      queryClient.setQueryData(
        topicProposalKeys.clusters(params.projectId, params.audienceProfileId),
        data
      );
    },
  });
}

// ============================================================================
// Hooks: Settings
// ============================================================================

export function useTopicGeneratorSettings(projectId: string | undefined) {
  return useQuery({
    queryKey: topicProposalKeys.settings(projectId || ''),
    queryFn: () => getTopicGeneratorSettings(projectId!),
    enabled: !!projectId,
  });
}

export function useUpdateSettings(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SettingsUpdateParams) => updateTopicGeneratorSettings(params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: topicProposalKeys.settings(projectId),
      });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

export function useProposalsByStatus(projectId: string, status: ProposalStatus) {
  return useTopicProposals({ projectId, status });
}

export function useDraftProposals(projectId: string) {
  return useProposalsByStatus(projectId, 'draft');
}

export function useApprovedProposals(projectId: string) {
  return useProposalsByStatus(projectId, 'approved');
}
