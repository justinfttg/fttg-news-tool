import api from './api';
import { NewsStory } from '../types';

export interface NewsFeedResponse {
  stories: NewsStory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TrendingResponse {
  stories: NewsStory[];
  count: number;
}

export async function getNewsFeed(params: {
  region?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<NewsFeedResponse> {
  const { data } = await api.get<NewsFeedResponse>('/news/feed', { params });
  return data;
}

export async function getTrendingNews(limit?: number): Promise<TrendingResponse> {
  const { data } = await api.get<TrendingResponse>('/news/trending', {
    params: limit ? { limit } : undefined,
  });
  return data;
}

export async function getStoryById(id: string): Promise<NewsStory> {
  const { data } = await api.get<NewsStory>(`/news/story/${id}`);
  return data;
}
