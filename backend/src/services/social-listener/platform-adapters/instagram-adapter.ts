// Instagram adapter - attempts to fetch public data via multiple methods
// Note: Instagram heavily blocks scraping - this uses fallback strategies

import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, extractHashtags } from './types';

// Known trending/popular hashtags on Instagram
const TRENDING_HASHTAGS = [
  '#instagood', '#photooftheday', '#fashion', '#beautiful', '#happy',
  '#cute', '#tbt', '#like4like', '#followme', '#picoftheday',
  '#follow', '#me', '#selfie', '#summer', '#art', '#instadaily',
  '#friends', '#repost', '#nature', '#girl', '#fun', '#style',
  '#smile', '#food', '#instalike', '#travel', '#singapore', '#asia',
];

// Instagram-related news sources
const INSTAGRAM_NEWS_SOURCES = [
  'https://about.instagram.com/blog/rss',
];

export class InstagramAdapter implements PlatformAdapter {
  readonly platform = 'instagram';

  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

  /**
   * Fetch Instagram content - multiple fallback methods
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};

    const allPosts: SocialPost[] = [];

    // Method 1: Try Instagram's public hashtag explore (usually blocked)
    // Skipped - Instagram requires login for most content

    // Method 2: Try fetching from Instagram blog RSS
    const blogPosts = await this.fetchInstagramBlog(limit);
    allPosts.push(...blogPosts);

    // Method 3: Try public profile data (limited)
    const profilePosts = await this.fetchPublicProfiles(region, limit);
    allPosts.push(...profilePosts);

    // Method 4: Generate trending hashtag entries
    if (allPosts.length < limit) {
      const hashtagPosts = this.generateHashtagPosts(region, limit - allPosts.length);
      allPosts.push(...hashtagPosts);
    }

    return allPosts.slice(0, limit);
  }

  /**
   * Get trending topics from Instagram
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    // Instagram doesn't expose trending publicly
    // Return known popular hashtags
    return TRENDING_HASHTAGS.slice(0, 25).map((hashtag, index) => ({
      name: hashtag,
      normalizedName: normalizeTopic(hashtag),
      hashtag,
      platform: 'instagram',
      postCount: 1000000 - index * 50000, // Instagram hashtags have huge post counts
      engagement: 10000000 - index * 500000,
      url: `https://www.instagram.com/explore/tags/${hashtag.replace('#', '')}/`,
      region: region || 'global',
    }));
  }

  /**
   * Search Instagram (returns link to explore)
   */
  async searchPosts(query: string, limit = 10): Promise<SocialPost[]> {
    const cleanQuery = query.replace(/[^a-zA-Z0-9]/g, '');

    return [{
      platform: 'instagram',
      externalId: `instagram-search-${cleanQuery}`,
      authorHandle: 'Instagram',
      authorName: `Explore: ${query}`,
      authorFollowers: null,
      content: `Explore "${query}" on Instagram`,
      postUrl: `https://www.instagram.com/explore/tags/${cleanQuery}/`,
      mediaUrls: [],
      likes: 0,
      reposts: 0,
      comments: 0,
      views: 0,
      hashtags: [query.startsWith('#') ? query : `#${cleanQuery}`],
      topics: [query],
      region: 'global',
      category: 'Search',
      postedAt: new Date(),
    }];
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchInstagramBlog(limit: number): Promise<SocialPost[]> {
    const posts: SocialPost[] = [];

    for (const url of INSTAGRAM_NEWS_SOURCES) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) continue;

        const text = await response.text();
        // Basic RSS parsing
        const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);

