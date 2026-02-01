// Social Listener Service - Main entry point

import { RedditAdapter } from './platform-adapters/reddit-adapter';
import { GoogleTrendsAdapter } from './platform-adapters/google-trends-adapter';
import { XAdapter } from './platform-adapters/x-adapter';
import { YouTubeAdapter } from './platform-adapters/youtube-adapter';
import { TikTokAdapter } from './platform-adapters/tiktok-adapter';
import { InstagramAdapter } from './platform-adapters/instagram-adapter';
import type {
  PlatformAdapter,
  SocialPost,
  TrendingTopic,
} from './platform-adapters/types';
import { normalizeTopic, hashTopic } from './platform-adapters/types';

export * from './platform-adapters/types';

// ============================================================================
// In-Memory Cache for faster responses
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache
const viralPostsCache = new Map<string, CacheEntry<SocialPost[]>>();
const trendingTopicsCache = new Map<string, CacheEntry<TrendingTopic[]>>();

function getCacheKey(platform: string, region?: string): string {
  return `${platform}:${region || 'global'}`;
}

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

// Timeout wrapper for platform fetches
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ============================================================================
// Platform Registry
// ============================================================================

const adapters: Record<string, PlatformAdapter> = {
  reddit: new RedditAdapter(),
  google_trends: new GoogleTrendsAdapter(),
  x: new XAdapter(),
  youtube: new YouTubeAdapter(),
  tiktok: new TikTokAdapter(),
  instagram: new InstagramAdapter(),
};

// ============================================================================
// Viral Posts
// ============================================================================

export interface ViralPostsOptions {
  platforms?: string[];
  region?: string;
  limit?: number;
  category?: string;
}

