import { supabase } from '../client';
import type { AudienceProfile } from '../../types';

// ---------------------------------------------------------------------------
// Column selection (single source of truth)
// ---------------------------------------------------------------------------

const PROFILE_COLUMNS = 'id, project_id, name, age_range, location, education_level, values, fears, aspirations, preferred_tone, depth_preference, political_sensitivity, created_at, updated_at';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

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
  politicalSensitivity?: number;
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
      age_range: input.ageRange || null,
      location: input.location || null,
      education_level: input.educationLevel || null,
      values: input.values || [],
      fears: input.fears || [],
      aspirations: input.aspirations || [],
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

  if (input.name !== undefined) payload.name = input.name;
  if (input.ageRange !== undefined) payload.age_range = input.ageRange;
  if (input.location !== undefined) payload.location = input.location;
  if (input.educationLevel !== undefined) payload.education_level = input.educationLevel;
  if (input.values !== undefined) payload.values = input.values;
  if (input.fears !== undefined) payload.fears = input.fears;
  if (input.aspirations !== undefined) payload.aspirations = input.aspirations;
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
