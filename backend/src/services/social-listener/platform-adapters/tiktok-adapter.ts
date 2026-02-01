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

// Google News RSS for TikTok trending content
const TIKTOK_NEWS_FEEDS = [
  'https://news.google.com/rss/search?q=tiktok+trending+viral&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=tiktok+trend+challenge&hl=en-US&gl=US&ceid=US:en',
];

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok';

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Fetch TikTok content from multiple sources
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};
    const allPosts: SocialPost[] = [];

    // Try Tokboard first for actual trending data
    const tokboardPosts = await this.fetchTokboard(region, limit);
    allPosts.push(...tokboardPosts);

    // Try Google News for TikTok trending articles
    const newsPosts = await this.fetchTikTokNews(region, limit);
    allPosts.push(...newsPosts);

    // Try TikTok Newsroom RSS
    const newsroomPosts = await this.fetchNewsroomRSS(limit);
    allPosts.push(...newsroomPosts);

    // If we got some content, return it
    if (allPosts.length > 0) {
      // Sort by engagement and dedupe
      const seen = new Set<string>();
      const uniquePosts = allPosts.filter(post => {
        if (seen.has(post.externalId)) return false;
        seen.add(post.externalId);
        return true;
      });
      uniquePosts.sort((a, b) => (b.likes + b.views) - (a.likes + a.views));
      return uniquePosts.slice(0, limit);
    }

    // Fallback: return helpful links to explore TikTok
    const posts: SocialPost[] = [{
      platform: 'tiktok' as const,
      externalId: 'tiktok-discover',
      authorHandle: 'TikTok',
      authorName: 'TikTok Discover',
      authorFollowers: null,
      content: 'Explore trending content on TikTok',
      postUrl: 'https://www.tiktok.com/discover',
      mediaUrls: [],
      likes: 0,
      reposts: 0,
      comments: 0,
      views: 0,
      hashtags: [],
      topics: ['Trending'],
      region: region || 'global',
      category: 'Trending',
      postedAt: new Date(),
    }];

    return posts;
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

  private async fetchTikTokNews(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    for (const feedUrl of TIKTOK_NEWS_FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);

        for (const item of (feed.items || []).slice(0, Math.ceil(limit / 2))) {
          const title = item.title || '';
          // Skip if doesn't seem TikTok related
          if (!title.toLowerCase().includes('tiktok')) continue;

          const rawHashtags = extractHashtags(title);
          posts.push({
            platform: 'tiktok',
            externalId: `tiktok-news-${Buffer.from(item.link || title).toString('base64').slice(0, 20)}`,
            authorHandle: item.creator || 'TikTok News',
            authorName: item.creator || 'TikTok Trending',
            authorFollowers: null,
            content: title,
            postUrl: item.link || null,
            mediaUrls: [],
            likes: 500,
            reposts: 0,
            comments: 0,
            views: 5000,
            hashtags: filterGenericHashtags(rawHashtags),
            topics: ['TikTok Trending'],
            region: region || 'global',
            category: 'Trending',
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          });
        }
      } catch (error) {
        console.warn(`[tiktok] Google News RSS error:`, error);
      }

      if (posts.length >= limit) break;
    }

    return posts.slice(0, limit);
  }

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
          'User-Agent': this.getRandomUserAgent(),
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
          'User-Agent': this.getRandomUserAgent(),
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
