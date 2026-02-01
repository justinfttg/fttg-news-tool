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

  // Auth: accept Vercel Cron, CRON_SECRET header, or admin JWT
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Check if this is a Vercel Cron job (they set this header)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  // Check for CRON_SECRET in Authorization header (manual trigger with secret)
  const isCronSecret = !!(cronSecret && token === cronSecret);

  let isAdmin = false;
  if (!isVercelCron && !isCronSecret && token) {
    try {
      const payload = await verifyToken(token);
      isAdmin = payload.isFttgTeam === true;
    } catch {
      // Invalid token — fall through to rejection
    }
  }

  if (!isVercelCron && !isCronSecret && !isAdmin) {
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
