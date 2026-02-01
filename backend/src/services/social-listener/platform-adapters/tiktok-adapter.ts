// TikTok adapter - fetches trending content via multiple fallback methods
// Scrapes actual video links from trending pages and embed sources

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

// Sources that aggregate actual TikTok video links
const TIKTOK_VIRAL_SOURCES = [
  'https://tokcount.com/',
  'https://exolyt.com/trending',
];

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok';

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Fetch TikTok content from multiple sources
   * Prioritizes actual video links over news articles
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};
    const allPosts: SocialPost[] = [];

    // Try to scrape actual viral videos first
    const viralVideos = await this.scrapeViralVideos(region, limit);
    allPosts.push(...viralVideos);

    // Try Tokboard for trending hashtags with video links
    const tokboardPosts = await this.fetchTokboard(region, limit);
    allPosts.push(...tokboardPosts);

    // Try to get videos from trending hashtag pages
    const hashtagVideos = await this.scrapeHashtagVideos(region, Math.ceil(limit / 2));
    allPosts.push(...hashtagVideos);

    // Fallback to Google News for TikTok trending articles
    if (allPosts.length < limit / 2) {
      const newsPosts = await this.fetchTikTokNews(region, limit);
      allPosts.push(...newsPosts);
    }

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

    // Try scraping TikTok discover page for trends
    const scrapedTopics = await this.scrapeTikTokTrends(region);
    if (scrapedTopics.length > 0) {
      return scrapedTopics;
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
  // Private helpers - Actual video scraping
  // -------------------------------------------------------------------------

  /**
   * Scrape viral videos from aggregator sites
   */
  private async scrapeViralVideos(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    // Try TikTok's own discover/trending page (often blocked but worth trying)
    try {
      const discoverUrl = 'https://www.tiktok.com/api/explore/item_list/?from_page=explore&count=20';
      const response = await fetch(discoverUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/json',
          'Referer': 'https://www.tiktok.com/explore',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json() as {
          itemList?: Array<{
            id: string;
            desc: string;
            author?: { uniqueId: string; nickname: string };
            stats?: { playCount: number; diggCount: number; commentCount: number; shareCount: number };
            createTime?: number;
          }>;
        };

        for (const item of (data.itemList || []).slice(0, limit)) {
          const hashtags = extractHashtags(item.desc || '');
          posts.push({
            platform: 'tiktok',
            externalId: `tiktok-${item.id}`,
            authorHandle: item.author?.uniqueId || 'unknown',
            authorName: item.author?.nickname || item.author?.uniqueId || 'TikTok User',
            authorFollowers: null,
            content: item.desc || 'Trending TikTok video',
            postUrl: `https://www.tiktok.com/@${item.author?.uniqueId || 'user'}/video/${item.id}`,
            mediaUrls: [],
            likes: item.stats?.diggCount || 0,
            reposts: item.stats?.shareCount || 0,
            comments: item.stats?.commentCount || 0,
            views: item.stats?.playCount || 0,
            hashtags: filterGenericHashtags(hashtags),
            topics: ['Trending'],
            region: region || 'global',
            category: 'Viral',
            postedAt: item.createTime ? new Date(item.createTime * 1000) : new Date(),
          });
        }
      }
    } catch (error) {
      console.warn('[tiktok] Discover API error (expected):', error);
    }

    // Try scraping TikTok embed pages for viral content
    // These are more accessible than the main site
    try {
      const embedUrl = 'https://www.tiktok.com/embed/v2/trending';
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const html = await response.text();
        // Extract video IDs from embed page
        const videoMatches = html.matchAll(/video\/(\d{19})/g);
        let index = 0;
        for (const match of videoMatches) {
          if (index >= limit) break;
          const videoId = match[1];
          // Try to get video metadata via oembed
          const metadata = await this.getVideoMetadata(videoId);
          if (metadata) {
            posts.push(metadata);
            index++;
          }
        }
      }
    } catch (error) {
      console.warn('[tiktok] Embed scrape error:', error);
    }

    return posts;
  }

  /**
   * Get video metadata via TikTok's oembed API
   */
  private async getVideoMetadata(videoId: string): Promise<SocialPost | null> {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/video/${videoId}`;
      const response = await fetch(oembedUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      const data = await response.json() as {
        title?: string;
        author_name?: string;
        author_url?: string;
        thumbnail_url?: string;
      };

      const authorHandle = data.author_url?.split('@').pop() || 'user';
      const hashtags = extractHashtags(data.title || '');

      return {
        platform: 'tiktok',
        externalId: `tiktok-${videoId}`,
        authorHandle,
        authorName: data.author_name || authorHandle,
        authorFollowers: null,
        content: data.title || 'TikTok video',
        postUrl: `https://www.tiktok.com/@${authorHandle}/video/${videoId}`,
        mediaUrls: data.thumbnail_url ? [data.thumbnail_url] : [],
        likes: 1000, // Estimate since oembed doesn't provide stats
        reposts: 0,
        comments: 0,
        views: 10000,
        hashtags: filterGenericHashtags(hashtags),
        topics: ['Trending'],
        region: 'global',
        category: 'Viral',
        postedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Scrape videos from trending hashtag pages
   */
  private async scrapeHashtagVideos(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    // Get trending hashtags first
    const trends = await this.fetchTokboardTrending(region);
    const topTrends = trends.slice(0, 5);

    for (const trend of topTrends) {
      if (posts.length >= limit) break;

      try {
        const hashtag = trend.name.replace('#', '');
        // Use TikTok's tag page API
        const tagUrl = `https://www.tiktok.com/api/challenge/item_list/?challengeID=${hashtag}&count=10`;
        const response = await fetch(tagUrl, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'application/json',
            'Referer': `https://www.tiktok.com/tag/${hashtag}`,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json() as {
            itemList?: Array<{
              id: string;
              desc: string;
              author?: { uniqueId: string; nickname: string };
              stats?: { playCount: number; diggCount: number; commentCount: number };
            }>;
          };

          for (const item of (data.itemList || []).slice(0, 3)) {
            const hashtags = extractHashtags(item.desc || '');
            posts.push({
              platform: 'tiktok',
              externalId: `tiktok-${item.id}`,
              authorHandle: item.author?.uniqueId || 'user',
              authorName: item.author?.nickname || 'TikTok User',
              authorFollowers: null,
              content: item.desc || `#${hashtag} video`,
              postUrl: `https://www.tiktok.com/@${item.author?.uniqueId || 'user'}/video/${item.id}`,
              mediaUrls: [],
              likes: item.stats?.diggCount || 0,
              reposts: 0,
              comments: item.stats?.commentCount || 0,
              views: item.stats?.playCount || 0,
              hashtags: filterGenericHashtags([`#${hashtag}`, ...hashtags]),
              topics: [trend.name],
              region: region || 'global',
              category: 'Trending',
              postedAt: new Date(),
            });
          }
        }
      } catch {
        // Expected to fail often
      }
    }

    // If API calls fail, create links to trending hashtag pages
    if (posts.length === 0) {
      for (const trend of topTrends.slice(0, limit)) {
        const hashtag = trend.name.replace('#', '');
        posts.push({
          platform: 'tiktok',
          externalId: `tiktok-tag-${normalizeTopic(hashtag)}`,
          authorHandle: 'TikTok',
          authorName: `#${hashtag}`,
          authorFollowers: null,
          content: `Trending: #${hashtag} on TikTok`,
          postUrl: `https://www.tiktok.com/tag/${encodeURIComponent(hashtag)}`,
          mediaUrls: [],
          likes: trend.engagement,
          reposts: 0,
          comments: 0,
          views: trend.engagement * 10,
          hashtags: [`#${hashtag}`],
          topics: [trend.name],
          region: region || 'global',
          category: 'Trending',
          postedAt: new Date(),
        });
      }
    }

    return posts;
  }

  /**
   * Scrape trending topics from TikTok discover
   */
  private async scrapeTikTokTrends(region?: string): Promise<TrendingTopic[]> {
    const topics: TrendingTopic[] = [];

    try {
      // Try TikTok's discover page
      const url = 'https://www.tiktok.com/discover';
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const html = await response.text();
        // Extract hashtags from discover page
        const hashtagMatches = html.matchAll(/"challengeName":"([^"]+)"/g);
        let index = 0;
        for (const match of hashtagMatches) {
          if (index >= 30) break;
          const name = match[1];
          if (name && !isGenericHashtag(name)) {
            topics.push({
              name: `#${name}`,
              normalizedName: normalizeTopic(name),
              hashtag: `#${name}`,
              platform: 'tiktok',
              postCount: 100 - index * 3,
              engagement: 10000 - index * 300,
              url: `https://www.tiktok.com/tag/${encodeURIComponent(name)}`,
              region: region || 'global',
            });
            index++;
          }
        }
      }
    } catch (error) {
      console.warn('[tiktok] Discover scrape error:', error);
    }

    return topics;
  }

  // -------------------------------------------------------------------------
  // Existing helpers
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

          // Try to extract TikTok video URLs from the article
          const tiktokUrls = await this.extractTikTokUrlsFromArticle(item.link || '');

          if (tiktokUrls.length > 0) {
            // If we found actual TikTok URLs, create posts for them
            for (const tiktokUrl of tiktokUrls.slice(0, 2)) {
              const videoId = tiktokUrl.match(/video\/(\d+)/)?.[1];
              if (videoId) {
                const metadata = await this.getVideoMetadata(videoId);
                if (metadata) {
                  posts.push(metadata);
                }
              }
            }
          } else {
            // Fallback to news article with source link
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
              category: 'News',
              postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            });
          }
        }
      } catch (error) {
        console.warn(`[tiktok] Google News RSS error:`, error);
      }

      if (posts.length >= limit) break;
    }

    return posts.slice(0, limit);
  }

  /**
   * Try to extract TikTok video URLs from a news article
   */
  private async extractTikTokUrlsFromArticle(articleUrl: string): Promise<string[]> {
    if (!articleUrl) return [];

    try {
      const response = await fetch(articleUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return [];

      const html = await response.text();
      // Find TikTok video URLs
      const tiktokMatches = html.matchAll(/https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/g);
      const urls: string[] = [];
      for (const match of tiktokMatches) {
        if (!urls.includes(match[0])) {
          urls.push(match[0]);
        }
      }
      return urls;
    } catch {
      return [];
    }
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
        content: `Trending: ${trend.name}`,
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
