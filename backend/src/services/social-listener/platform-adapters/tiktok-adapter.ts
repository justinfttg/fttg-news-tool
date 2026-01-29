// TikTok adapter - fetches trending content via multiple fallback methods
// Note: TikTok aggressively blocks scraping, so this uses RSS and news sources

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, extractHashtags, isGenericHashtag, filterGenericHashtags } from './types';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// TikTok news/trending RSS sources (news about TikTok trends)
const TIKTOK_NEWS_SOURCES = [
  {
    url: 'https://newsroom.tiktok.com/en-us/rss.xml',
    name: 'TikTok Newsroom',
    region: 'global',
  },
];

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok';

  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

  /**
   * Fetch TikTok content - combines multiple sources
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};

    const allPosts: SocialPost[] = [];

    // Method 1: Try TikTok Newsroom RSS
    const newsroomPosts = await this.fetchNewsroomRSS(limit);
    allPosts.push(...newsroomPosts);

    // Method 2: Try tokboard.com for trending (scrape-friendly)
    const tokboardPosts = await this.fetchTokboard(region, limit);
    allPosts.push(...tokboardPosts);

    // Filter out posts that are just generic hashtags
    const qualityPosts = allPosts.filter(post => {
      // Keep posts with actual content (not just a hashtag)
      const isJustHashtag = post.content.startsWith('#') && post.content.split(' ').length <= 2;
      if (isJustHashtag && isGenericHashtag(post.content)) {
        return false;
      }
      return true;
    });

    return qualityPosts.slice(0, limit);
  }

  /**
   * Get trending topics from TikTok - only return meaningful trends
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    // Try to fetch actual trending data from Tokboard
    const tokboardTopics = await this.fetchTokboardTrending(region);

    // Filter out generic hashtags
    const qualityTopics = tokboardTopics.filter(topic => !isGenericHashtag(topic.name));

    if (qualityTopics.length > 0) {
      return qualityTopics;
    }

    // If no quality topics found, return empty - don't show generic fallbacks
    console.log('[tiktok] No quality trending topics found');
    return [];
  }

  /**
   * Search TikTok (limited - returns hashtag link)
   */
  async searchPosts(query: string, limit = 10): Promise<SocialPost[]> {
    const cleanQuery = query.replace(/[^a-zA-Z0-9]/g, '');

    return [{
      platform: 'tiktok',
      externalId: `tiktok-search-${cleanQuery}`,
      authorHandle: 'TikTok',
      authorName: `Search: ${query}`,
      authorFollowers: null,
      content: `Trending content for "${query}" on TikTok`,
      postUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      mediaUrls: [],
      likes: 0,
      reposts: 0,
      comments: 0,
      views: 0,
      hashtags: filterGenericHashtags([query.startsWith('#') ? query : `#${cleanQuery}`]),
      topics: [query],
      region: 'global',
      category: 'Search',
      postedAt: new Date(),
    }];
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchNewsroomRSS(limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    for (const source of TIKTOK_NEWS_SOURCES) {
      try {
        const feed = await parser.parseURL(source.url);

        for (const item of (feed.items || []).slice(0, limit)) {
          const rawHashtags = extractHashtags(item.title || '');
          posts.push({
            platform: 'tiktok',
            externalId: `tiktok-news-${item.guid || item.link}`,
            authorHandle: source.name,
            authorName: source.name,
            authorFollowers: null,
            content: item.title || '',
            postUrl: item.link || null,
            mediaUrls: [],
            likes: 0,
            reposts: 0,
            comments: 0,
            views: 0,
            hashtags: filterGenericHashtags(rawHashtags),
            topics: ['TikTok News'],
            region: source.region,
            category: 'News',
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          });
        }
      } catch (error) {
        console.warn(`[tiktok] Newsroom RSS error:`, error);
      }
    }

    return posts;
  }

  private async fetchTokboard(region: string | undefined, limit: number): Promise<SocialPost[]> {
    try {
      const url = 'https://tokboard.com/api/trending';
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`[tiktok] Tokboard failed: ${response.status}`);
        return [];
      }

      const data = await response.json() as { trends?: Array<{ name: string; url?: string; count?: number }> };

      // Filter out generic trends
      const qualityTrends = (data.trends || []).filter(trend => !isGenericHashtag(trend.name));

      return qualityTrends.slice(0, limit).map((trend, index) => ({
        platform: 'tiktok' as const,
        externalId: `tokboard-${normalizeTopic(trend.name)}`,
        authorHandle: 'TikTok Trending',
        authorName: trend.name,
        authorFollowers: null,
        content: trend.name,
        postUrl: trend.url || `https://www.tiktok.com/tag/${encodeURIComponent(trend.name.replace('#', ''))}`,
        mediaUrls: [],
        likes: trend.count || (1000 - index * 50),
        reposts: 0,
        comments: 0,
        views: trend.count || (10000 - index * 500),
        hashtags: [trend.name.startsWith('#') ? trend.name : `#${trend.name}`],
        topics: ['Trending'],
        region: region || 'global',
        category: 'Trending',
        postedAt: new Date(),
      }));
    } catch (error) {
      console.warn(`[tiktok] Tokboard error:`, error);
      return [];
    }
  }

  private async fetchTokboardTrending(region: string | undefined): Promise<TrendingTopic[]> {
    try {
      const url = 'https://tokboard.com/api/trending';
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { trends?: Array<{ name: string; url?: string; count?: number }> };

      // Filter out generic trends
      const qualityTrends = (data.trends || []).filter(trend => !isGenericHashtag(trend.name));

      return qualityTrends.slice(0, 30).map((trend, index) => ({
        name: trend.name,
        normalizedName: normalizeTopic(trend.name),
        hashtag: trend.name.startsWith('#') ? trend.name : `#${trend.name}`,
        platform: 'tiktok',
        postCount: trend.count || (100 - index * 3),
        engagement: trend.count || (10000 - index * 300),
        url: trend.url || `https://www.tiktok.com/tag/${encodeURIComponent(trend.name.replace('#', ''))}`,
        region: region || 'global',
      }));
    } catch {
      return [];
    }
  }
}
