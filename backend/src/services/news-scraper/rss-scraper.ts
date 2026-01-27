import Parser from 'rss-parser';
import type { RSSSource } from './sources.config';
import { getSources } from './sources.config';
import { categorizeStory } from './categorizer';
import { upsertStories, type InsertNewsStory } from '../../db/queries/news.queries';

const parser = new Parser({
  timeout: 15_000,
  headers: {
    'User-Agent': 'FTTG-News-Scraper/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

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
    };
  });

  // Filter out empty titles
  return stories.filter((s) => s.title.length > 0);
}

// ---------------------------------------------------------------------------
// 2. scrapeAllSources — orchestrator: scrape, dedup, save
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
    sources: sourceResults,
    errors: globalErrors,
  };
}
