import api from './api';
import { AudienceProfile } from '../types';

export interface CreateAudienceProfileInput {
  projectId: string;
  name: string;
  // Demographics
  ageRange?: string;
  location?: string;
  educationLevel?: string;
  // Language & Market
  primaryLanguage?: string;
  secondaryLanguages?: string[];
  marketRegion?: string;
  // Platform Info
  platformUrl?: string;
  platformName?: string;
  platformType?: AudienceProfile['platform_type'];
  contentCategories?: string[];
  audienceSize?: string;
  // Psychographics
  values?: string[];
  fears?: string[];
  aspirations?: string[];
  keyDemographics?: string;
  culturalContext?: string;
  // Content Preferences
  preferredTone?: AudienceProfile['preferred_tone'];
  depthPreference?: AudienceProfile['depth_preference'];
  politicalSensitivity?: number | null;
}

export interface UpdateAudienceProfileInput {
  name?: string;
  // Demographics
  ageRange?: string | null;
  location?: string | null;
  educationLevel?: string | null;
  // Language & Market
  primaryLanguage?: string | null;
  secondaryLanguages?: string[];
  marketRegion?: string | null;
  // Platform Info
  platformUrl?: string | null;
  platformName?: string | null;
  platformType?: AudienceProfile['platform_type'];
  contentCategories?: string[];
  audienceSize?: string | null;
  // Psychographics
  values?: string[];
  fears?: string[];
  aspirations?: string[];
  keyDemographics?: string | null;
  culturalContext?: string | null;
  // Content Preferences
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

export interface AnalyzedAudienceResult {
  platformName: string | null;
  platformType: AudienceProfile['platform_type'];
  primaryLanguage: string | null;
  secondaryLanguages: string[];
  marketRegion: string | null;
  contentCategories: string[];
  audienceSize: string | null;
  ageRange: string | null;
  location: string | null;
  educationLevel: string | null;
  keyDemographics: string | null;
  culturalContext: string | null;
  values: string[];
  fears: string[];
  aspirations: string[];
  preferredTone: AudienceProfile['preferred_tone'];
  depthPreference: AudienceProfile['depth_preference'];
  politicalSensitivity: number | null;
}

export async function analyzeAudienceFromUrl(url: string): Promise<AnalyzedAudienceResult> {
  const { data } = await api.post<AnalyzedAudienceResult>('/audience/analyze', { url });
  return data;
}
