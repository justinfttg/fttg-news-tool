import api from './api';
import { AudienceProfile } from '../types';

export interface CreateAudienceProfileInput {
  projectId: string;
  name: string;
  ageRange?: string;
  location?: string;
  educationLevel?: string;
  values?: string[];
  fears?: string[];
  aspirations?: string[];
  preferredTone?: AudienceProfile['preferred_tone'];
  depthPreference?: AudienceProfile['depth_preference'];
  politicalSensitivity?: number | null;
}

export interface UpdateAudienceProfileInput {
  name?: string;
  ageRange?: string | null;
  location?: string | null;
  educationLevel?: string | null;
  values?: string[];
  fears?: string[];
  aspirations?: string[];
  preferredTone?: AudienceProfile['preferred_tone'];
  depthPreference?: AudienceProfile['depth_preference'];
  politicalSensitivity?: number | null;
}

export async function getAudienceProfiles(projectId: string): Promise<AudienceProfile[]> {
  const { data } = await api.get<AudienceProfile[]>('/audience/profiles', {
    params: { projectId },
  });
  return data;
}

export async function createAudienceProfile(input: CreateAudienceProfileInput): Promise<AudienceProfile> {
  const { data } = await api.post<AudienceProfile>('/audience/profiles', input);
  return data;
}

export async function updateAudienceProfile(
  id: string,
  input: UpdateAudienceProfileInput
): Promise<AudienceProfile> {
  const { data } = await api.put<AudienceProfile>(`/audience/profiles/${id}`, input);
  return data;
}

export async function deleteAudienceProfile(id: string): Promise<void> {
  await api.delete(`/audience/profiles/${id}`);
}
