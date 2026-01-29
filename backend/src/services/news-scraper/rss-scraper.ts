import Parser from 'rss-parser';
import type { RSSSource } from './sources.config';
import { getSources } from './sources.config';
import { categorizeStory } from './categorizer';
import { upsertStories, updateStorySummary, getStoriesNeedingSummary, type InsertNewsStory } from '../../db/queries/news.queries';
import { summarizeArticle } from '../ai/summarizer';

// Custom type for RSS items with media fields
type CustomItem = {
  title?: string;
  contentSnippet?: string;
  summary?: string;
  content?: string;
  'content:encoded'?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  'media:thumbnail'?: { $: { url: string } };
  'media:content'?: { $: { url: string; medium?: string } };
  enclosure?: { url: string; type?: string };
};

const parser = new Parser<Record<string, unknown>, CustomItem>({
  timeout: 15_000,
  headers: {
    'User-Agent': 'FTTG-News-Scraper/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
  customFields: {
    item: [
      ['media:thumbnail', 'media:thumbnail'],
      ['media:content', 'media:content'],
    ],
  },
});

// ---------------------------------------------------------------------------
// Quality Thresholds
// ---------------------------------------------------------------------------

const QUALITY_THRESHOLDS = {
  minTitleLength: 15,        // Reject short titles like "Baby on board"
  minContentLength: 100,     // Reject image captions
  maxStoriesPerSource: 20,   // Ensure source diversity
};

/**
 * Extract thumbnail URL from various RSS feed formats
 */
function extractThumbnail(item: CustomItem): string | null {
  // Try media:thumbnail first (most common)
  if (item['media:thumbnail']?.$?.url) {
    return item['media:thumbnail'].$.url;
  }

  // Try media:content (used by some feeds for images)
  if (item['media:content']?.$?.url) {
    const medium = item['media:content'].$.medium;
    // Only use if it's explicitly an image or no medium specified
    if (!medium || medium === 'image') {
      return item['media:content'].$.url;
    }
  }

  // Try enclosure (used by some RSS feeds for media)
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  return null;
}

/**
 * Check if a story meets quality thresholds
 */
function isQualityStory(story: InsertNewsStory): boolean {
  // Check title length
  if (story.title.length < QUALITY_THRESHOLDS.minTitleLength) {
    return false;
  }

  // Check content length
  if (story.content.length < QUALITY_THRESHOLDS.minContentLength) {
    return false;
  }

  // Check content is not just the title (image captions)
  if (story.content === story.title) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeResult {
  source: string;
  fetched: number;
  errors: string[];
}

export interface ScrapeAllResult {
  totalFetched: number;
  inserted: number;
  skipped: number;
  aiProcessed: number;
  sources: ScrapeResult[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// 1. scrapeRSS — fetch + parse a single RSS source
// ---------------------------------------------------------------------------

export async function scrapeRSS(source: RSSSource): Promise<InsertNewsStory[]> {
  const feed = await parser.parseURL(source.url);

  const stories: InsertNewsStory[] = (feed.items || []).map((item) => {
    const title = (item.title || '').trim();
    const summary = (item.contentSnippet || item.summary || '').trim() || null;
    const content = (item.content || item['content:encoded'] || summary || title);
    const url = item.link || null;
    const publishedAt = item.isoDate || item.pubDate || null;
    const thumbnailUrl = extractThumbnail(item);

    // Auto-categorize based on title+summary, falling back to source category
    const category = categorizeStory(title, summary, source.category);

    return {
      title,
      summary,
      content,
      source: source.name,
      url,
      region: source.region,
      category,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      thumbnail_url: thumbnailUrl,
    };
  });

  // Filter: non-empty titles + quality thresholds
  const qualityStories = stories
    .filter((s) => s.title.length > 0)
    .filter(isQualityStory);

  // Limit stories per source for diversity
  const limitedStories = qualityStories
    .sort((a, b) => {
      // Sort by published_at descending (most recent first)
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, QUALITY_THRESHOLDS.maxStoriesPerSource);

  return limitedStories;
}

// ---------------------------------------------------------------------------
// 2. scrapeAllSources — orchestrator: scrape, dedup, save
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2. processExistingStoriesWithAI — backfill summaries for existing stories
// ---------------------------------------------------------------------------

export async function processExistingStoriesWithAI(maxStories: number = 50): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[news-scraper] No ANTHROPIC_API_KEY, skipping AI backfill');
    return 0;
  }

  const stories = await getStoriesNeedingSummary(maxStories);
  if (stories.length === 0) {
    console.log('[news-scraper] No stories need AI processing');
    return 0;
  }

  console.log(`[news-scraper] Backfilling AI summaries for ${stories.length} existing stories...`);

  let processed = 0;
  const batchSize = 10;

  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (story) => {
        try {
          const result = await summarizeArticle(story.title, story.content, story.category);
          if (result && story.url) {
            const updated = await updateStorySummary(story.url, result.summary, result.category);
            if (updated) {
              processed++;
            }
          }
        } catch (err) {
          console.error(`[news-scraper] AI backfill failed for "${story.title.slice(0, 30)}..."`);
        }
      })
    );

    // Rate limiting between batches
    if (i + batchSize < stories.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`[news-scraper] AI backfill complete: ${processed} stories updated`);
  return processed;
}

// ---------------------------------------------------------------------------
// 3. scrapeAllSources — orchestrator: scrape, dedup, save
// ---------------------------------------------------------------------------

export async function scrapeAllSources(region?: string): Promise<ScrapeAllResult> {
  const sources = getSources(region);
  const allStories: InsertNewsStory[] = [];
  const sourceResults: ScrapeResult[] = [];
  const globalErrors: string[] = [];

  // Scrape each source, collecting stories and errors
  for (const source of sources) {
    try {
      console.log(`[news-scraper] Fetching ${source.name} (${source.region})...`);
      const stories = await scrapeRSS(source);
      allStories.push(...stories);
      sourceResults.push({ source: source.name, fetched: stories.length, errors: [] });
      console.log(`[news-scraper] ${source.name}: ${stories.length} items`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[news-scraper] ${source.name} failed: ${message}`);
      sourceResults.push({ source: source.name, fetched: 0, errors: [message] });
      globalErrors.push(`${source.name}: ${message}`);
    }
  }

  // Deduplicate by URL within the batch
  const seen = new Set<string>();
  const deduplicated = allStories.filter((story) => {
    if (!story.url) return true; // keep stories without URLs (can't dedup)
    if (seen.has(story.url)) return false;
    seen.add(story.url);
    return true;
  });

  console.log(`[news-scraper] Total fetched: ${allStories.length}, after dedup: ${deduplicated.length}`);

  // AI Processing: Only process stories that need summaries
  let aiProcessed = 0;
  const needsAI = deduplicated.filter((s) => !s.summary || s.summary.length < 20);

  if (needsAI.length > 0 && process.env.ANTHROPIC_API_KEY) {
    console.log(`[news-scraper] Processing ${needsAI.length} stories with AI...`);

    // Process in small batches to manage costs and rate limits
    const batchSize = 10;
    for (let i = 0; i < Math.min(needsAI.length, 50); i += batchSize) {
      const batch = needsAI.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (story) => {
          try {
            const result = await summarizeArticle(story.title, story.content, story.category);
            if (result) {
              story.summary = result.summary;
              story.category = result.category;
              aiProcessed++;
            }
          } catch (err) {
            // Log but don't fail the whole scrape
            console.error(`[news-scraper] AI failed for "${story.title.slice(0, 30)}..."`);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < needsAI.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`[news-scraper] AI processed: ${aiProcessed} stories`);
  }

  // Save to database
  let inserted = 0;
  let skipped = 0;
  try {
    const result = await upsertStories(deduplicated);
    inserted = result.inserted;
    skipped = result.skipped;
    console.log(`[news-scraper] Saved: ${inserted} inserted, ${skipped} skipped (already exist)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[news-scraper] Database save failed: ${message}`);
    globalErrors.push(`DB save: ${message}`);
  }

  return {
    totalFetched: deduplicated.length,
    inserted,
    skipped,
    aiProcessed,
    sources: sourceResults,
    errors: globalErrors,
  };
}
