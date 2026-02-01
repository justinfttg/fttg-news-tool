import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNewsFeed,
  getTrendingNews,
  getMarkedStories,
  markStory,
  unmarkStory,
  getMarkedIds,
} from '../services/news.service';

/**
 * Infinite-scroll paginated news feed with optional region/category filters.
 */
export function useNewsFeed(filters: {
  regions?: string[];  // Support multiple regions
  category?: string;
  limit?: number;
}) {
  const limit = filters.limit || 20;
  // Create stable key for regions array
  const regionsKey = filters.regions?.sort().join(',') || '';

  return useInfiniteQuery({
    queryKey: ['newsFeed', regionsKey, filters.category, limit],
    queryFn: ({ pageParam = 1 }) =>
      getNewsFeed({
        regions: filters.regions,
        category: filters.category,
        page: pageParam,
        limit,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 30_000, // Consider stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Fetch trending stories (non-paginated, single list).
 */
export function useTrendingNews(limit?: number) {
  return useQuery({
    queryKey: ['trendingNews', limit],
    queryFn: () => getTrendingNews(limit),
  });
}

/**
 * Search news by text query — reuses the feed endpoint with a category filter.
 * For a full-text search you'd need a dedicated backend endpoint; this is
 * a lightweight client-side filter on top of the feed.
 */
export function useSearchNews(
  query: string,
  filters: { regions?: string[]; category?: string }
) {
  const limit = 20;
  const regionsKey = filters.regions?.sort().join(',') || '';

  return useInfiniteQuery({
    queryKey: ['newsSearch', query, regionsKey, filters.category, limit],
    queryFn: ({ pageParam = 1 }) =>
      getNewsFeed({
        regions: filters.regions,
        category: filters.category,
        page: pageParam,
        limit,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled: query.length >= 2,
  });
}

// ---------------------------------------------------------------------------
// Marked Stories Hooks
// ---------------------------------------------------------------------------

/**
 * Infinite-scroll paginated marked stories feed.
 */
export function useMarkedStories(projectId: string, limit?: number) {
  const pageLimit = limit || 20;

  return useInfiniteQuery({
    queryKey: ['markedStories', projectId, pageLimit],
    queryFn: ({ pageParam = 1 }) =>
      getMarkedStories({
        projectId,
        page: pageParam,
        limit: pageLimit,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch all marked story IDs for the current user.
 * Used to show which stories are marked in the feed.
 */
export function useMarkedIds() {
  return useQuery({
    queryKey: ['markedIds'],
    queryFn: getMarkedIds,
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Mark a story mutation.
 */
export function useMarkStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, newsStoryId }: { projectId: string; newsStoryId: string }) =>
      markStory(projectId, newsStoryId),
    onSuccess: () => {
      // Invalidate marked stories and IDs cache
      queryClient.invalidateQueries({ queryKey: ['markedStories'] });
      queryClient.invalidateQueries({ queryKey: ['markedIds'] });
    },
  });
}

/**
 * Unmark a story mutation.
 */
export function useUnmarkStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newsStoryId: string) => unmarkStory(newsStoryId),
    onSuccess: () => {
      // Invalidate marked stories and IDs cache
      queryClient.invalidateQueries({ queryKey: ['markedStories'] });
      queryClient.invalidateQueries({ queryKey: ['markedIds'] });
    },
  });
}
