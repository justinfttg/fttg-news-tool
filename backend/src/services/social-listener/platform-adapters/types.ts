// Platform adapter types for social listener

// Generic/useless hashtags to filter out - these don't indicate real trends
export const GENERIC_HASHTAGS = new Set([
  // Platform-specific generic tags
  'fyp', 'foryou', 'foryoupage', 'viral', 'trending', 'trend', 'explore',
  'reels', 'reel', 'shorts', 'short', 'tiktok', 'instagram', 'twitter', 'youtube',

  // Generic engagement bait
  'follow', 'followme', 'followforfollow', 'f4f', 'like', 'like4like', 'l4l',
  'likeforlike', 'likes', 'comment', 'share', 'repost', 'subscribe',

  // Generic content descriptors
  'photo', 'photooftheday', 'picoftheday', 'picture', 'video', 'content',
  'post', 'new', 'newpost', 'daily', 'today', 'now', 'live', 'update',

  // Generic positive words
  'love', 'amazing', 'awesome', 'beautiful', 'best', 'cool', 'cute', 'fun',
  'good', 'great', 'happy', 'instagood', 'instadaily', 'instalike', 'nice',

  // Generic categories (too broad)
  'life', 'lifestyle', 'me', 'my', 'self', 'selfie', 'style', 'mood',
  'vibes', 'goals', 'motivation', 'inspiration', 'quotes',

  // Platform features
  'story', 'stories', 'igtv', 'live', 'premiere',
]);

/**
 * Check if a hashtag/topic is generic and should be filtered out
 */
export function isGenericHashtag(tag: string): boolean {
  const normalized = tag.toLowerCase().replace(/^#/, '').trim();
  return GENERIC_HASHTAGS.has(normalized) || normalized.length < 3;
}

/**
 * Filter out generic hashtags from a list
 */
export function filterGenericHashtags(hashtags: string[]): string[] {
  return hashtags.filter(tag => !isGenericHashtag(tag));
}

export interface SocialPost {
  platform: 'x' | 'reddit' | 'google_trends' | 'youtube' | 'tiktok' | 'instagram';
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
