import { Request, Response } from 'express';
import { getTrendingStories } from '../../src/db/queries/news.queries';

/**
 * GET /api/news/trending
 *
 * Returns the top trending stories ordered by trend_score DESC.
 * Optional query param: limit (default 20, max 50).
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
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 50)
      : 20;

    const stories = await getTrendingStories(limit);

    return res.status(200).json({ stories, count: stories.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch trending stories';
    return res.status(500).json({ error: message });
  }
}
