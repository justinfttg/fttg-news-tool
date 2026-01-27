import { supabase } from '../client';
import type { NewsStory } from '../../types';

// ---------------------------------------------------------------------------
// Column selection
// ---------------------------------------------------------------------------

const STORY_COLUMNS = 'id, title, summary, content, source, url, region, category, is_trending, social_platforms, trend_score, published_at, scraped_at';

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
}

export interface NewsFeedQuery {
  region?: string;
  category?: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// 1. upsertStories — bulk insert, skip duplicates by URL
// ---------------------------------------------------------------------------

export async function upsertStories(stories: InsertNewsStory[]): Promise<{ inserted: number; skipped: number }> {
  if (stories.length === 0) return { inserted: 0, skipped: 0 };

  // Filter out stories with URLs that already exist
  const urls = stories.filter((s) => s.url).map((s) => s.url!);

  let existingUrls = new Set<string>();
  if (urls.length > 0) {
    const { data: existing } = await supabase
      .from('news_stories')
      .select('url')
      .in('url', urls);

    existingUrls = new Set((existing || []).map((e: any) => e.url));
  }

  const newStories = stories.filter((s) => !s.url || !existingUrls.has(s.url));
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
  const { region, category, page, limit } = query;
  const offset = (page - 1) * limit;

  // Build the query
  let q = supabase
    .from('news_stories')
    .select(STORY_COLUMNS, { count: 'exact' });

  if (region) {
    q = q.eq('region', region);
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
