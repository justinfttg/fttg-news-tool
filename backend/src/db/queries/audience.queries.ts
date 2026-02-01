import { supabase } from '../client';
import type { AudienceProfile } from '../../types';

// ---------------------------------------------------------------------------
// Column selection (single source of truth)
// ---------------------------------------------------------------------------

const PROFILE_COLUMNS = `
  id, project_id, name,
  age_range, location, education_level,
  primary_language, secondary_languages, market_region,
  platform_url, platform_name, platform_type, content_categories, audience_size,
  values, fears, aspirations, key_demographics, cultural_context,
  preferred_tone, depth_preference, political_sensitivity,
  created_at, updated_at
`;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. getAudienceProfiles — list profiles for a project
// ---------------------------------------------------------------------------

export async function getAudienceProfiles(projectId: string): Promise<AudienceProfile[]> {
  const { data, error } = await supabase
    .from('audience_profiles')
    .select(PROFILE_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as AudienceProfile[];
}

// ---------------------------------------------------------------------------
// 2. getAudienceProfileById
// ---------------------------------------------------------------------------

export async function getAudienceProfileById(id: string): Promise<AudienceProfile | null> {
  const { data, error } = await supabase
    .from('audience_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as AudienceProfile;
}

// ---------------------------------------------------------------------------
// 3. createAudienceProfile
// ---------------------------------------------------------------------------

export async function createAudienceProfile(input: CreateAudienceProfileInput): Promise<AudienceProfile> {
  const { data, error } = await supabase
    .from('audience_profiles')
    .insert({
      project_id: input.projectId,
      name: input.name,
      // Demographics
      age_range: input.ageRange || null,
      location: input.location || null,
      education_level: input.educationLevel || null,
      // Language & Market
      primary_language: input.primaryLanguage || null,
      secondary_languages: input.secondaryLanguages || [],
      market_region: input.marketRegion || null,
      // Platform Info
      platform_url: input.platformUrl || null,
      platform_name: input.platformName || null,
      platform_type: input.platformType || null,
      content_categories: input.contentCategories || [],
      audience_size: input.audienceSize || null,
      // Psychographics
      values: input.values || [],
      fears: input.fears || [],
      aspirations: input.aspirations || [],
      key_demographics: input.keyDemographics || null,
      cultural_context: input.culturalContext || null,
      // Content Preferences
      preferred_tone: input.preferredTone || null,
      depth_preference: input.depthPreference || null,
      political_sensitivity: input.politicalSensitivity || null,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create audience profile');
  }

  return data as AudienceProfile;
}

// ---------------------------------------------------------------------------
// 4. updateAudienceProfile
// ---------------------------------------------------------------------------

export async function updateAudienceProfile(
  id: string,
  input: UpdateAudienceProfileInput
): Promise<AudienceProfile> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Demographics
  if (input.name !== undefined) payload.name = input.name;
  if (input.ageRange !== undefined) payload.age_range = input.ageRange;
  if (input.location !== undefined) payload.location = input.location;
  if (input.educationLevel !== undefined) payload.education_level = input.educationLevel;
  // Language & Market
  if (input.primaryLanguage !== undefined) payload.primary_language = input.primaryLanguage;
  if (input.secondaryLanguages !== undefined) payload.secondary_languages = input.secondaryLanguages;
  if (input.marketRegion !== undefined) payload.market_region = input.marketRegion;
  // Platform Info
  if (input.platformUrl !== undefined) payload.platform_url = input.platformUrl;
  if (input.platformName !== undefined) payload.platform_name = input.platformName;
  if (input.platformType !== undefined) payload.platform_type = input.platformType;
  if (input.contentCategories !== undefined) payload.content_categories = input.contentCategories;
  if (input.audienceSize !== undefined) payload.audience_size = input.audienceSize;
  // Psychographics
  if (input.values !== undefined) payload.values = input.values;
  if (input.fears !== undefined) payload.fears = input.fears;
  if (input.aspirations !== undefined) payload.aspirations = input.aspirations;
  if (input.keyDemographics !== undefined) payload.key_demographics = input.keyDemographics;
  if (input.culturalContext !== undefined) payload.cultural_context = input.culturalContext;
  // Content Preferences
  if (input.preferredTone !== undefined) payload.preferred_tone = input.preferredTone;
  if (input.depthPreference !== undefined) payload.depth_preference = input.depthPreference;
  if (input.politicalSensitivity !== undefined) payload.political_sensitivity = input.politicalSensitivity;

  const { data, error } = await supabase
    .from('audience_profiles')
    .update(payload)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update audience profile');
  }

  return data as AudienceProfile;
}

// ---------------------------------------------------------------------------
// 5. deleteAudienceProfile
// ---------------------------------------------------------------------------

export async function deleteAudienceProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from('audience_profiles')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