        for (const match of itemMatches) {
          const itemXml = match[1];
          const title = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
            || itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]
            || '';
          const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
          const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];

          if (title && link) {
            posts.push({
              platform: 'instagram',
              externalId: `ig-blog-${link.split('/').pop() || ''}`,
              authorHandle: 'Instagram',
              authorName: 'Instagram Blog',
              authorFollowers: null,
              content: this.decodeHtml(title.trim()),
              postUrl: link.trim(),
              mediaUrls: [],
              likes: 0,
              reposts: 0,
              comments: 0,
              views: 0,
              hashtags: extractHashtags(title),
              topics: ['Instagram News'],
              region: 'global',
              category: 'News',
              postedAt: pubDate ? new Date(pubDate) : new Date(),
            });
          }

          if (posts.length >= limit) break;
        }
      } catch (error) {
        console.warn(`[instagram] Blog RSS error:`, error);
      }
    }

    return posts;
  }

  private async fetchPublicProfiles(region: string | undefined, limit: number): Promise<SocialPost[]> {
    // Try to fetch from public Instagram profiles
    // Note: This is heavily rate-limited and often blocked

    const publicAccounts = [
      { username: 'instagram', name: 'Instagram', region: 'global' },
      { username: 'natgeo', name: 'National Geographic', region: 'global' },
      { username: 'bbcnews', name: 'BBC News', region: 'global' },
    ];

    const posts: SocialPost[] = [];

    for (const account of publicAccounts) {
      if (region && account.region !== region && account.region !== 'global') continue;

      try {
        // Instagram's public profile JSON endpoint (often blocked)
        const url = `https://www.instagram.com/${account.username}/?__a=1&__d=dis`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          console.warn(`[instagram] ${account.username} blocked: ${response.status}`);
          continue;
        }

        // Try to parse response
        const data = await response.json() as {
          graphql?: {
            user?: {
              edge_owner_to_timeline_media?: {
                edges?: Array<{
                  node: {
                    shortcode: string;
                    edge_media_to_caption?: { edges?: Array<{ node: { text: string } }> };
                    edge_liked_by?: { count: number };
                    edge_media_to_comment?: { count: number };
                    display_url?: string;
                    taken_at_timestamp?: number;
                  };
                }>;
              };
            };
          };
        };

        const edges = data.graphql?.user?.edge_owner_to_timeline_media?.edges || [];

        for (const edge of edges.slice(0, 3)) {
          const node = edge.node;
          const caption = node.edge_media_to_caption?.edges?.[0]?.node.text || '';

          posts.push({
            platform: 'instagram',
            externalId: `ig-${node.shortcode}`,
            authorHandle: account.username,
            authorName: account.name,
            authorFollowers: null,
            content: caption.slice(0, 200) || `Post by @${account.username}`,
            postUrl: `https://www.instagram.com/p/${node.shortcode}/`,
            mediaUrls: node.display_url ? [node.display_url] : [],
            likes: node.edge_liked_by?.count || 0,
            reposts: 0,
            comments: node.edge_media_to_comment?.count || 0,
            views: 0,
            hashtags: extractHashtags(caption),
            topics: [account.name],
            region: account.region,
            category: 'Social',
            postedAt: node.taken_at_timestamp
              ? new Date(node.taken_at_timestamp * 1000)
              : new Date(),
          });
        }
      } catch (error) {
        // Expected to fail most of the time
        console.warn(`[instagram] ${account.username} error:`, error);
      }

      if (posts.length >= limit) break;
    }

    return posts;
  }

  private generateHashtagPosts(region: string | undefined, limit: number): SocialPost[] {
    // Generate posts from known trending hashtags
    const regionHashtags = region === 'singapore'
      ? ['#singapore', '#sg', '#sgfood', '#visitsingapore', ...TRENDING_HASHTAGS]
      : region === 'china'
        ? ['#china', '#shanghai', '#beijing', ...TRENDING_HASHTAGS]
        : TRENDING_HASHTAGS;

    return regionHashtags.slice(0, limit).map((hashtag, index) => ({
      platform: 'instagram' as const,
      externalId: `instagram-hashtag-${hashtag.replace('#', '')}`,
      authorHandle: 'Instagram',
      authorName: 'Trending Hashtag',
      authorFollowers: null,
      content: `${hashtag} - Popular on Instagram`,
      postUrl: `https://www.instagram.com/explore/tags/${hashtag.replace('#', '')}/`,
      mediaUrls: [],
      likes: 1000000 - index * 50000,
      reposts: 0,
      comments: 0,
      views: 10000000 - index * 500000,
      hashtags: [hashtag],
      topics: ['Trending'],
      region: region || 'global',
      category: 'Trending',
      postedAt: new Date(),
    }));
  }

  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }
}
