import { supabase } from '../client';
import type { NewsStory } from '../../types';

// ---------------------------------------------------------------------------
// Column selection
// ---------------------------------------------------------------------------

const STORY_COLUMNS = 'id, title, summary, content, source, url, region, category, is_trending, social_platforms, trend_score, published_at, scraped_at, thumbnail_url';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface InsertNewsStory {
  title: string;
  summary: string | null;
  content: string;
  source: string;
  url: string | null;
  region: NewsStory['region'];
  category: string;
  published_at: string | null;
  thumbnail_url?: string | null;
}

export interface NewsFeedQuery {
  regions?: string[];  // Support multiple regions
  region?: string;     // Keep for backwards compatibility
  category?: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// 1. upsertStories — bulk insert, skip duplicates by URL
// ---------------------------------------------------------------------------

export async function upsertStories(stories: InsertNewsStory[]): Promise<{ inserted: number; skipped: number }> {
  if (stories.length === 0) return { inserted: 0, skipped: 0 };

  // Separate stories with and without URLs
  const storiesWithUrls = stories.filter((s) => s.url);
  const storiesWithoutUrls = stories.filter((s) => !s.url);

  // Check for existing URLs in batches (Supabase has query limits)
  let existingUrls = new Set<string>();
  const urls = storiesWithUrls.map((s) => s.url!);

  if (urls.length > 0) {
    // Batch URL checks in groups of 100 to avoid query limits
    for (let i = 0; i < urls.length; i += 100) {
      const batch = urls.slice(i, i + 100);
      const { data: existing } = await supabase
        .from('news_stories')
        .select('url')
        .in('url', batch);

      (existing || []).forEach((e: any) => existingUrls.add(e.url));
    }
  }

  // Check for existing titles (for stories without URLs, to prevent duplicates)
  let existingTitles = new Set<string>();
  if (storiesWithoutUrls.length > 0) {
    const titles = storiesWithoutUrls.map((s) => s.title);
    for (let i = 0; i < titles.length; i += 100) {
      const batch = titles.slice(i, i + 100);
      const { data: existing } = await supabase
        .from('news_stories')
        .select('title')
        .in('title', batch);

      (existing || []).forEach((e: any) => existingTitles.add(e.title));
    }
  }

  // Filter out duplicates:
  // - Stories with URLs: skip if URL exists
  // - Stories without URLs: skip if title exists
  const newStories = stories.filter((s) => {
    if (s.url) {
      return !existingUrls.has(s.url);
    } else {
      return !existingTitles.has(s.title);
    }
  });

  const skipped = stories.length - newStories.length;

  if (newStories.length === 0) {
    return { inserted: 0, skipped };
  }

  const rows = newStories.map((s) => ({
    title: s.title,
    summary: s.summary,
    content: s.content,
    source: s.source,
    url: s.url,
    region: s.region,
    category: s.category,
    is_trending: false,
    social_platforms: [],
    trend_score: 0,
    published_at: s.published_at,
    thumbnail_url: s.thumbnail_url || null,
  }));

  const { data, error } = await supabase
    .from('news_stories')
    .insert(rows)
    .select('id');

  if (error) {
    throw new Error(`Failed to insert stories: ${error.message}`);
  }

  return { inserted: data?.length || 0, skipped };
}

// ---------------------------------------------------------------------------
// 2. getNewsFeed — paginated, filtered list
// ---------------------------------------------------------------------------

export async function getNewsFeed(query: NewsFeedQuery): Promise<{ stories: NewsStory[]; total: number }> {
  const { regions, region, category, page, limit } = query;
  const offset = (page - 1) * limit;

  // Build the query
  let q = supabase
    .from('news_stories')
    .select(STORY_COLUMNS, { count: 'exact' });

  // Use regions array if provided, otherwise fall back to single region
  const regionFilter = regions || (region ? [region] : undefined);
  if (regionFilter && regionFilter.length > 0) {
    q = q.in('region', regionFilter);
  }
  if (category) {
    q = q.eq('category', category);
  }

  q = q
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await q;

  if (error) {
    throw new Error(error.message);
  }

  return {
    stories: (data || []) as NewsStory[],
    total: count || 0,
  };
}

// ---------------------------------------------------------------------------
// 3. getStoryById
// ---------------------------------------------------------------------------

export async function getStoryById(id: string): Promise<NewsStory | null> {
  const { data, error } = await supabase
    .from('news_stories')
    .select(STORY_COLUMNS)
    .eq('id', id)
    .single();

  if (error) return null;
  return data as NewsStory;
}

// ---------------------------------------------------------------------------
// 4. getRecentStoryUrls — for dedup check during scraping
// ---------------------------------------------------------------------------

export async function getRecentStoryUrls(hoursBack: number = 48): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('news_stories')
    .select('url')
    .gte('scraped_at', cutoff)
    .not('url', 'is', null);

