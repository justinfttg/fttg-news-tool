import { Request, Response } from 'express';
import { scrapeAllSources } from '../src/services/news-scraper/rss-scraper';
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

  const region = (req.query.region as string) || undefined;

  try {
    console.log(`[news-fetcher] Starting scrape${region ? ` for region: ${region}` : ' (all regions)'}...`);
    const startTime = Date.now();

    const result = await scrapeAllSources(region);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[news-fetcher] Complete in ${elapsed}s — inserted: ${result.inserted}, skipped: ${result.skipped}, errors: ${result.errors.length}`);

    return res.status(200).json({
      success: true,
      elapsed: `${elapsed}s`,
      totalFetched: result.totalFetched,
      inserted: result.inserted,
      skipped: result.skipped,
      sourceCount: result.sources.length,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scrape failed';
    console.error(`[news-fetcher] Fatal error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
}
