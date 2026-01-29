// Social Listener API service

import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface SocialPost {
  platform: 'x' | 'reddit' | 'google_trends' | 'youtube' | 'tiktok' | 'instagram';
  externalId: string;
  authorHandle: string | null;
  authorName: string | null;
  authorFollowers: number | null;
  content: string;
  postUrl: string | null;
  mediaUrls: string[];
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  hashtags: string[];
  topics: string[];
  region: string | null;
  category: string | null;
  postedAt: string | null;
}

export interface TrendingTopic {
  name: string;
  hashtag: string | null;
  platforms: string[];
  engagement: number;
  posts: number;
  score: number;
  url: string | null;
  region: string | null;
  crossPlatform: boolean;
}

export interface HashtagSummary {
  hashtag: string;
  posts: number;
  engagement: number;
  platforms: string[];
  momentum: 'rising' | 'falling' | 'stable';
}

export interface WatchedTrend {
  id: string;
  query: string;
  queryType: 'hashtag' | 'keyword' | 'phrase';
  platforms: string[];
  regions: string[];
  isActive: boolean;
  createdAt: string;
  lastScrapedAt: string | null;
}

// ============================================================================
// API Calls
// ============================================================================

export async function getViralPosts(options?: {
  platforms?: string[];
  region?: string;
  limit?: number;
  category?: string;
}): Promise<{ posts: SocialPost[]; hashtags: HashtagSummary[] }> {
  const params = new URLSearchParams();
  if (options?.platforms) params.set('platforms', options.platforms.join(','));
  if (options?.region) params.set('region', options.region);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.category) params.set('category', options.category);

  const response = await api.get(`/social-listener/viral-posts?${params}`);
  return response.data;
}

export async function getTrendingTopics(options?: {
  platforms?: string[];
  region?: string;
  limit?: number;
}): Promise<{ topics: TrendingTopic[] }> {
  const params = new URLSearchParams();
  if (options?.platforms) params.set('platforms', options.platforms.join(','));
  if (options?.region) params.set('region', options.region);
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await api.get(`/social-listener/trending?${params}`);
  return response.data;
}

export async function getWatchedTrends(
  projectId: string
): Promise<{ trends: WatchedTrend[] }> {
  const response = await api.get(
    `/social-listener/watched-trends?projectId=${projectId}`
  );
  return response.data;
}

export async function createWatchedTrend(input: {
  query: string;
  queryType: 'hashtag' | 'keyword' | 'phrase';
  projectId: string;
  platforms?: string[];
  regions?: string[];
}): Promise<{ trend: WatchedTrend }> {
  const response = await api.post('/social-listener/watched-trends', input);
  return response.data;
}

export async function deleteWatchedTrend(trendId: string): Promise<void> {
  await api.delete(`/social-listener/watched-trends?id=${trendId}`);
}
