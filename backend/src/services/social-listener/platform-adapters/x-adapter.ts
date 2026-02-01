// X/Twitter adapter - fetches trending topics and viral tweets via multiple sources
// Scrapes actual tweet links from Nitter mirrors, oembed, and aggregator sites

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

// Nitter mirrors for fetching tweets (these change frequently)
const NITTER_MIRRORS = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.woodland.cafe',
];

// Popular accounts for viral content
const POPULAR_ACCOUNTS = [
  { username: 'elonmusk', name: 'Elon Musk' },
  { username: 'POTUS', name: 'President Biden' },
  { username: 'CNN', name: 'CNN' },
  { username: 'BBCBreaking', name: 'BBC Breaking News' },
  { username: 'Reuters', name: 'Reuters' },
  { username: 'AP', name: 'Associated Press' },
  { username: 'NASA', name: 'NASA' },
  { username: 'nikikomey', name: 'Nikkei' },
];

export class XAdapter implements PlatformAdapter {
  readonly platform = 'x';

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Fetch X/Twitter content from multiple sources
   * Prioritizes actual tweet links over news articles
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};
    const allPosts: SocialPost[] = [];

    // Try to fetch actual tweets via Nitter
    const nitterPosts = await this.fetchViaNitter(region, limit);
    allPosts.push(...nitterPosts);

    // Try to get tweets via publish.twitter.com oembed
    const oembedPosts = await this.fetchViaOembed(region, Math.ceil(limit / 2));
    allPosts.push(...oembedPosts);

    // Get trending topics and create tweet links
    const topics = await this.getTrending(region);
    const topicPosts = topics.slice(0, Math.ceil(limit / 3)).map((topic) => ({
      platform: 'x' as const,
      externalId: `x-topic-${topic.normalizedName}`,
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

    // Fallback to Google News for Twitter/X trending articles
    if (allPosts.length < limit / 2) {
      const newsPosts = await this.fetchTwitterNews(region, limit);
      allPosts.push(...newsPosts);
    }

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
  // Private helpers - Actual tweet scraping
  // -------------------------------------------------------------------------

  /**
   * Fetch tweets via Nitter mirrors (privacy-focused Twitter frontend)
   */
  private async fetchViaNitter(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    // Try each Nitter mirror
    for (const mirror of NITTER_MIRRORS) {
      if (posts.length >= limit) break;

      // Fetch from popular accounts
      for (const account of POPULAR_ACCOUNTS.slice(0, 5)) {
        if (posts.length >= limit) break;

        try {
          const nitterUrl = `${mirror}/${account.username}/rss`;
          const feed = await parser.parseURL(nitterUrl);

          for (const item of (feed.items || []).slice(0, 3)) {
            const content = item.contentSnippet || item.title || '';
            const hashtags = extractHashtags(content);

            // Extract tweet ID from Nitter URL
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
                likes: 1000, // Estimate since Nitter RSS doesn't provide
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
          // Expected - Nitter mirrors go up and down
          console.warn(`[x-adapter] Nitter ${mirror} error for @${account.username}:`, error);
        }
      }

      // If we got posts from this mirror, stop trying others
      if (posts.length > 0) break;
    }

    return posts;
  }

  /**
   * Fetch tweet metadata via Twitter's publish oembed API
   */
  private async fetchViaOembed(region: string | undefined, limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    // First, try to find tweet IDs from trending topics
    const trends = await this.scrapeTrends24(region);

    for (const trend of trends.slice(0, 10)) {
      if (posts.length >= limit) break;

      // Search for tweets about this trend via Nitter
      for (const mirror of NITTER_MIRRORS.slice(0, 1)) {
        try {
          const searchTerm = encodeURIComponent(trend.name);
          const searchUrl = `${mirror}/search/rss?f=tweets&q=${searchTerm}`;
          const feed = await parser.parseURL(searchUrl);

          for (const item of (feed.items || []).slice(0, 2)) {
            const tweetIdMatch = item.link?.match(/\/status\/(\d+)/);
            const tweetId = tweetIdMatch?.[1];
            const authorMatch = item.link?.match(/nitter[^/]*\/([^/]+)\/status/);
            const author = authorMatch?.[1] || 'user';

            if (tweetId) {
              // Try to get oembed data for additional metadata
              const oembedData = await this.getOembedData(author, tweetId);
              const content = oembedData?.html
                ? this.extractTextFromOembed(oembedData.html)
                : (item.contentSnippet || item.title || '');
              const hashtags = extractHashtags(content);

              posts.push({
                platform: 'x',
                externalId: `x-${tweetId}`,
                authorHandle: oembedData?.author_name?.replace('@', '') || author,
                authorName: oembedData?.author_name || author,
                authorFollowers: null,
                content: content.slice(0, 280),
                postUrl: `https://x.com/${author}/status/${tweetId}`,
                mediaUrls: [],
                likes: 500,
                reposts: 50,
                comments: 25,
                views: 5000,
                hashtags: filterGenericHashtags(hashtags),
                topics: [trend.name],
                region: region || 'global',
                category: 'Trending',
                postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              });
            }
          }
        } catch {
          // Expected
        }
      }
    }

    return posts;
  }

  /**
   * Get oembed data from Twitter/X
   */
  private async getOembedData(username: string, tweetId: string): Promise<{
    html?: string;
    author_name?: string;
    author_url?: string;
  } | null> {
    try {
      const oembedUrl = `https://publish.twitter.com/oembed?url=https://x.com/${username}/status/${tweetId}`;
      const response = await fetch(oembedUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;
      const data = await response.json() as {
        html?: string;
        author_name?: string;
        author_url?: string;
      };
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Extract plain text from oembed HTML
   */
  private extractTextFromOembed(html: string): string {
    // Remove HTML tags and decode entities
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  // -------------------------------------------------------------------------
  // Existing helpers
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

          // Try to extract tweet URLs from the article
          const tweetUrls = await this.extractTweetUrlsFromArticle(item.link || '');

          if (tweetUrls.length > 0) {
            // If we found actual tweet URLs, create posts for them
            for (const tweetUrl of tweetUrls.slice(0, 2)) {
              const tweetMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
              if (tweetMatch) {
                const [, username, tweetId] = tweetMatch;
                const oembedData = await this.getOembedData(username, tweetId);
                const content = oembedData?.html
                  ? this.extractTextFromOembed(oembedData.html)
                  : title;
                const hashtags = extractHashtags(content);

                posts.push({
                  platform: 'x',
                  externalId: `x-${tweetId}`,
                  authorHandle: username,
                  authorName: oembedData?.author_name || username,
                  authorFollowers: null,
                  content: content.slice(0, 280),
                  postUrl: `https://x.com/${username}/status/${tweetId}`,
                  mediaUrls: [],
                  likes: 1000,
                  reposts: 100,
                  comments: 50,
                  views: 10000,
                  hashtags: filterGenericHashtags(hashtags),
                  topics: ['Viral'],
                  region: region || 'global',
                  category: 'Viral',
                  postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                });
              }
            }
          } else {
            // Fallback to news article
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
              category: 'News',
              postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            });
          }
        }
      } catch (error) {
        console.warn(`[x-adapter] Google News RSS error:`, error);
      }

      if (posts.length >= limit) break;
    }

    return posts.slice(0, limit);
  }

  /**
   * Try to extract tweet URLs from a news article
   */
  private async extractTweetUrlsFromArticle(articleUrl: string): Promise<string[]> {
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
      // Find Twitter/X tweet URLs
      const tweetMatches = html.matchAll(/https?:\/\/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/g);
      const urls: string[] = [];
      for (const match of tweetMatches) {
        if (!urls.includes(match[0])) {
          urls.push(match[0]);
        }
      }
      return urls;
    } catch {
      return [];
    }
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
