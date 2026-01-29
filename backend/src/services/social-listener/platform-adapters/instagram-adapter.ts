// Instagram adapter - attempts to fetch public data via multiple methods
// Note: Instagram heavily blocks scraping - this uses fallback strategies

import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, extractHashtags, filterGenericHashtags } from './types';

// Instagram-related news sources
const INSTAGRAM_NEWS_SOURCES = [
  'https://about.instagram.com/blog/rss',
];

export class InstagramAdapter implements PlatformAdapter {
  readonly platform = 'instagram';

  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

  /**
   * Fetch Instagram content - multiple fallback methods
   * Only returns actual content, no generic hashtag fillers
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 20 } = options || {};

    const allPosts: SocialPost[] = [];

    // Method 1: Try fetching from Instagram blog RSS
    const blogPosts = await this.fetchInstagramBlog(limit);
    allPosts.push(...blogPosts);

    // Method 2: Try public profile data (limited)
    const profilePosts = await this.fetchPublicProfiles(region, limit);
    allPosts.push(...profilePosts);

    // No generic hashtag fallback - only show real content
    // If we can't get real data, return empty rather than useless generic hashtags

    return allPosts.slice(0, limit);
  }

  /**
   * Get trending topics from Instagram
   * Returns empty since we can't get real trending data without API
   */
  async getTrending(_region?: string): Promise<TrendingTopic[]> {
    // Instagram doesn't expose trending publicly and we don't want to show
    // generic hashtags that aren't actually "trending"
    // Return empty - be honest about limitations
    console.log('[instagram] No trending API access - returning empty');
    return [];
  }

  /**
   * Search Instagram (returns link to explore)
   */
  async searchPosts(query: string, _limit = 10): Promise<SocialPost[]> {
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
            const rawHashtags = extractHashtags(title);
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
              hashtags: filterGenericHashtags(rawHashtags),
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
          const rawHashtags = extractHashtags(caption);

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
            hashtags: filterGenericHashtags(rawHashtags),
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
