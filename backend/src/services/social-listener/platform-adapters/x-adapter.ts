// X/Twitter adapter - fetches trending topics via multiple sources
// Note: Cannot fetch individual tweets without official API access

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, isGenericHashtag, extractHashtags, filterGenericHashtags } from './types';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// Alternative X/Twitter trend sources
const TREND_SOURCES = [
  { url: 'https://trends24.in/feed/', name: 'Trends24' },
];

// Google News RSS for Twitter/X trending content
const X_NEWS_FEEDS = [
  'https://news.google.com/rss/search?q=twitter+trending+viral&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=x+twitter+viral+post&hl=en-US&gl=US&ceid=US:en',
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
   * Fetch X/Twitter content from multiple sources
   * Combines trending topics with news about viral Twitter content
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};
    const allPosts: SocialPost[] = [];

    // Get trending topics first
    const topics = await this.getTrending(region);
    const topicPosts = topics.slice(0, Math.ceil(limit / 2)).map((topic) => ({
      platform: 'x' as const,
      externalId: `x-${topic.normalizedName}`,
      authorHandle: 'X Trending',
      authorName: topic.hashtag || topic.name,
      authorFollowers: null,
      content: `Trending on X: ${topic.name}`,
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
    allPosts.push(...topicPosts);

    // Also fetch Twitter/X news from Google News
    const newsPosts = await this.fetchTwitterNews(region, limit);
    allPosts.push(...newsPosts);

    // Dedupe and sort
    const seen = new Set<string>();
    const uniquePosts = allPosts.filter(post => {
      if (seen.has(post.externalId)) return false;
      seen.add(post.externalId);
      return true;
    });
    uniquePosts.sort((a, b) => (b.likes + b.views) - (a.likes + a.views));

    return uniquePosts.slice(0, limit);
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

    // Try scraping Trends24 HTML as fallback
    const scrapedTopics = await this.scrapeTrends24(region);
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

  private async fetchTwitterNews(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    for (const feedUrl of X_NEWS_FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);

        for (const item of (feed.items || []).slice(0, Math.ceil(limit / 2))) {
          const title = item.title || '';
          // Skip if doesn't seem Twitter/X related
          const lowerTitle = title.toLowerCase();
          if (!lowerTitle.includes('twitter') && !lowerTitle.includes('x ') && !lowerTitle.includes(' x') && !lowerTitle.includes('tweet')) continue;

          const rawHashtags = extractHashtags(title);
          posts.push({
            platform: 'x',
            externalId: `x-news-${Buffer.from(item.link || title).toString('base64').slice(0, 20)}`,
            authorHandle: item.creator || 'Twitter/X News',
            authorName: item.creator || 'Viral on X',
            authorFollowers: null,
            content: title,
            postUrl: item.link || null,
            mediaUrls: [],
            likes: 500,
            reposts: 0,
            comments: 0,
            views: 5000,
            hashtags: filterGenericHashtags(rawHashtags),
            topics: ['X Trending'],
            region: region || 'global',
            category: 'Trending',
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          });
        }
      } catch (error) {
        console.warn(`[x-adapter] Google News RSS error:`, error);
      }

      if (posts.length >= limit) break;
    }

    return posts.slice(0, limit);
  }

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

  private async scrapeTrends24(region?: string): Promise<TrendingTopic[]> {
    try {
      // Trends24.in provides Twitter/X trending data
      const regionPath = region === 'singapore' ? 'singapore'
        : region === 'china' ? 'china'
        : region === 'east_asia' ? 'japan'
        : '';

      const url = `https://trends24.in/${regionPath}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`[x-adapter] Trends24 scrape failed: ${response.status}`);
        return [];
      }

      const html = await response.text();
      const topics: TrendingTopic[] = [];

      // Extract from meta description which contains top trends
      const metaMatch = html.match(/<meta\s+name=["']?description["']?\s+content=["']([^"']+)["']/i);
      if (metaMatch) {
        const desc = metaMatch[1];
        // Parse trends from description like "Today's top X trends: trend1, trend2, trend3"
        const trendsMatch = desc.match(/trends[^:]*:\s*([^.]+)/i);
        if (trendsMatch) {
          const trendNames = trendsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
          let index = 0;
          for (const name of trendNames) {
            if (name && name.length > 1 && index < 30 && !isGenericHashtag(name)) {
              const isHashtag = name.startsWith('#');
              topics.push({
                name,
                normalizedName: normalizeTopic(name),
                hashtag: isHashtag ? name : null,
                platform: 'x',
                postCount: 100 - index * 5,
                engagement: 10000 - index * 300,
                url: `https://x.com/search?q=${encodeURIComponent(name)}`,
                region: region || 'global',
              });
              index++;
            }
          }
        }
      }

      // Also try to extract from trend-card__list items
      const listItemMatches = html.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/li>/gi);
      let index = topics.length;
      for (const match of listItemMatches) {
        const name = match[1].trim();
        if (name && name.length > 1 && index < 30 && !isGenericHashtag(name)) {
          // Check if already added
          if (!topics.some(t => t.normalizedName === normalizeTopic(name))) {
            const isHashtag = name.startsWith('#');
            topics.push({
              name,
              normalizedName: normalizeTopic(name),
              hashtag: isHashtag ? name : null,
              platform: 'x',
              postCount: 100 - index * 5,
              engagement: 10000 - index * 300,
              url: `https://x.com/search?q=${encodeURIComponent(name)}`,
              region: region || 'global',
            });
            index++;
          }
        }
      }

      console.log(`[x-adapter] Trends24 scraped ${topics.length} topics`);
      return topics;
    } catch (error) {
      console.warn(`[x-adapter] Trends24 scrape error:`, error);
      return [];
    }
  }

}
