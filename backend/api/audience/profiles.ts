import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getAudienceProfiles,
  getAudienceProfileById,
  createAudienceProfile,
  updateAudienceProfile,
  deleteAudienceProfile,
} from '../../src/db/queries/audience.queries';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PreferredTone = z.enum(['investigative', 'educational', 'balanced', 'provocative', 'conversational']);
const DepthPreference = z.enum(['surface', 'medium', 'deep_dive']);

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
});

const CreateProfileSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  ageRange: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  educationLevel: z.string().max(100).optional(),
  values: z.array(z.string()).default([]),
  fears: z.array(z.string()).default([]),
  aspirations: z.array(z.string()).default([]),
  preferredTone: PreferredTone.nullable().optional(),
  depthPreference: DepthPreference.nullable().optional(),
  politicalSensitivity: z.number().int().min(1).max(10).nullable().optional(),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ageRange: z.string().max(50).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  educationLevel: z.string().max(100).nullable().optional(),
  values: z.array(z.string()).optional(),
  fears: z.array(z.string()).optional(),
  aspirations: z.array(z.string()).optional(),
  preferredTone: PreferredTone.nullable().optional(),
  depthPreference: DepthPreference.nullable().optional(),
  politicalSensitivity: z.number().int().min(1).max(10).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyMembership(
  projectId: string,
  userId: string
): Promise<{ role: string } | null> {
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return data;
}

// ---------------------------------------------------------------------------
// GET /api/audience/profiles
// ---------------------------------------------------------------------------

export async function listHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { projectId } = ListQuerySchema.parse(req.query);

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const profiles = await getAudienceProfiles(projectId);
    return res.status(200).json(profiles);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch audience profiles';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/audience/profiles
// ---------------------------------------------------------------------------

export async function createHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const input = CreateProfileSchema.parse(req.body);

    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create audience profiles' });
    }

    const profile = await createAudienceProfile(input);
    return res.status(201).json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to create audience profile';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/audience/profiles/:id
// ---------------------------------------------------------------------------

export async function updateHandler(req: Request, res: Response) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const profileId = req.params.id;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID required' });
    }

    const existing = await getAudienceProfileById(profileId);
    if (!existing) {
      return res.status(404).json({ error: 'Audience profile not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update audience profiles' });
    }

    const input = UpdateProfileSchema.parse(req.body);
    const profile = await updateAudienceProfile(profileId, input);
    return res.status(200).json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to update audience profile';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/audience/profiles/:id
// ---------------------------------------------------------------------------

export async function deleteHandler(req: Request, res: Response) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const profileId = req.params.id;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID required' });
    }

    const existing = await getAudienceProfileById(profileId);
    if (!existing) {
      return res.status(404).json({ error: 'Audience profile not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete audience profiles' });
    }

    await deleteAudienceProfile(profileId);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete audience profile';
    return res.status(500).json({ error: message });
  }
}
