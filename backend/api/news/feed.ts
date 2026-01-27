import { Request, Response } from 'express';
import { z } from 'zod';
import { getNewsFeed, getStoryById } from '../../src/db/queries/news.queries';

const FeedQuerySchema = z.object({
  region: z.enum(['asia', 'southeast_asia', 'east_asia', 'apac', 'global']).optional(),
  category: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/news/feed?region=X&category=Y&page=1&limit=20
 *
 * Returns paginated news stories with total count.
 */
export async function feedHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const query = FeedQuerySchema.parse(req.query);

    const { stories, total } = await getNewsFeed({
      region: query.region,
      category: query.category,
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
    const message = error instanceof Error ? error.message : 'Failed to fetch news feed';
    return res.status(500).json({ error: message });
  }
}

/**
 * GET /api/news/story/:id
 *
 * Returns a single news story by ID.
 */
export async function storyHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const storyId = req.params.id;
    if (!storyId) {
      return res.status(400).json({ error: 'Story ID required' });
    }

    const story = await getStoryById(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    return res.status(200).json(story);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch story';
    return res.status(500).json({ error: message });
  }
}
