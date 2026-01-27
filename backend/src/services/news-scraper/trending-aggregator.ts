import { getAllTrending, type TrendingTopic } from './social-scraper';
import { categorizeStory } from './categorizer';
import { upsertTrendingStory, expireTrending, type InsertTrendingStory } from '../../db/queries/news.queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AggregateResult {
  processed: number;
  newStories: number;
  updatedStories: number;
  expired: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a trend score based on:
 * - Number of platforms the topic appears on (cross-platform = more trending)
 * - Sum of individual scores from each platform
 * - Bonus for appearing on 3+ platforms
 */
function calculateTrendScore(appearances: TrendingTopic[]): number {
  const platformCount = new Set(appearances.map((a) => a.platform)).size;
  const rawScore = appearances.reduce((sum, a) => sum + a.score, 0);

  // Cross-platform multiplier: 1x for single platform, 2x for two, 3x for three
  const multiplier = Math.min(platformCount, 3);

  return rawScore * multiplier;
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

interface MergedTopic {
  title: string;
  url: string | null;
  platforms: string[];
  score: number;
  hashtags: string[];
  region: string | null;
}

/**
 * Merge topics by normalised title to detect cross-platform trends.
 * Titles are lowercased and stripped of punctuation for matching.
 */
function mergeTopics(topics: TrendingTopic[]): MergedTopic[] {
  const map = new Map<string, { appearances: TrendingTopic[] }>();

  for (const topic of topics) {
    const key = normalizeTitle(topic.title);
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.appearances.push(topic);
    } else {
      map.set(key, { appearances: [topic] });
    }
  }

  const merged: MergedTopic[] = [];

  for (const { appearances } of map.values()) {
    const platforms = [...new Set(appearances.map((a) => a.platform))];
    const score = calculateTrendScore(appearances);
    const hashtags = [...new Set(appearances.flatMap((a) => a.hashtags))];

    // Use the first appearance with a URL, or the first overall
    const primary = appearances.find((a) => a.url) || appearances[0];
    const region = primary.region;

    merged.push({
      title: primary.title,
      url: primary.url,
      platforms,
      score,
      hashtags,
      region,
    });
  }

  // Sort by score descending
  merged.sort((a, b) => b.score - a.score);

  return merged;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function aggregateTrending(): Promise<AggregateResult> {
  const errors: string[] = [];

  // 1. Fetch from all social platforms
  const { topics, errors: fetchErrors } = await getAllTrending();
  errors.push(...fetchErrors);

  if (topics.length === 0) {
    console.log('[trending-aggregator] No topics fetched from any platform');
    // Still expire old trending
    const expired = await safeExpire(errors);
    return { processed: 0, newStories: 0, updatedStories: 0, expired, errors };
  }

  // 2. Merge cross-platform topics
  const merged = mergeTopics(topics);
  console.log(`[trending-aggregator] ${topics.length} raw topics → ${merged.length} merged`);

  // 3. Save each merged topic to database
  let newStories = 0;
  let updatedStories = 0;

  for (const topic of merged) {
    try {
      const category = categorizeStory(topic.title, null, 'General');
      const region = mapRegion(topic.region);

      const input: InsertTrendingStory = {
        title: topic.title,
        url: topic.url,
        region,
        category,
        trendScore: topic.score,
        platforms: topic.platforms,
      };

      const result = await upsertTrendingStory(input);
      if (result.isNew) {
        newStories++;
      } else {
        updatedStories++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Save "${topic.title.slice(0, 50)}": ${msg}`);
    }
  }

  // 4. Expire old trending topics
  const expired = await safeExpire(errors);

  console.log(
    `[trending-aggregator] Done: ${newStories} new, ${updatedStories} updated, ${expired} expired`
  );

  return {
    processed: merged.length,
    newStories,
    updatedStories,
    expired,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRegion(region: string | null): 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global' | null {
  if (!region) return 'global';
  const valid = ['asia', 'southeast_asia', 'east_asia', 'apac', 'global'];
  return valid.includes(region) ? (region as any) : 'global';
}

async function safeExpire(errors: string[]): Promise<number> {
  try {
    return await expireTrending(24);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Expire: ${msg}`);
    return 0;
  }
}
