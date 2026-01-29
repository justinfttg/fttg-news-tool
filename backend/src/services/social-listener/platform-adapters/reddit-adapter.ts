// Reddit adapter - fetches viral posts and trending topics via public JSON API

import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { extractHashtags, normalizeTopic } from './types';

interface RedditPost {
  data: {
    id: string;
    author: string;
    title: string;
    selftext: string;
    url: string;
    permalink: string;
    ups: number;
    num_comments: number;
    created_utc: number;
    subreddit: string;
    stickied: boolean;
    is_video: boolean;
    thumbnail: string;
    preview?: {
      images?: Array<{
        source: { url: string };
      }>;
    };
  };
}

interface SubredditConfig {
  sub: string;
  region: string | null;
  category: string | null;
}

const VIRAL_SUBREDDITS: SubredditConfig[] = [
  // News - Global
  { sub: 'worldnews', region: 'global', category: 'News' },
  { sub: 'news', region: 'global', category: 'News' },
  { sub: 'UpliftingNews', region: 'global', category: 'News' },

  // Tech
  { sub: 'technology', region: 'global', category: 'Technology' },
  { sub: 'gadgets', region: 'global', category: 'Technology' },

  // Business/Economy
  { sub: 'business', region: 'global', category: 'Business' },
  { sub: 'economy', region: 'global', category: 'Economy' },

  // Regional - Asia
  { sub: 'singapore', region: 'singapore', category: 'General' },
  { sub: 'China', region: 'china', category: 'General' },
  { sub: 'japan', region: 'east_asia', category: 'General' },
  { sub: 'korea', region: 'east_asia', category: 'General' },
  { sub: 'asia', region: 'asia', category: 'General' },

  // Science/Health
  { sub: 'science', region: 'global', category: 'Science' },
  { sub: 'health', region: 'global', category: 'Health' },

  // Environment
  { sub: 'environment', region: 'global', category: 'Environment' },
  { sub: 'climate', region: 'global', category: 'Environment' },

  // Popular/Viral
  { sub: 'popular', region: 'global', category: 'General' },
];

export class RedditAdapter implements PlatformAdapter {
  readonly platform = 'reddit';

  // Reddit requires a more realistic user agent for public API
  private readonly userAgent = 'Mozilla/5.0 (compatible; FTTG-News/1.0; +https://fttg.tv)';
  private readonly baseUrl = 'https://www.reddit.com';

