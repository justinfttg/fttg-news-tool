// YouTube adapter - fetches trending videos via RSS feeds

import Parser from 'rss-parser';
import type { PlatformAdapter, SocialPost, TrendingTopic } from './types';
import { normalizeTopic, extractHashtags, filterGenericHashtags, isGenericHashtag } from './types';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'FTTG-Social-Listener/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

interface YouTubeRegionConfig {
  code: string;
  region: string;
}

// YouTube trending feeds by region
const YOUTUBE_REGIONS: YouTubeRegionConfig[] = [
  { code: 'SG', region: 'singapore' },
  { code: 'CN', region: 'china' },
  { code: 'JP', region: 'east_asia' },
  { code: 'KR', region: 'east_asia' },
  { code: 'US', region: 'global' },
  { code: 'GB', region: 'global' },
  { code: 'AU', region: 'apac' },
];

// Popular YouTube channels for news/trending content
const TRENDING_CHANNELS = [
  // News channels
  { id: 'UCupvZG-5ko_eiXAupbDfxWw', name: 'CNN', category: 'News', region: 'global' },
  { id: 'UCeY0bbntWzzVIaj2z3QigXg', name: 'NBC News', category: 'News', region: 'global' },
  { id: 'UC16niRr50-MSBwiO3YDb3RA', name: 'BBC News', category: 'News', region: 'global' },
  { id: 'UCef1-8eOpJgud7szVPlZQAQ', name: 'CNA', category: 'News', region: 'singapore' },

  // Tech channels
  { id: 'UCBJycsmduvYEL83R_U4JriQ', name: 'MKBHD', category: 'Technology', region: 'global' },
  { id: 'UCXuqSBlHAE6Xw-yeJA0Tunw', name: 'Linus Tech Tips', category: 'Technology', region: 'global' },

  // Business/Finance
  { id: 'UCvKRFNawVcuz4b9ihUTApCg', name: 'CNBC', category: 'Business', region: 'global' },
  { id: 'UChDKyKQ59fYz3JO2fl0Z6sg', name: 'Bloomberg', category: 'Business', region: 'global' },
];

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = 'youtube';

  /**
   * Fetch recent videos from trending/news channels
   */
  async getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]> {
    const { region, limit = 30, category } = options || {};

    // Filter channels by region/category
    let channels = TRENDING_CHANNELS;
    if (region && region !== 'global') {
      channels = channels.filter((c) => c.region === region || c.region === 'global');
    }
    if (category) {
      channels = channels.filter((c) => c.category === category);
    }

    const allPosts: SocialPost[] = [];
    const postsPerChannel = Math.ceil(limit / channels.length);

    // Fetch from each channel in parallel
    const results = await Promise.allSettled(
      channels.map((channel) => this.fetchChannelFeed(channel, postsPerChannel))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPosts.push(...result.value);
      }
    }

    // Sort by recency (YouTube RSS doesn't have view counts)
    allPosts.sort((a, b) => {
      const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return dateB - dateA;
    });

    return allPosts.slice(0, limit);
  }

  /**
   * Extract trending topics from video titles
   */
  async getTrending(region?: string): Promise<TrendingTopic[]> {
    const posts = await this.getViralPosts({ region, limit: 50 });

    // Extract topics from video titles
    const topicMap = new Map<string, { name: string; count: number }>();

    for (const post of posts) {
      const words = this.extractSignificantWords(post.content);
      for (const word of words) {
        const normalized = normalizeTopic(word);
        if (normalized.length < 3) continue;
        // Skip generic/useless topics
        if (isGenericHashtag(word)) continue;

        const existing = topicMap.get(normalized) || { name: word, count: 0 };
        existing.count += 1;
        topicMap.set(normalized, existing);
      }
    }

    // Convert to trending topics
    const topics: TrendingTopic[] = [];
    for (const [normalized, data] of topicMap.entries()) {
      if (data.count >= 2) {
        topics.push({
          name: data.name,
          normalizedName: normalized,
          hashtag: null,
          platform: 'youtube',
          postCount: data.count,
          engagement: data.count * 100,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(data.name)}`,
          region: region || 'global',
        });
      }
    }

    topics.sort((a, b) => b.engagement - a.engagement);
    return topics.slice(0, 30);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchChannelFeed(
    channel: typeof TRENDING_CHANNELS[0],
    limit: number
  ): Promise<SocialPost[]> {
    try {
      // YouTube channel RSS feed
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
      const feed = await parser.parseURL(url);

      return (feed.items || []).slice(0, limit).map((item) => {
        const videoId = item.id?.split(':').pop() || '';
        const title = item.title || '';

        return {
          platform: 'youtube' as const,
          externalId: `yt-${videoId}`,
          authorHandle: channel.name,
          authorName: channel.name,
          authorFollowers: null,
          content: title,
          postUrl: item.link || `https://www.youtube.com/watch?v=${videoId}`,
          mediaUrls: [`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`],
          likes: 0, // RSS doesn't have engagement data
          reposts: 0,
          comments: 0,
          views: 0,
          hashtags: filterGenericHashtags(extractHashtags(title)),
          topics: [channel.category],
          region: channel.region,
          category: channel.category,
          postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        };
      });
    } catch (error) {
      console.error(`[youtube] ${channel.name} error:`, error);
      return [];
    }
  }

  private extractSignificantWords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'this', 'that', 'these',
      'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'also', 'now', 'new', 'video', 'watch',
      'full', 'official', 'live', 'breaking', 'news', 'update',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));
  }
}
