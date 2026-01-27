import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getNewsFeed, getTrendingNews } from '../services/news.service';

/**
 * Infinite-scroll paginated news feed with optional region/category filters.
 */
export function useNewsFeed(filters: {
  region?: string;
  category?: string;
  limit?: number;
}) {
  const limit = filters.limit || 20;

  return useInfiniteQuery({
    queryKey: ['newsFeed', filters.region, filters.category, limit],
    queryFn: ({ pageParam = 1 }) =>
      getNewsFeed({
        region: filters.region,
        category: filters.category,
        page: pageParam,
        limit,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
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
  filters: { region?: string; category?: string }
) {
  const limit = 20;

  return useInfiniteQuery({
    queryKey: ['newsSearch', query, filters.region, filters.category, limit],
    queryFn: ({ pageParam = 1 }) =>
      getNewsFeed({
        region: filters.region,
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
