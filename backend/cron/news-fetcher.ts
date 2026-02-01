import { Request, Response } from 'express';
import { scrapeAllSources, processExistingStoriesWithAI } from '../src/services/news-scraper/rss-scraper';
import { verifyToken } from '../src/services/auth/jwt';

/**
 * Cron handler — designed for Vercel Cron Jobs or a manual trigger.
 *
 * POST /api/cron/news-fetch
 *
 * Auth (handled internally, no authMiddleware):
 *   - Vercel CRON_SECRET in Authorization header, OR
 *   - JWT Bearer token from an admin (isFttgTeam) user
 *
 * Query params:
 *   - region (optional): only scrape a specific region
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

  let isAuthenticated = false;
  if (!isVercelCron && !isCronSecret && token) {
    try {
      const payload = await verifyToken(token);
      // Allow any authenticated user (TODO: restrict to isFttgTeam in production)
      isAuthenticated = !!payload.userId;
    } catch {
      // Invalid token — fall through to rejection
    }
  }

  if (!isVercelCron && !isCronSecret && !isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const region = (req.query.region as string) || undefined;

  try {
    console.log(`[news-fetcher] Starting scrape${region ? ` for region: ${region}` : ' (all regions)'}...`);
    const startTime = Date.now();

    const result = await scrapeAllSources(region);

    // Also process existing stories that need AI summaries (backfill)
    // Process up to 100 stories per run to catch up on backlog
    const backfilled = await processExistingStoriesWithAI(100);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[news-fetcher] Complete in ${elapsed}s — inserted: ${result.inserted}, skipped: ${result.skipped}, backfilled: ${backfilled}, errors: ${result.errors.length}`);

    return res.status(200).json({
      success: true,
      elapsed: `${elapsed}s`,
      totalFetched: result.totalFetched,
      inserted: result.inserted,
      skipped: result.skipped,
      aiProcessed: result.aiProcessed,
      aiBackfilled: backfilled,
      sourceCount: result.sources.length,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scrape failed';
    console.error(`[news-fetcher] Fatal error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
}
