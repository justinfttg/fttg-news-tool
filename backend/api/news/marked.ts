import { Request, Response } from 'express';
import { z } from 'zod';
import {
  markStory,
  unmarkStory,
  getMarkedStories,
  getMarkedStoryIds,
} from '../../src/db/queries/marked-stories.queries';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GetMarkedQuerySchema = z.object({
  projectId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const MarkStoryBodySchema = z.object({
  projectId: z.string().uuid(),
  newsStoryId: z.string().uuid(),
});

const UnmarkQuerySchema = z.object({
  newsStoryId: z.string().uuid(),
});

const GetMarkedIdsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/news/marked?projectId=X&page=1&limit=20
// Returns paginated list of marked stories
// ---------------------------------------------------------------------------

export async function getMarkedHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const query = GetMarkedQuerySchema.parse(req.query);

    const { stories, total } = await getMarkedStories({
      projectId: query.projectId,
      userId,
      page: query.page,
      limit: query.limit,
    });

    return res.status(200).json({
      stories,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch marked stories';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/news/marked
// Mark a story
// ---------------------------------------------------------------------------

export async function markStoryHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const body = MarkStoryBodySchema.parse(req.body);

    const marked = await markStory(userId, body.projectId, body.newsStoryId);
    if (!marked) {
      return res.status(500).json({ error: 'Failed to mark story' });
    }

    return res.status(201).json({
      id: marked.id,
      newsStoryId: marked.newsStoryId,
      markedAt: marked.markedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to mark story';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/news/marked?newsStoryId=X
// Unmark a story
// ---------------------------------------------------------------------------

export async function unmarkStoryHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const query = UnmarkQuerySchema.parse(req.query);

    const success = await unmarkStory(userId, query.newsStoryId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to unmark story' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to unmark story';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/news/marked/ids
// Get all marked story IDs for efficient bulk checking
// ---------------------------------------------------------------------------

export async function getMarkedIdsHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    GetMarkedIdsQuerySchema.parse(req.query);

    const markedIds = await getMarkedStoryIds(userId);

    return res.status(200).json({
      markedIds: Array.from(markedIds),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch marked IDs';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// Combined handler for Express router
// ---------------------------------------------------------------------------

export async function markedHandler(req: Request, res: Response) {
  switch (req.method) {
    case 'GET':
      return getMarkedHandler(req, res);
    case 'POST':
      return markStoryHandler(req, res);
    case 'DELETE':
      return unmarkStoryHandler(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function markedIdsHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return getMarkedIdsHandler(req, res);
}
