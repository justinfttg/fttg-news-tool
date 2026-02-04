import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEpisodes,
  getEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  rescheduleEpisode,
  cancelEpisode,
  getEpisodeSummary,
  getEpisodeMilestones,
  updateMilestone,
  completeMilestone,
  getUpcomingMilestones,
  getOverdueMilestones,
  type ListEpisodesParams,
  type CreateEpisodeInput,
  type UpdateEpisodeInput,
  type RescheduleEpisodeInput,
  type UpdateMilestoneInput,
  type UpcomingMilestonesParams,
} from '../services/episode.service';

// ---------------------------------------------------------------------------
// Episode Hooks
// ---------------------------------------------------------------------------

export function useEpisodes(params: ListEpisodesParams | undefined) {
  return useQuery({
    queryKey: ['episodes', params],
    queryFn: () => getEpisodes(params!),
    enabled: !!params?.projectId,
  });
}

export function useEpisode(id: string | undefined) {
  return useQuery({
    queryKey: ['episode', id],
    queryFn: () => getEpisode(id!),
    enabled: !!id,
  });
}

export function useCreateEpisode(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEpisodeInput) => createEpisode(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['episodeSummary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}

export function useUpdateEpisode(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateEpisodeInput & { id: string }) =>
      updateEpisode(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['episode', data.id] });
      queryClient.invalidateQueries({ queryKey: ['episodeSummary', projectId] });
    },
  });
}

export function useDeleteEpisode(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['episodeSummary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}

export function useRescheduleEpisode(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: RescheduleEpisodeInput & { id: string }) =>
      rescheduleEpisode(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['episode', data.id] });
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingMilestones'] });
    },
  });
}

export function useCancelEpisode(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelEpisode,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['episode', data.id] });
      queryClient.invalidateQueries({ queryKey: ['episodeSummary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}

export function useEpisodeSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: ['episodeSummary', projectId],
    queryFn: () => getEpisodeSummary(projectId!),
    enabled: !!projectId,
  });
}

// ---------------------------------------------------------------------------
// Milestone Hooks
// ---------------------------------------------------------------------------

export function useEpisodeMilestones(episodeId: string | undefined) {
  return useQuery({
    queryKey: ['episodeMilestones', episodeId],
    queryFn: () => getEpisodeMilestones(episodeId!),
    enabled: !!episodeId,
  });
}

export function useUpdateMilestone(episodeId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      ...input
    }: UpdateMilestoneInput & { milestoneId: string }) =>
      updateMilestone(episodeId!, milestoneId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodeMilestones', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['overdueMilestones'] });
    },
  });
}

export function useCompleteMilestone(episodeId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, notes }: { milestoneId: string; notes?: string }) =>
      completeMilestone(episodeId!, milestoneId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodeMilestones', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['overdueMilestones'] });
    },
  });
}

export function useUpcomingMilestones(params: UpcomingMilestonesParams | undefined) {
  return useQuery({
    queryKey: ['upcomingMilestones', params],
    queryFn: () => getUpcomingMilestones(params!),
    enabled: !!params?.projectId,
  });
}

export function useOverdueMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: ['overdueMilestones', projectId],
    queryFn: () => getOverdueMilestones(projectId!),
    enabled: !!projectId,
  });
}
