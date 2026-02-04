import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getMilestoneById,
  getMilestonesByEpisodeId,
  updateMilestone,
  getUpcomingMilestones,
  getOverdueMilestones,
} from '../../src/db/queries/episodes.queries';
import { getEpisodeById } from '../../src/db/queries/episodes.queries';
import {
  completeMilestone,
  startMilestone,
  skipMilestone,
} from '../../src/services/production/episode-service';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MilestoneStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'overdue', 'skipped']);

const UpdateMilestoneSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deadlineTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  status: MilestoneStatusSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  isClientFacing: z.boolean().optional(),
  requiresClientApproval: z.boolean().optional(),
});

const ListUpcomingSchema = z.object({
  projectId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(90).optional(),
  clientFacingOnly: z.enum(['true', 'false']).optional(),
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

async function getProjectIdFromMilestone(milestoneId: string): Promise<string | null> {
  const milestone = await getMilestoneById(milestoneId);
  if (!milestone) return null;

  const episode = await getEpisodeById(milestone.episode_id, false);
  return episode?.project_id || null;
}

// ---------------------------------------------------------------------------
// GET /api/episodes/:id/milestones - List milestones for episode
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
    const episodeId = req.params.id;
    if (!episodeId) {
      return res.status(400).json({ error: 'Episode ID required' });
    }

    const episode = await getEpisodeById(episodeId, false);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(episode.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const milestones = await getMilestonesByEpisodeId(episodeId);
    return res.status(200).json(milestones);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch milestones';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/episodes/:id/milestones/:milestoneId - Update milestone
// ---------------------------------------------------------------------------

export async function updateHandler(req: Request, res: Response) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const milestoneId = req.params.milestoneId;
    if (!milestoneId) {
      return res.status(400).json({ error: 'Milestone ID required' });
    }

    const projectId = await getProjectIdFromMilestone(milestoneId);
    if (!projectId) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update milestones' });
    }

    const input = UpdateMilestoneSchema.parse(req.body);

    // Handle status changes with special logic
    if (input.status === 'completed') {
      const milestone = await completeMilestone(milestoneId, userId, input.notes || undefined);
      return res.status(200).json(milestone);
    }

    if (input.status === 'in_progress') {
      const milestone = await startMilestone(milestoneId);
      return res.status(200).json(milestone);
    }

    if (input.status === 'skipped') {
      const milestone = await skipMilestone(milestoneId, input.notes || undefined);
      return res.status(200).json(milestone);
    }

    // Regular update
    const milestone = await updateMilestone(milestoneId, input);
    return res.status(200).json(milestone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to update milestone';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/episodes/:id/milestones/:milestoneId/complete - Complete milestone
// ---------------------------------------------------------------------------

export async function completeHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const milestoneId = req.params.milestoneId;
    if (!milestoneId) {
      return res.status(400).json({ error: 'Milestone ID required' });
    }

    const projectId = await getProjectIdFromMilestone(milestoneId);
    if (!projectId) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot complete milestones' });
    }

    const notes = req.body?.notes as string | undefined;
    const milestone = await completeMilestone(milestoneId, userId, notes);

    return res.status(200).json(milestone);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete milestone';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/milestones/upcoming - List upcoming milestones across project
// ---------------------------------------------------------------------------

export async function upcomingHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const query = ListUpcomingSchema.parse(req.query);

    const member = await verifyMembership(query.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const milestones = await getUpcomingMilestones(query.projectId, {
      days: query.days,
      clientFacingOnly: query.clientFacingOnly === 'true',
    });

    return res.status(200).json(milestones);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch upcoming milestones';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/milestones/overdue - List overdue milestones
// ---------------------------------------------------------------------------

export async function overdueHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const milestones = await getOverdueMilestones(projectId);
    return res.status(200).json(milestones);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch overdue milestones';
    return res.status(500).json({ error: message });
  }
}
