// X/Twitter adapter - fetches trending topics via multiple sources
// Note: Cannot fetch individual tweets without official API access

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, isGenericHashtag } from './types';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// Alternative X/Twitter trend sources
const TREND_SOURCES = [
  { url: 'https://getdaytrends.com/feed/', name: 'GetDayTrends' },
  { url: 'https://twittertrends.co/rss/', name: 'TwitterTrends' },
];

export class XAdapter implements PlatformAdapter {
  readonly platform = 'x';

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

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
   * Fetch trending topics from multiple sources with fallbacks
   * Filters out generic hashtags to show only meaningful trends
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    // Try alternative RSS sources
    for (const source of TREND_SOURCES) {
      const rawTopics = await this.fetchTrendRSS(source.url, source.name);
      // Filter out generic hashtags
      const qualityTopics = rawTopics.filter(t => !isGenericHashtag(t.name));
      if (qualityTopics.length > 0) {
        return region ? qualityTopics.map(t => ({ ...t, region })) : qualityTopics;
      }
    }

    // Try scraping GetDayTrends HTML as fallback
    const scrapedTopics = await this.scrapeGetDayTrends(region);
    // Filter out generic hashtags
    const qualityScraped = scrapedTopics.filter(t => !isGenericHashtag(t.name));
    if (qualityScraped.length > 0) {
      return qualityScraped;
    }

    // No fallback with generic hashtags - return empty if no real trends found
    console.log('[x-adapter] No quality trending topics found');
    return [];
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchTrendRSS(url: string, sourceName: string): Promise<TrendingTopic[]> {
    try {
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
          engagement: 1000 - index * 30,
          url: item.link || `https://x.com/search?q=${encodeURIComponent(title)}`,
          region: 'global',
        };
      });
    } catch (error) {
      console.warn(`[x-adapter] ${sourceName} RSS error:`, error);
      return [];
    }
  }

  private async scrapeGetDayTrends(region?: string): Promise<TrendingTopic[]> {
    try {
      // GetDayTrends provides Twitter trending data
      const regionPath = region === 'singapore' ? 'singapore'
        : region === 'china' ? 'china'
        : region === 'east_asia' ? 'japan'
        : 'worldwide';

      const url = `https://getdaytrends.com/${regionPath}/`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`[x-adapter] GetDayTrends scrape failed: ${response.status}`);
        return [];
      }

      const html = await response.text();
      const topics: TrendingTopic[] = [];

      // Extract trending topics from HTML
      // Pattern: <a class="trend-link" href="...">Topic Name</a>
      const matches = html.matchAll(/<a[^>]*class="[^"]*trend-link[^"]*"[^>]*>([^<]+)<\/a>/gi);

      let index = 0;
      for (const match of matches) {
        const name = match[1].trim();
        if (name && name.length > 1 && index < 30) {
          const isHashtag = name.startsWith('#');
          topics.push({
            name,
            normalizedName: normalizeTopic(name),
            hashtag: isHashtag ? name : null,
            platform: 'x',
            postCount: 1,
            engagement: 1000 - index * 30,
            url: `https://x.com/search?q=${encodeURIComponent(name)}`,
            region: region || 'global',
          });
          index++;
        }
      }

      // Alternative pattern for trend names
      if (topics.length === 0) {
        const altMatches = html.matchAll(/<span[^>]*class="[^"]*trend[^"]*"[^>]*>([^<]+)<\/span>/gi);
        for (const match of altMatches) {
          const name = match[1].trim();
          if (name && name.length > 1 && index < 30) {
            const isHashtag = name.startsWith('#');
            topics.push({
              name,
              normalizedName: normalizeTopic(name),
              hashtag: isHashtag ? name : null,
              platform: 'x',
              postCount: 1,
              engagement: 1000 - index * 30,
              url: `https://x.com/search?q=${encodeURIComponent(name)}`,
              region: region || 'global',
            });
            index++;
          }
        }
      }

      console.log(`[x-adapter] GetDayTrends scraped ${topics.length} topics`);
      return topics;
    } catch (error) {
      console.warn(`[x-adapter] GetDayTrends scrape error:`, error);
      return [];
    }
  }

}
