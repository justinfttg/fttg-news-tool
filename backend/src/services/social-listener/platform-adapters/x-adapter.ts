// X/Twitter adapter - hybrid approach
// - Uses X API v2 for tweet search (works on Free tier)
// - Falls back to scraping for trending topics (v1.1 trends requires Pro tier)
// Documentation: https://developer.x.com/en/docs/twitter-api

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, extractHashtags, filterGenericHashtags, isGenericHashtag } from './types';

// X API v2 base URL
const X_API_BASE = 'https://api.twitter.com/2';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// Rate limit tracking
interface RateLimitInfo {
  remaining: number;
  resetAt: Date;
}

export class XAdapter implements PlatformAdapter {
  readonly platform = 'x';

  private bearerToken: string;
  private rateLimits: Map<string, RateLimitInfo> = new Map();

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ];

  constructor() {
    const token = process.env.X_API_BEARER_TOKEN;
    if (!token) {
      console.warn('[x-adapter] X_API_BEARER_TOKEN not set - will use scraping fallbacks');
    }
    this.bearerToken = token || '';
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Make authenticated request to X API v2
   */
  private async apiRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T | null> {
    if (!this.bearerToken) {
      return null;
    }

    // Check rate limit before making request
    const rateLimitKey = endpoint.split('?')[0];
    const rateLimit = this.rateLimits.get(rateLimitKey);
    if (rateLimit && rateLimit.remaining <= 0 && rateLimit.resetAt > new Date()) {
      const waitTime = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
      console.warn(`[x-adapter] Rate limited on ${rateLimitKey}, reset in ${waitTime}s`);
      return null;
    }

    const url = new URL(`${X_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      // Update rate limit info from headers
      const remaining = response.headers.get('x-rate-limit-remaining');
      const reset = response.headers.get('x-rate-limit-reset');
      if (remaining && reset) {
        this.rateLimits.set(rateLimitKey, {
          remaining: parseInt(remaining, 10),
          resetAt: new Date(parseInt(reset, 10) * 1000),
        });
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[x-adapter] API error ${response.status}: ${errorBody}`);

        if (response.status === 429) {
          const resetTime = reset ? new Date(parseInt(reset, 10) * 1000) : new Date(Date.now() + 900000);
          this.rateLimits.set(rateLimitKey, { remaining: 0, resetAt: resetTime });
        }

        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error('[x-adapter] Request failed:', error);
      return null;
    }
  }

  /**
   * Fetch viral/popular tweets
   * Uses X API v2 if available, falls back to Nitter scraping
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 20, category } = options || {};

    // Try X API v2 first
    if (this.bearerToken) {
      const apiPosts = await this.fetchViaApi(region, limit, category);
      if (apiPosts.length > 0) {
        console.log(`[x-adapter] Fetched ${apiPosts.length} posts via X API`);
        return apiPosts;
      }
    }

    // Fallback to scraping
    console.log('[x-adapter] Falling back to scraping for posts');
    return this.fetchViaScraping(region, limit);
  }

  /**
   * Fetch tweets via X API v2 search
   */
  private async fetchViaApi(
    region: string | undefined,
    limit: number,
    category?: string
  ): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    // Build search query
    let query = '-is:retweet -is:reply lang:en';

    if (category) {
      query = `${category} ${query}`;
    }

    // Add regional context
    if (region && region !== 'global') {
      const regionKeywords: Record<string, string> = {
        singapore: '(Singapore OR SG)',
        china: '(China OR Chinese)',
        japan: '(Japan OR Japanese)',
        korea: '(Korea OR Korean)',
        southeast_asia: '(Singapore OR Malaysia OR Indonesia OR Thailand OR Vietnam OR Philippines)',
        east_asia: '(Japan OR Korea OR Taiwan OR HongKong)',
      };
      if (regionKeywords[region]) {
        query = `${regionKeywords[region]} ${query}`;
      }
    }

    const response = await this.apiRequest<XSearchResponse>('/tweets/search/recent', {
      query,
      max_results: Math.min(limit, 100).toString(),
      'tweet.fields': 'public_metrics,created_at,author_id,entities',
      'user.fields': 'name,username,public_metrics',
      expansions: 'author_id,attachments.media_keys',
      'media.fields': 'url,preview_image_url',
      sort_order: 'relevancy',
    });

    if (!response?.data) {
      return posts;
    }

    // Build user lookup map
    const userMap = new Map<string, XUser>();
    if (response.includes?.users) {
      for (const user of response.includes.users) {
        userMap.set(user.id, user);
      }
    }

    // Build media lookup map
    const mediaMap = new Map<string, XMedia>();
    if (response.includes?.media) {
      for (const media of response.includes.media) {
        mediaMap.set(media.media_key, media);
      }
    }

    for (const tweet of response.data) {
      const user = userMap.get(tweet.author_id);
      const metrics = tweet.public_metrics;

      const hashtags = tweet.entities?.hashtags?.map(h => `#${h.tag}`) || extractHashtags(tweet.text);

      const mediaUrls: string[] = [];
      if (tweet.attachments?.media_keys) {
        for (const key of tweet.attachments.media_keys) {
          const media = mediaMap.get(key);
          if (media?.url) {
            mediaUrls.push(media.url);
          } else if (media?.preview_image_url) {
            mediaUrls.push(media.preview_image_url);
          }
        }
      }

      posts.push({
        platform: 'x',
        externalId: `x-${tweet.id}`,
        authorHandle: user?.username || null,
        authorName: user?.name || null,
        authorFollowers: user?.public_metrics?.followers_count || null,
        content: tweet.text,
        postUrl: user?.username ? `https://x.com/${user.username}/status/${tweet.id}` : null,
        mediaUrls,
        likes: metrics?.like_count || 0,
        reposts: metrics?.retweet_count || 0,
        comments: metrics?.reply_count || 0,
        views: metrics?.impression_count || 0,
        hashtags: filterGenericHashtags(hashtags),
        topics: category ? [category] : [],
        region: region || 'global',
        category: category || 'Viral',
        postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      });
    }

    // Sort by engagement
    posts.sort((a, b) => {
      const engagementA = a.likes + a.reposts + (a.views / 100);
      const engagementB = b.likes + b.reposts + (b.views / 100);
      return engagementB - engagementA;
    });

    return posts.slice(0, limit);
  }

  /**
   * Fallback: Fetch tweets via Nitter mirrors
   */
  private async fetchViaScraping(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    const NITTER_MIRRORS = [
      'https://nitter.privacydev.net',
      'https://nitter.poast.org',
      'https://nitter.woodland.cafe',
    ];

    const POPULAR_ACCOUNTS = [
      { username: 'Reuters', name: 'Reuters' },
      { username: 'AP', name: 'Associated Press' },
      { username: 'BBCBreaking', name: 'BBC Breaking News' },
      { username: 'CNN', name: 'CNN' },
      { username: 'nikikomey', name: 'Nikkei' },
    ];

    for (const mirror of NITTER_MIRRORS) {
      if (posts.length >= limit) break;

      for (const account of POPULAR_ACCOUNTS) {
        if (posts.length >= limit) break;

        try {
          const nitterUrl = `${mirror}/${account.username}/rss`;
          const feed = await parser.parseURL(nitterUrl);

          for (const item of (feed.items || []).slice(0, 3)) {
            const content = item.contentSnippet || item.title || '';
            const hashtags = extractHashtags(content);

            const tweetIdMatch = item.link?.match(/\/status\/(\d+)/);
            const tweetId = tweetIdMatch?.[1];

            if (tweetId) {
              posts.push({
                platform: 'x',
                externalId: `x-${tweetId}`,
                authorHandle: account.username,
                authorName: account.name,
                authorFollowers: null,
                content: content.slice(0, 280),
                postUrl: `https://x.com/${account.username}/status/${tweetId}`,
                mediaUrls: [],
                likes: 1000,
                reposts: 100,
                comments: 50,
                views: 10000,
                hashtags: filterGenericHashtags(hashtags),
                topics: [account.name],
                region: region || 'global',
                category: 'Viral',
                postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              });
            }
          }
        } catch (error) {
          // Nitter mirrors frequently go down
        }
      }

      if (posts.length > 0) break;
    }

    return posts.slice(0, limit);
  }

  /**
   * Fetch trending topics
   * Uses scraping since v1.1 trends endpoint requires Pro tier ($5K/mo)
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    // Try Trends24 scraping
    const topics = await this.scrapeTrends24(region);
    if (topics.length > 0) {
      return topics;
    }

    // Fallback to RSS
    const rssTopics = await this.fetchTrendRSS();
    if (rssTopics.length > 0) {
      return region ? rssTopics.map(t => ({ ...t, region })) : rssTopics;
    }

    console.log('[x-adapter] No trending topics found');
    return [];
  }

  /**
   * Scrape trends from Trends24.in
   */
  private async scrapeTrends24(region?: string): Promise<TrendingTopic[]> {
    try {
      const regionPath = region === 'singapore' ? 'singapore'
        : region === 'china' ? 'china'
        : region === 'japan' ? 'japan'
        : region === 'east_asia' ? 'japan'
        : region === 'korea' ? 'south-korea'
        : region === 'indonesia' ? 'indonesia'
        : region === 'malaysia' ? 'malaysia'
        : region === 'india' ? 'india'
        : region === 'us' ? 'united-states'
        : region === 'uk' ? 'united-kingdom'
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

      // Extract from meta description
      const metaMatch = html.match(/<meta\s+name=["']?description["']?\s+content=["']([^"']+)["']/i);
      if (metaMatch) {
        const desc = metaMatch[1];
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

      // Also extract from list items
      const listItemMatches = html.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/li>/gi);
      let index = topics.length;
      for (const match of listItemMatches) {
        const name = match[1].trim();
        if (name && name.length > 1 && index < 30 && !isGenericHashtag(name)) {
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

      console.log(`[x-adapter] Trends24 scraped ${topics.length} topics for ${region || 'global'}`);
      return topics;
    } catch (error) {
      console.warn(`[x-adapter] Trends24 scrape error:`, error);
      return [];
    }
  }

  /**
   * Fallback: Fetch trends via RSS
   */
  private async fetchTrendRSS(): Promise<TrendingTopic[]> {
    try {
      const feed = await parser.parseURL('https://trends24.in/feed/');

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
      }).filter(t => !isGenericHashtag(t.name));
    } catch (error) {
      console.warn(`[x-adapter] Trends RSS error:`, error);
      return [];
    }
  }

  /**
   * Search for posts matching a query
   * Uses X API if available
   */
  async searchPosts(query: string, limit = 20): Promise<SocialPost[]> {
    if (!this.bearerToken) {
      console.warn('[x-adapter] Search requires X API bearer token');
      return [];
    }

    const searchQuery = `${query} -is:retweet lang:en`;

    const response = await this.apiRequest<XSearchResponse>('/tweets/search/recent', {
      query: searchQuery,
      max_results: Math.min(limit, 100).toString(),
      'tweet.fields': 'public_metrics,created_at,author_id,entities',
      'user.fields': 'name,username,public_metrics',
      expansions: 'author_id',
    });

    if (!response?.data) {
      return [];
    }

    const userMap = new Map<string, XUser>();
    if (response.includes?.users) {
      for (const user of response.includes.users) {
        userMap.set(user.id, user);
      }
    }

    return response.data.map((tweet) => {
      const user = userMap.get(tweet.author_id);
      const metrics = tweet.public_metrics;
      const hashtags = tweet.entities?.hashtags?.map(h => `#${h.tag}`) || extractHashtags(tweet.text);

      return {
        platform: 'x' as const,
        externalId: `x-${tweet.id}`,
        authorHandle: user?.username || null,
        authorName: user?.name || null,
        authorFollowers: user?.public_metrics?.followers_count || null,
        content: tweet.text,
        postUrl: user?.username ? `https://x.com/${user.username}/status/${tweet.id}` : null,
        mediaUrls: [],
        likes: metrics?.like_count || 0,
        reposts: metrics?.retweet_count || 0,
        comments: metrics?.reply_count || 0,
        views: metrics?.impression_count || 0,
        hashtags: filterGenericHashtags(hashtags),
        topics: [query],
        region: null,
        category: 'Search',
        postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      };
    });
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): Record<string, { remaining: number; resetsIn: number }> {
    const status: Record<string, { remaining: number; resetsIn: number }> = {};
    const now = Date.now();

    for (const [endpoint, limit] of this.rateLimits.entries()) {
      status[endpoint] = {
        remaining: limit.remaining,
        resetsIn: Math.max(0, Math.ceil((limit.resetAt.getTime() - now) / 1000)),
      };
    }

    return status;
  }
}

// ---------------------------------------------------------
// X API v2 Response Types
// ---------------------------------------------------------

interface XSearchResponse {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
    media?: XMedia[];
  };
  meta?: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}

interface XTweet {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string }>;
    urls?: Array<{ url: string; expanded_url: string }>;
  };
  attachments?: {
    media_keys?: string[];
  };
}

interface XUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface XMedia {
  media_key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  preview_image_url?: string;
}
