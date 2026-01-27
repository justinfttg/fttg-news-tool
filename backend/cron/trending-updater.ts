import { Request, Response } from 'express';
import { verifyToken } from '../src/services/auth/jwt';
import { aggregateTrending } from '../src/services/news-scraper/trending-aggregator';

/**
 * Cron handler — designed for Vercel Cron Jobs (every 5 min) or manual trigger.
 *
 * POST /api/cron/trending-update
 *
 * Auth (handled internally, no authMiddleware):
 *   - Vercel CRON_SECRET in Authorization header, OR
 *   - JWT Bearer token from an admin (isFttgTeam) user
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: accept either CRON_SECRET or an admin JWT
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const isCron = !!(cronSecret && token === cronSecret);

  let isAdmin = false;
  if (!isCron && token) {
    try {
      const payload = await verifyToken(token);
      isAdmin = payload.isFttgTeam === true;
    } catch {
      // Invalid token — fall through to rejection
    }
  }

  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[trending-updater] Starting trending update...');
    const startTime = Date.now();

    const result = await aggregateTrending();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[trending-updater] Complete in ${elapsed}s — new: ${result.newStories}, updated: ${result.updatedStories}, expired: ${result.expired}`
    );

    return res.status(200).json({
      success: true,
      elapsed: `${elapsed}s`,
      processed: result.processed,
      newStories: result.newStories,
      updatedStories: result.updatedStories,
      expired: result.expired,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trending update failed';
    console.error(`[trending-updater] Fatal error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
}