export async function getViralPosts(
  options: ViralPostsOptions = {}
): Promise<SocialPost[]> {
  const {
    platforms = ['reddit', 'google_trends', 'x', 'youtube', 'tiktok', 'instagram'],
    region,
    limit = 50,
    category,
  } = options;

  const allPosts: SocialPost[] = [];
  const PLATFORM_TIMEOUT_MS = 8000; // 8 second timeout per platform

  // Fetch from each platform in parallel with caching and timeout
  const results = await Promise.allSettled(
    platforms.map(async (platform) => {
      const adapter = adapters[platform];
      if (!adapter) return [];

      // Check cache first
      const cacheKey = getCacheKey(platform, region);
      const cached = viralPostsCache.get(cacheKey);
      if (isCacheValid(cached)) {
        console.log(`[social-listener] Cache hit for ${platform}`);
        return cached.data;
      }

      // Fetch with timeout
      console.log(`[social-listener] Fetching ${platform}...`);
      const startTime = Date.now();

      const posts = await withTimeout(
        adapter.getViralPosts({ region, limit: Math.ceil(limit / platforms.length), category }),
        PLATFORM_TIMEOUT_MS,
        [] // Return empty array on timeout
      );

      const elapsed = Date.now() - startTime;
      console.log(`[social-listener] ${platform} returned ${posts.length} posts in ${elapsed}ms`);

      // Cache the result
      if (posts.length > 0) {
        viralPostsCache.set(cacheKey, { data: posts, timestamp: Date.now() });
      }

      return posts;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allPosts.push(...result.value);
    }
  }

  // Sort by engagement score
  allPosts.sort(
    (a, b) =>
      b.likes + b.comments * 3 + b.reposts * 2 -
      (a.likes + a.comments * 3 + a.reposts * 2)
  );

  return allPosts.slice(0, limit);
}

// ============================================================================
// Trending Topics
// ============================================================================

export interface TrendingTopicsOptions {
  platforms?: string[];
  region?: string;
  limit?: number;
}

export interface AggregatedTopic {
  name: string;
  normalizedName: string;
  topicHash: string;
  hashtag: string | null;
  platforms: string[];
  totalEngagement: number;
  totalPosts: number;
  crossPlatformScore: number;
  region: string | null;
  url: string | null;
}

export async function getTrendingTopics(
  options: TrendingTopicsOptions = {}
): Promise<AggregatedTopic[]> {
  const {
    platforms = ['reddit', 'google_trends', 'x', 'youtube', 'tiktok', 'instagram'],
    region,
    limit = 30,
  } = options;

  const allTopics: TrendingTopic[] = [];
  const PLATFORM_TIMEOUT_MS = 8000; // 8 second timeout per platform

  // Fetch from each platform in parallel with caching and timeout
  const results = await Promise.allSettled(
    platforms.map(async (platform) => {
      const adapter = adapters[platform];
      if (!adapter) return [];

      // Check cache first
      const cacheKey = `trending:${getCacheKey(platform, region)}`;
      const cached = trendingTopicsCache.get(cacheKey);
      if (isCacheValid(cached)) {
        console.log(`[social-listener] Cache hit for trending ${platform}`);
        return cached.data;
      }

      // Fetch with timeout
      const topics = await withTimeout(
        adapter.getTrending(region),
        PLATFORM_TIMEOUT_MS,
        [] // Return empty array on timeout
      );

      // Cache the result
      if (topics.length > 0) {
        trendingTopicsCache.set(cacheKey, { data: topics, timestamp: Date.now() });
      }

      return topics;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allTopics.push(...result.value);
    }
  }

  // Aggregate topics by normalized name
  const topicMap = new Map<string, AggregatedTopic>();

  for (const topic of allTopics) {
    const key = topic.normalizedName;
    const existing = topicMap.get(key);

    if (existing) {
      // Merge with existing
      if (!existing.platforms.includes(topic.platform)) {
        existing.platforms.push(topic.platform);
      }
      existing.totalEngagement += topic.engagement;
      existing.totalPosts += topic.postCount;
      // Keep the first URL we found
      if (!existing.url && topic.url) {
        existing.url = topic.url;
      }
    } else {
      // Create new entry
      topicMap.set(key, {
        name: topic.name,
        normalizedName: topic.normalizedName,
        topicHash: hashTopic(topic.name),
        hashtag: topic.hashtag,
        platforms: [topic.platform],
        totalEngagement: topic.engagement,
        totalPosts: topic.postCount,
        crossPlatformScore: 0, // Calculated below
        region: topic.region,
        url: topic.url,
      });
    }
  }

  // Calculate cross-platform score
  const topics = Array.from(topicMap.values());
  for (const topic of topics) {
    // Multiplier based on number of platforms
    const platformMultiplier = Math.min(topic.platforms.length, 3);
    topic.crossPlatformScore = topic.totalEngagement * platformMultiplier;
  }

  // Sort by cross-platform score
  topics.sort((a, b) => b.crossPlatformScore - a.crossPlatformScore);

  return topics.slice(0, limit);
}

// ============================================================================
// Hashtag Analysis
// ============================================================================

export interface HashtagMetrics {
  hashtag: string;
  normalizedHashtag: string;
  currentPosts: number;
  currentEngagement: number;
  platforms: string[];
  momentumScore: number;
  momentumDirection: 'rising' | 'falling' | 'stable';
  percentChange: number;
  topPosts: SocialPost[];
}

export async function getTrendingHashtags(
  options: TrendingTopicsOptions = {}
): Promise<HashtagMetrics[]> {
  const { platforms = ['reddit', 'x'], region, limit = 20 } = options;

  // Get viral posts to extract hashtags
  const posts = await getViralPosts({ platforms, region, limit: 100 });

  // Aggregate hashtags
  const hashtagMap = new Map<
    string,
    {
      hashtag: string;
      posts: SocialPost[];
      engagement: number;
      platforms: Set<string>;
    }
  >();

  for (const post of posts) {
    for (const tag of post.hashtags) {
      const normalized = normalizeTopic(tag);
      const existing = hashtagMap.get(normalized) || {
        hashtag: tag,
        posts: [],
        engagement: 0,
        platforms: new Set(),
      };

      existing.posts.push(post);
      existing.engagement += post.likes + post.comments * 2;
      existing.platforms.add(post.platform);
      hashtagMap.set(normalized, existing);
    }
  }

  // Convert to metrics array
  const hashtags: HashtagMetrics[] = [];
  for (const [normalized, data] of hashtagMap.entries()) {
    if (data.posts.length >= 1) {
      hashtags.push({
        hashtag: data.hashtag,
        normalizedHashtag: normalized,
        currentPosts: data.posts.length,
        currentEngagement: data.engagement,
        platforms: Array.from(data.platforms),
        momentumScore: 0, // Would be calculated from historical data
        momentumDirection: 'stable',
        percentChange: 0,
        topPosts: data.posts.slice(0, 3),
      });
    }
  }

  // Sort by engagement
  hashtags.sort((a, b) => b.currentEngagement - a.currentEngagement);

  return hashtags.slice(0, limit);
}

// ============================================================================
// Search
// ============================================================================

export async function searchSocialPosts(
  query: string,
  options: { platforms?: string[]; limit?: number } = {}
): Promise<SocialPost[]> {
  const { platforms = ['reddit'], limit = 25 } = options;

  const allPosts: SocialPost[] = [];

  for (const platform of platforms) {
    const adapter = adapters[platform];
    if (adapter?.searchPosts) {
      try {
        const posts = await adapter.searchPosts(query, limit);
        allPosts.push(...posts);
      } catch (error) {
        console.error(`[social-listener] Search failed for ${platform}:`, error);
      }
    }
  }

  return allPosts.slice(0, limit);
}
