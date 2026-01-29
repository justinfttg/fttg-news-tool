// GET /api/social-listener/trending
// Fetch trending topics aggregated across platforms

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTrendingTopics } from '../../src/services/social-listener';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse query parameters
    const platforms = req.query.platforms
      ? String(req.query.platforms).split(',')
      : ['reddit', 'google_trends', 'x'];
    const region = req.query.region ? String(req.query.region) : undefined;
    const limit = Math.min(parseInt(String(req.query.limit || '30'), 10), 50);

    // Fetch trending topics
    const topics = await getTrendingTopics({ platforms, region, limit });

    return res.status(200).json({
      topics: topics.map((t) => ({
        name: t.name,
        hashtag: t.hashtag,
        platforms: t.platforms,
        engagement: t.totalEngagement,
        posts: t.totalPosts,
        score: t.crossPlatformScore,
        url: t.url,
        region: t.region,
        // Cross-platform indicator
        crossPlatform: t.platforms.length > 1,
      })),
      meta: {
        platforms,
        region: region || 'all',
        count: topics.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[trending] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch trending topics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
