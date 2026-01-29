// GET /api/social-listener/viral-posts
// Fetch viral posts from social platforms

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getViralPosts, getTrendingHashtags } from '../../src/services/social-listener';

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
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 100);
    const category = req.query.category ? String(req.query.category) : undefined;

    // Fetch viral posts
    const posts = await getViralPosts({ platforms, region, limit, category });

    // Also get trending hashtags for context
    const hashtags = await getTrendingHashtags({ platforms, region, limit: 10 });

    return res.status(200).json({
      posts,
      hashtags: hashtags.map((h) => ({
        hashtag: h.hashtag,
        posts: h.currentPosts,
        engagement: h.currentEngagement,
        platforms: h.platforms,
        momentum: h.momentumDirection,
      })),
      meta: {
        platforms,
        region: region || 'all',
        count: posts.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[viral-posts] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch viral posts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
