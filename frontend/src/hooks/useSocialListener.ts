// React Query hooks for Social Listener

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as socialService from '../services/social-listener.service';

// ============================================================================
// Viral Posts
// ============================================================================

export function useViralPosts(options?: {
  platforms?: string[];
  region?: string;
  limit?: number;
  category?: string;
}) {
  return useQuery({
    queryKey: ['viralPosts', options],
    queryFn: () => socialService.getViralPosts(options),
    staleTime: 30_000, // Consider stale after 30 seconds - manual refresh will fetch fresh data
  });
}

// ============================================================================
// Trending Topics
// ============================================================================

export function useTrendingTopics(options?: {
  platforms?: string[];
  region?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['trendingTopics', options],
    queryFn: () => socialService.getTrendingTopics(options),
    staleTime: 30_000, // Consider stale after 30 seconds - manual refresh will fetch fresh data
  });
}

// ============================================================================
// Watched Trends
// ============================================================================

export function useWatchedTrends(projectId: string) {
  return useQuery({
    queryKey: ['watchedTrends', projectId],
    queryFn: async () => {
      console.log('[useWatchedTrends] Fetching watched trends for project:', projectId);
      const result = await socialService.getWatchedTrends(projectId);
      console.log('[useWatchedTrends] Got trends:', result);
      return result;
    },
    enabled: !!projectId,
    staleTime: 30_000, // Consider stale after 30 seconds - manual refresh will fetch fresh data
  });
}

export function useWatchTrend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: socialService.createWatchedTrend,
    onSuccess: (data, variables) => {
      console.log('[useWatchTrend] Successfully created watched trend:', data);
      queryClient.invalidateQueries({
        queryKey: ['watchedTrends', variables.projectId],
      });
    },
    onError: (error: Error) => {
      console.error('[useWatchTrend] Failed to create watched trend:', error);
    },
  });
}

export function useUnwatchTrend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: socialService.deleteWatchedTrend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchedTrends'] });
    },
  });
}
