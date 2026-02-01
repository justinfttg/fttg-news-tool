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
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
    staleTime: 30_000, // Consider stale after 30 seconds
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
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
    staleTime: 30_000, // Consider stale after 30 seconds
  });
}

// ============================================================================
// Watched Trends
// ============================================================================

export function useWatchedTrends(projectId: string) {
  return useQuery({
    queryKey: ['watchedTrends', projectId],
    queryFn: () => socialService.getWatchedTrends(projectId),
    enabled: !!projectId,
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
    staleTime: 30_000, // Consider stale after 30 seconds
  });
}

export function useWatchTrend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: socialService.createWatchedTrend,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['watchedTrends', variables.projectId],
      });
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
