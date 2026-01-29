// Google Trends adapter - fetches trending searches via RSS

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, isGenericHashtag } from './types';

interface GoogleTrendsConfig {
  geo: string;
  region: string;
}

const GOOGLE_TRENDS_REGIONS: GoogleTrendsConfig[] = [
  { geo: 'SG', region: 'singapore' },
  { geo: 'CN', region: 'china' },
  { geo: 'JP', region: 'east_asia' },
  { geo: 'KR', region: 'east_asia' },
  { geo: 'AU', region: 'apac' },
  { geo: 'US', region: 'global' },
  { geo: 'GB', region: 'global' },
];

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'FTTG-Social-Listener/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

export class GoogleTrendsAdapter implements PlatformAdapter {
  readonly platform = 'google_trends';

  /**
   * Convert trending searches to post-like format for unified display
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};
    const topics = await this.getTrending(region);

    // Convert trending topics to post-like format
    return topics.slice(0, limit).map((topic) => ({
      platform: 'google_trends' as const,
      externalId: `gt-${topic.normalizedName}`,
      authorHandle: 'Google Trends',
      authorName: 'Trending Search',
      authorFollowers: null,
      content: topic.name,
      postUrl: topic.url,
      mediaUrls: [],
      likes: topic.engagement,
      reposts: 0,
      comments: 0,
      views: topic.engagement,
      hashtags: [],
      topics: [topic.name],
      region: topic.region,
      category: 'Trending',
      postedAt: new Date(),
    }));
  }

  /**
   * Fetch trending searches from Google Trends RSS
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    // Filter regions if specified
    let regions = GOOGLE_TRENDS_REGIONS;
    if (region) {
      regions = regions.filter((r) => r.region === region);
      // If no exact match, fall back to global
      if (regions.length === 0) {
        regions = GOOGLE_TRENDS_REGIONS.filter((r) => r.region === 'global');
      }
    }

    const allTopics: TrendingTopic[] = [];

    // Fetch from each region in parallel
    const results = await Promise.allSettled(
      regions.map((config) => this.fetchTrends(config))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTopics.push(...result.value);
      }
    }

    // Dedupe by normalized name, keeping highest engagement
    const topicMap = new Map<string, TrendingTopic>();
    for (const topic of allTopics) {
      const existing = topicMap.get(topic.normalizedName);
      if (!existing || topic.engagement > existing.engagement) {
        topicMap.set(topic.normalizedName, topic);
      }
    }

    // Sort by engagement (post count for Google Trends)
    const topics = Array.from(topicMap.values());
    topics.sort((a, b) => b.engagement - a.engagement);

    return topics.slice(0, 50);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchTrends(config: GoogleTrendsConfig): Promise<TrendingTopic[]> {
    try {
      const url = `https://trends.google.com/trending/rss?geo=${config.geo}`;
      const feed = await parser.parseURL(url);

      return (feed.items || [])
        .slice(0, 20)
        .filter((item) => {
          const title = (item.title || '').trim();
          // Filter out generic topics
          return !isGenericHashtag(title);
        })
        .map((item, index) => {
          const title = (item.title || '').trim();

          // Google Trends sometimes includes traffic numbers in description
          const trafficMatch = item.contentSnippet?.match(/([\d,]+)\+?\s*(searches)?/i);
          const estimatedTraffic = trafficMatch
            ? parseInt(trafficMatch[1].replace(/,/g, ''), 10)
            : 1000 - index * 50; // Fallback: estimate based on position

          return {
            name: title,
            normalizedName: normalizeTopic(title),
            hashtag: null,
            platform: 'google_trends',
            postCount: 1, // Google Trends is one "post" per trend
            engagement: estimatedTraffic,
            url: item.link || null,
            region: config.region,
          };
        });
    } catch (error) {
      console.error(`[google-trends] ${config.geo} error:`, error);
      return [];
    }
  }
}