  /**
   * Fetch hot posts from configured subreddits
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 50, category } = options || {};

    // Filter subreddits by region/category if specified
    let subs = VIRAL_SUBREDDITS;
    if (region) {
      subs = subs.filter((s) => s.region === region || s.region === 'global');
    }
    if (category) {
      subs = subs.filter((s) => s.category === category);
    }

    const allPosts: SocialPost[] = [];
    const postsPerSub = Math.ceil(limit / subs.length);

    // Fetch from each subreddit in parallel
    const results = await Promise.allSettled(
      subs.map((sub) => this.fetchSubreddit(sub, postsPerSub))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPosts.push(...result.value);
      }
    }

    // Sort by engagement and dedupe
    const seen = new Set<string>();
    const uniquePosts = allPosts.filter((post) => {
      if (seen.has(post.externalId)) return false;
      seen.add(post.externalId);
      return true;
    });

    // Sort by engagement score (likes + comments*3)
    uniquePosts.sort(
      (a, b) => b.likes + b.comments * 3 - (a.likes + a.comments * 3)
    );

    return uniquePosts.slice(0, limit);
  }

  /**
   * Fetch trending topics by analyzing hot posts
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    const posts = await this.getViralPosts({ region, limit: 100 });

    // Extract and aggregate topics from post titles
    const topicMap = new Map<
      string,
      { name: string; posts: number; engagement: number }
    >();

    for (const post of posts) {
      // Extract significant words from title (simple approach)
      const words = this.extractSignificantWords(post.content);

      for (const word of words) {
        const normalized = normalizeTopic(word);
        if (normalized.length < 3) continue;

        const existing = topicMap.get(normalized) || {
          name: word,
          posts: 0,
          engagement: 0,
        };
        existing.posts += 1;
        existing.engagement += post.likes + post.comments;
        topicMap.set(normalized, existing);
      }

      // Also count hashtags
      for (const hashtag of post.hashtags) {
        const normalized = normalizeTopic(hashtag);
        const existing = topicMap.get(normalized) || {
          name: hashtag,
          posts: 0,
          engagement: 0,
        };
        existing.posts += 1;
        existing.engagement += post.likes + post.comments;
        topicMap.set(normalized, existing);
      }
    }

    // Convert to array and filter for significant topics
    const topics: TrendingTopic[] = [];
    for (const [normalized, data] of topicMap.entries()) {
      if (data.posts >= 2) {
        // Must appear in at least 2 posts
        topics.push({
          name: data.name,
          normalizedName: normalized,
          hashtag: data.name.startsWith('#') ? data.name : null,
          platform: 'reddit',
          postCount: data.posts,
          engagement: data.engagement,
          url: null,
          region: region || 'global',
        });
      }
    }

    // Sort by engagement
    topics.sort((a, b) => b.engagement - a.engagement);

    return topics.slice(0, 30);
  }

  /**
   * Search Reddit for posts matching a query
   */
  async searchPosts(query: string, limit = 25): Promise<SocialPost[]> {
    try {
      const url = `${this.baseUrl}/search.json?q=${encodeURIComponent(query)}&sort=hot&limit=${limit}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent },
      });

      if (!response.ok) {
        console.error(`[reddit] Search failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as { data?: { children?: RedditPost[] } };
      return this.mapPosts(data.data?.children || [], null, null);
    } catch (error) {
      console.error('[reddit] Search error:', error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchSubreddit(
    config: SubredditConfig,
    limit: number
  ): Promise<SocialPost[]> {
    try {
      const url = `${this.baseUrl}/r/${config.sub}/hot.json?limit=${limit}&raw_json=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error(`[reddit] r/${config.sub} failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as { data?: { children?: RedditPost[] } };
      const posts = data.data?.children || [];
      console.log(`[reddit] r/${config.sub} fetched ${posts.length} posts`);

      return this.mapPosts(posts, config.region, config.category);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[reddit] r/${config.sub} error: ${msg}`);
      return [];
    }
  }

  private mapPosts(
    posts: RedditPost[],
    region: string | null,
    category: string | null
  ): SocialPost[] {
    return posts
      .filter((p) => !p.data.stickied) // Exclude pinned posts
      .map((p) => ({
        platform: 'reddit' as const,
        externalId: p.data.id,
        authorHandle: p.data.author,
        authorName: null,
        authorFollowers: null,
        content: p.data.title,
        postUrl: `https://reddit.com${p.data.permalink}`,
        mediaUrls: this.extractMediaUrls(p),
        likes: p.data.ups,
        reposts: 0,
        comments: p.data.num_comments,
        views: 0,
        hashtags: extractHashtags(p.data.title + ' ' + (p.data.selftext || '')),
        topics: [p.data.subreddit],
        region,
        category,
        postedAt: new Date(p.data.created_utc * 1000),
      }));
  }

  private extractMediaUrls(post: RedditPost): string[] {
    const urls: string[] = [];

    if (
      post.data.thumbnail &&
      post.data.thumbnail.startsWith('http') &&
      !post.data.thumbnail.includes('default')
    ) {
      urls.push(post.data.thumbnail);
    }

    if (post.data.preview?.images?.[0]?.source?.url) {
      // Reddit encodes URLs in preview
      urls.push(post.data.preview.images[0].source.url.replace(/&amp;/g, '&'));
    }

    return urls;
  }

  private extractSignificantWords(text: string): string[] {
    // Remove common words and extract potentially trending terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'which',
      'who',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'also',
      'now',
      'new',
      'after',
      'says',
      'said',
      'over',
      'into',
      'about',
      'get',
      'got',
      'his',
      'her',
      'its',
      'their',
      'my',
      'your',
      'our',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    // Return unique words that might be topics
    return [...new Set(words)];
  }
}
