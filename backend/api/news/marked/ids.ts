import { Request, Response } from 'express';
import { z } from 'zod';
import { getMarkedStoryIds } from '../../../src/db/queries/marked-stories.queries';

const GetMarkedIdsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

/**
 * GET /api/news/marked/ids
 *
 * Get all marked story IDs for efficient bulk checking
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
