// Platform adapter types for social listener

export interface SocialPost {
  platform: 'x' | 'reddit' | 'google_trends' | 'youtube';
  externalId: string;
  authorHandle: string | null;
  authorName: string | null;
  authorFollowers: number | null;
  content: string;
  postUrl: string | null;
  mediaUrls: string[];
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  hashtags: string[];
  topics: string[];
  region: string | null;
  category: string | null;
  postedAt: Date | null;
}

export interface TrendingTopic {
  name: string;
  normalizedName: string;
  hashtag: string | null;
  platform: string;
  postCount: number;
  engagement: number;
  url: string | null;
  region: string | null;
}

export interface PlatformAdapter {
  readonly platform: string;

  /**
   * Fetch trending topics/hashtags from the platform
   */
  getTrending(region?: string): Promise<TrendingTopic[]>;

  /**
   * Fetch viral/hot posts from the platform
   */
  getViralPosts(options?: {
    region?: string;
    limit?: number;
    category?: string;
  }): Promise<SocialPost[]>;

  /**
   * Search for posts matching a query (if supported)
   */
  searchPosts?(query: string, limit?: number): Promise<SocialPost[]>;
}

/**
 * Normalize a topic/hashtag name for consistent matching
 */
export function normalizeTopic(name: string): string {
  return name
    .toLowerCase()
    .replace(/^#/, '') // Remove leading hashtag
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract hashtags from text content
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) || [];
  return [...new Set(matches.map((h) => h.toLowerCase()))];
}

/**
 * Generate a hash for topic deduplication
 */
export function hashTopic(name: string): string {
  const normalized = normalizeTopic(name);
  // Simple hash for grouping (not cryptographic)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
