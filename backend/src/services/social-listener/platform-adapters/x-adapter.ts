// X/Twitter adapter - fetches trending topics via Trends24 (no API required)
// Note: Cannot fetch individual tweets without official API access

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic } from './types';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'FTTG-Social-Listener/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

interface Trends24RegionConfig {
  path: string;
  region: string;
}

// Trends24 provides X/Twitter trends by location
const TRENDS24_REGIONS: Trends24RegionConfig[] = [
  { path: '', region: 'global' }, // Worldwide
  { path: 'singapore', region: 'singapore' },
  { path: 'japan', region: 'east_asia' },
  { path: 'australia', region: 'apac' },
  { path: 'united-states', region: 'global' },
];

export class XAdapter implements PlatformAdapter {
  readonly platform = 'x';

  private readonly rssBaseUrl = 'https://trends24.in';

  /**
   * Convert X trending topics to post-like format for unified display
   * (Actual tweets require official API access)
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};
    const topics = await this.getTrending(region);

    // Convert trending topics to post-like format
    return topics.slice(0, limit).map((topic) => ({
      platform: 'x' as const,
      externalId: `x-${topic.normalizedName}`,
      authorHandle: 'X Trending',
      authorName: topic.hashtag || topic.name,
      authorFollowers: null,
      content: topic.name,
      postUrl: topic.url,
      mediaUrls: [],
      likes: topic.engagement,
      reposts: 0,
      comments: 0,
      views: topic.engagement,
      hashtags: topic.hashtag ? [topic.hashtag] : [],
      topics: [topic.name],
      region: topic.region,
      category: 'Trending',
      postedAt: new Date(),
    }));
  }

  /**
   * Fetch trending topics from Trends24 RSS
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    // Try main RSS feed first
    const topics = await this.fetchTrends24RSS();

    // Filter by region if specified
    if (region && region !== 'global') {
      // For region-specific, try to get from that region's page
      const regionConfig = TRENDS24_REGIONS.find((r) => r.region === region);
      if (regionConfig && regionConfig.path) {
        const regionalTopics = await this.fetchTrends24Region(regionConfig);
        if (regionalTopics.length > 0) {
          return regionalTopics;
        }
      }
    }

    return topics;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchTrends24RSS(): Promise<TrendingTopic[]> {
    try {
      const url = `${this.rssBaseUrl}/rss/`;
      const feed = await parser.parseURL(url);

      return (feed.items || []).slice(0, 30).map((item, index) => {
        const title = (item.title || '').trim();
        const isHashtag = title.startsWith('#');

        return {
          name: title,
          normalizedName: normalizeTopic(title),
          hashtag: isHashtag ? title : null,
          platform: 'x',
          postCount: 1,
          engagement: 1000 - index * 30, // Estimate based on ranking
          url: item.link || `https://twitter.com/search?q=${encodeURIComponent(title)}`,
          region: 'global',
        };
      });
    } catch (error) {
      console.error('[x-adapter] Trends24 RSS error:', error);
      return [];
    }
  }

  private async fetchTrends24Region(
    config: Trends24RegionConfig
  ): Promise<TrendingTopic[]> {
    try {
      // Trends24 doesn't have per-region RSS, so we use the main feed
      // and tag with the requested region
      const topics = await this.fetchTrends24RSS();
      return topics.map((t) => ({ ...t, region: config.region }));
    } catch (error) {
      console.error(`[x-adapter] Region ${config.path} error:`, error);
      return [];
    }
  }
}
