import api from './api';
import { StoryAngle } from '../types';

export interface GenerateAngleParams {
  newsStoryId: string;
  audienceProfileId: string;
  projectId: string;
  frameworkType: 'fttg_investigative' | 'educational_deepdive';
  comparisonRegions?: string[];
}

export interface GenerateAngleResponse {
  angle: StoryAngle;
  framework_type: string;
}

export interface AngleWithDetails extends StoryAngle {
  news_stories?: {
    id: string;
    title: string;
    summary: string | null;
    content: string;
    source: string;
    url: string | null;
    published_at: string | null;
  };
  audience_profiles?: {
    id: string;
    name: string;
    primary_language: string | null;
    market_region: string | null;
  };
}

export async function generateAngle(params: GenerateAngleParams): Promise<GenerateAngleResponse> {
  const { data } = await api.post<GenerateAngleResponse>('/angles/generate', params);
  return data;
}

export async function getAngles(projectId: string, storyId?: string): Promise<AngleWithDetails[]> {
  const params = new URLSearchParams({ projectId });
  if (storyId) {
    params.append('storyId', storyId);
  }
  const { data } = await api.get<{ angles: AngleWithDetails[] }>(`/angles?${params}`);
  return data.angles;
}

export async function getAngle(id: string): Promise<AngleWithDetails> {
  const { data } = await api.get<{ angle: AngleWithDetails }>(`/angles/${id}`);
  return data.angle;
}

export async function updateAngleStatus(
  id: string,
  status: 'draft' | 'approved' | 'archived'
): Promise<StoryAngle> {
  const { data } = await api.patch<{ angle: StoryAngle }>(`/angles/${id}/status`, { status });
  return data.angle;
}

export async function deleteAngle(id: string): Promise<void> {
  await api.delete(`/angles/${id}`);
}
