import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getEpisodes,
  getEpisodeById,
  updateEpisode,
  deleteEpisode,
} from '../../src/db/queries/episodes.queries';
import {
  scheduleEpisode,
  rescheduleEpisode,
  cancelEpisode,
  removeEpisode,
  getEpisodeSummary,
} from '../../src/services/production/episode-service';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TimelineTypeSchema = z.enum(['normal', 'breaking_news', 'emergency']);

const ProductionStatusSchema = z.enum([
  'topic_pending', 'topic_approved', 'script_development', 'script_review',
  'script_approved', 'in_production', 'post_production', 'draft_review',
  'final_review', 'delivered', 'published', 'cancelled',
]);

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(), // comma-separated list
  includeMilestones: z.enum(['true', 'false']).optional(),
});

const CreateEpisodeSchema = z.object({
  projectId: z.string().uuid(),
  topicProposalId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  txTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  timelineType: TimelineTypeSchema.optional(),
  templateId: z.string().uuid().optional(),
  episodeNumber: z.number().int().positive().optional(),
  internalNotes: z.string().max(2000).optional(),
});

const UpdateEpisodeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  episodeNumber: z.number().int().positive().nullable().optional(),
  txTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  timelineType: TimelineTypeSchema.optional(),
  productionStatus: ProductionStatusSchema.optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  clientFeedback: z.string().max(2000).nullable().optional(),
});

const RescheduleSchema = z.object({
  newTxDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  newTxTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  preserveMilestoneStatus: z.boolean().optional(),
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
// GET /api/episodes - List episodes
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
    const query = ListQuerySchema.parse(req.query);

    const member = await verifyMembership(query.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Parse status filter
    const statusFilter = query.status
      ? (query.status.split(',') as any[])
      : undefined;

    const episodes = await getEpisodes(query.projectId, {
      startDate: query.startDate,
      endDate: query.endDate,
      status: statusFilter,
      includeMilestones: query.includeMilestones === 'true',
    });

    return res.status(200).json(episodes);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch episodes';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/episodes - Create/schedule episode
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
    const input = CreateEpisodeSchema.parse(req.body);

    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create episodes' });
    }

    const episode = await scheduleEpisode({
      ...input,
      createdByUserId: userId,
    });

    return res.status(201).json(episode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to create episode';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/episodes/:id - Get single episode
// ---------------------------------------------------------------------------

export async function getHandler(req: Request, res: Response) {
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

    const episode = await getEpisodeById(episodeId, true);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(episode.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    return res.status(200).json(episode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch episode';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/episodes/:id - Update episode
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
    const episodeId = req.params.id;
    if (!episodeId) {
      return res.status(400).json({ error: 'Episode ID required' });
    }

    const existing = await getEpisodeById(episodeId, false);
    if (!existing) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update episodes' });
    }

    const input = UpdateEpisodeSchema.parse(req.body);
    const episode = await updateEpisode(episodeId, input);

    return res.status(200).json(episode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to update episode';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/episodes/:id - Delete episode
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
    const episodeId = req.params.id;
    if (!episodeId) {
      return res.status(400).json({ error: 'Episode ID required' });
    }

    const existing = await getEpisodeById(episodeId, false);
    if (!existing) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete episodes' });
    }

    await removeEpisode(episodeId);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete episode';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/episodes/:id/reschedule - Reschedule episode
// ---------------------------------------------------------------------------

export async function rescheduleHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
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

    const existing = await getEpisodeById(episodeId, false);
    if (!existing) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot reschedule episodes' });
    }

    const input = RescheduleSchema.parse(req.body);
    const episode = await rescheduleEpisode(episodeId, input);

    return res.status(200).json(episode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to reschedule episode';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/episodes/:id/cancel - Cancel episode
// ---------------------------------------------------------------------------

export async function cancelHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
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

    const existing = await getEpisodeById(episodeId, false);
    if (!existing) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot cancel episodes' });
    }

    const episode = await cancelEpisode(episodeId);
    return res.status(200).json(episode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel episode';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/episodes/summary - Get project episode summary
// ---------------------------------------------------------------------------

export async function summaryHandler(req: Request, res: Response) {
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

    const summary = await getEpisodeSummary(projectId);
    return res.status(200).json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch summary';
    return res.status(500).json({ error: message });
  }
}