  return new Set((data || []).map((d: any) => d.url));
}

// ---------------------------------------------------------------------------
// 5. getTrendingStories — stories flagged as trending
// ---------------------------------------------------------------------------

export async function getTrendingStories(limit: number = 20): Promise<NewsStory[]> {
  const { data, error } = await supabase
    .from('news_stories')
    .select(STORY_COLUMNS)
    .eq('is_trending', true)
    .order('trend_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as NewsStory[];
}

// ---------------------------------------------------------------------------
// 6. markTrending — set is_trending + trend_score + social_platforms
// ---------------------------------------------------------------------------

export async function markTrending(
  storyId: string,
  trendScore: number,
  platforms: string[]
): Promise<void> {
  const { error } = await supabase
    .from('news_stories')
    .update({
      is_trending: true,
      trend_score: trendScore,
      social_platforms: platforms,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', storyId);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// 7. expireTrending — clear trending flag on stories older than N hours
// ---------------------------------------------------------------------------

export async function expireTrending(hoursOld: number = 24): Promise<number> {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('news_stories')
    .update({
      is_trending: false,
      trend_score: 0,
      social_platforms: [],
    } as any)
    .eq('is_trending', true)
    .lt('scraped_at', cutoff)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  return data?.length || 0;
}

// ---------------------------------------------------------------------------
// 8. upsertTrendingStory — insert a trending topic as a news story (if new)
// ---------------------------------------------------------------------------

export interface InsertTrendingStory {
  title: string;
  url: string | null;
  region: NewsStory['region'];
  category: string;
  trendScore: number;
  platforms: string[];
}

// ---------------------------------------------------------------------------
// 8.5. updateStorySummary — update summary + category for AI processing
// ---------------------------------------------------------------------------

export async function updateStorySummary(
  url: string,
  summary: string,
  category: string
): Promise<boolean> {
  const { error } = await supabase
    .from('news_stories')
    .update({ summary, category })
    .eq('url', url);

  return !error;
}

// ---------------------------------------------------------------------------
// 8.6. getStoriesNeedingSummary — fetch stories without AI summaries
// ---------------------------------------------------------------------------

export async function getStoriesNeedingSummary(limit: number = 50): Promise<Array<{
  url: string;
  title: string;
  content: string;
  category: string;
}>> {
  const { data, error } = await supabase
    .from('news_stories')
    .select('url, title, content, category')
    .is('summary', null)
    .not('url', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Array<{
    url: string;
    title: string;
    content: string;
    category: string;
  }>;
}

// ---------------------------------------------------------------------------
// 9. deduplicateStories — remove duplicate stories, keeping oldest per URL
// ---------------------------------------------------------------------------

async function fetchAllStories(columns: string): Promise<any[]> {
  const allData: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('news_stories')
      .select(columns)
      .not('url', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);

    allData.push(...(data || []));
    hasMore = (data?.length || 0) === pageSize;
    offset += pageSize;
  }

  return allData;
}

export async function deduplicateStories(): Promise<{ deleted: number; remaining: number }> {
  console.log('[cleanup] Fetching all stories for deduplication...');
  const allStories = await fetchAllStories('id, url, scraped_at');
  console.log(`[cleanup] Found ${allStories.length} total stories`);

  // Group by URL and find duplicates to delete
  const urlToStories = new Map<string, Array<{ id: string; scraped_at: string }>>();
  for (const story of allStories) {
    if (!story.url) continue;
    const existing = urlToStories.get(story.url) || [];
    existing.push({ id: story.id, scraped_at: story.scraped_at });
    urlToStories.set(story.url, existing);
  }

  // Sort each group by scraped_at and collect IDs to delete (keep oldest)
  const idsToDelete: string[] = [];
  for (const stories of urlToStories.values()) {
    if (stories.length > 1) {
      // Sort by scraped_at ascending (oldest first)
      stories.sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime());
      // Keep the first one (oldest), delete the rest
      for (let i = 1; i < stories.length; i++) {
        idsToDelete.push(stories[i].id);
      }
    }
  }

  console.log(`[cleanup] Found ${idsToDelete.length} duplicates to delete`);

  if (idsToDelete.length === 0) {
    return { deleted: 0, remaining: allStories.length };
  }

  // Delete in batches of 100
  let totalDeleted = 0;
  for (let i = 0; i < idsToDelete.length; i += 100) {
    const batch = idsToDelete.slice(i, i + 100);
    const { error: deleteError } = await supabase
      .from('news_stories')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error(`Failed to delete batch: ${deleteError.message}`);
    } else {
      totalDeleted += batch.length;
    }
  }

  return {
    deleted: totalDeleted,
    remaining: allStories.length - totalDeleted,
  };
}

// ---------------------------------------------------------------------------
// 10. deleteLowQualityStories — remove stories that don't meet quality thresholds
// ---------------------------------------------------------------------------

export async function deleteLowQualityStories(): Promise<{ deleted: number }> {
  console.log('[cleanup] Fetching all stories for quality check...');
  const allStories = await fetchAllStories('id, title, content');
  console.log(`[cleanup] Checking quality of ${allStories.length} stories`);

  // Find stories that are low quality
  const idsToDelete: string[] = [];
  for (const story of allStories) {
    const title = story.title || '';
    const content = story.content || '';

    // Low quality criteria:
    // 1. Content equals title (image captions)
    // 2. Content is too short (< 100 chars)
    // 3. Title is too short (< 15 chars)
    if (
      content === title ||
      content.length < 100 ||
      title.length < 15
    ) {
      idsToDelete.push(story.id);
    }
  }

  console.log(`[cleanup] Found ${idsToDelete.length} low-quality stories to delete`);

  if (idsToDelete.length === 0) {
    return { deleted: 0 };
  }

  // Delete in batches of 100
  let totalDeleted = 0;
  for (let i = 0; i < idsToDelete.length; i += 100) {
    const batch = idsToDelete.slice(i, i + 100);
    const { error: deleteError } = await supabase
      .from('news_stories')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error(`Failed to delete batch: ${deleteError.message}`);
    } else {
      totalDeleted += batch.length;
    }
  }

  return { deleted: totalDeleted };
}

// ---------------------------------------------------------------------------
// 11. upsertTrendingStory — insert a trending topic as a news story (if new)
// ---------------------------------------------------------------------------

export async function upsertTrendingStory(input: InsertTrendingStory): Promise<{ id: string; isNew: boolean }> {
  // Check if story with same URL or title already exists
  if (input.url) {
    const { data: existing } = await supabase
      .from('news_stories')
      .select('id')
      .eq('url', input.url)
      .single();

    if (existing) {
      // Update trending fields on existing story
      await markTrending(existing.id, input.trendScore, input.platforms);
      return { id: existing.id, isNew: false };
    }
  }

  // Insert as new trending story
  const { data, error } = await supabase
    .from('news_stories')
    .insert({
      title: input.title,
      summary: null,
      content: input.title, // Minimal content — title only for trending topics
      source: input.platforms.join(', '),
      url: input.url,
      region: input.region,
      category: input.category,
      is_trending: true,
      social_platforms: input.platforms,
      trend_score: input.trendScore,
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to insert trending story');
  }

  return { id: data.id, isNew: true };
}
