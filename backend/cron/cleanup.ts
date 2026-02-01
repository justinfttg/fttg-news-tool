import { Request, Response } from 'express';
import { deduplicateStories, deleteLowQualityStories } from '../src/db/queries/news.queries';
import { verifyToken } from '../src/services/auth/jwt';

/**
 * Cleanup handler — removes duplicates and low-quality stories.
 *
 * POST /api/cron/cleanup
 *
 * Auth:
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
    console.log('[cleanup] Starting database cleanup...');
    const startTime = Date.now();

    // Step 1: Remove duplicate stories (keep oldest per URL)
    console.log('[cleanup] Removing duplicate stories...');
    const dedupResult = await deduplicateStories();
    console.log(`[cleanup] Duplicates removed: ${dedupResult.deleted}, remaining: ${dedupResult.remaining}`);

    // Step 2: Remove low-quality stories
    console.log('[cleanup] Removing low-quality stories...');
    const qualityResult = await deleteLowQualityStories();
    console.log(`[cleanup] Low-quality removed: ${qualityResult.deleted}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[cleanup] Complete in ${elapsed}s`);

    return res.status(200).json({
      success: true,
      elapsed: `${elapsed}s`,
      duplicatesRemoved: dedupResult.deleted,
      lowQualityRemoved: qualityResult.deleted,
      storiesRemaining: dedupResult.remaining - qualityResult.deleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    console.error(`[cleanup] Fatal error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
}
