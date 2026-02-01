// Database queries for Social Listener feature

import { supabase } from '../client';
import type { SocialPost } from '../../services/social-listener';

// ============================================================================
// Types
// ============================================================================

export interface DBSocialPost {
  id: string;
  platform: string;
  external_id: string;
  author_handle: string | null;
  author_name: string | null;
  author_followers: number | null;
  content: string;
  post_url: string | null;
  media_urls: string[];
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  engagement_score: number;
  hashtags: string[];
  topics: string[];
  region: string | null;
  category: string | null;
  posted_at: string | null;
  scraped_at: string;
}

export interface DBWatchedTrend {
  id: string;
  user_id: string;
  project_id: string;
  query: string;
  query_type: 'hashtag' | 'keyword' | 'phrase';
  platforms: string[];
  regions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_scraped_at: string | null;
}

export interface DBTrendSnapshot {
  id: string;
  topic_hash: string;
  topic_name: string;
  watched_trend_id: string | null;
  snapshot_at: string;
  total_engagement: number;
  total_posts: number;
  platforms_data: Record<string, unknown>;
}

export interface DBHashtagMetrics {
  id: string;
  hashtag: string;
  hashtag_normalized: string;
  current_posts: number;
  current_engagement: number;
  engagement_1h_ago: number;
  engagement_24h_ago: number;
  posts_24h_ago: number;
  momentum_score: number;
  momentum_direction: 'rising' | 'falling' | 'stable';
  percent_change: number;
  platform_breakdown: Record<string, number>;
  peak_engagement: number;
  peak_at: string | null;
  last_updated_at: string;
}

// ============================================================================
// Social Posts
// ============================================================================

export async function upsertSocialPosts(
  posts: SocialPost[]
): Promise<{ inserted: number; updated: number }> {
  if (posts.length === 0) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  // Upsert in batches
  const batchSize = 50;
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);

    const rows = batch.map((p) => ({
      platform: p.platform,
      external_id: p.externalId,
      author_handle: p.authorHandle,
      author_name: p.authorName,
      author_followers: p.authorFollowers,
      content: p.content,
      post_url: p.postUrl,
      media_urls: p.mediaUrls,
      likes: p.likes,
      reposts: p.reposts,
      comments: p.comments,
      views: p.views,
      hashtags: p.hashtags,
      topics: p.topics,
      region: p.region,
      category: p.category,
      posted_at: p.postedAt?.toISOString() || null,
    }));

    const { data, error } = await supabase
      .from('social_posts')
      .upsert(rows, {
        onConflict: 'platform,external_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      console.error('[social-posts] Upsert error:', error.message);
    } else {
      inserted += data?.length || 0;
    }
  }

  return { inserted, updated };
}

export async function getViralPostsFromDB(options: {
  platforms?: string[];
  region?: string;
  limit?: number;
  minEngagement?: number;
}): Promise<DBSocialPost[]> {
  const { platforms, region, limit = 50, minEngagement = 0 } = options;

  let query = supabase
    .from('social_posts')
    .select('*')
    .gte('engagement_score', minEngagement)
    .order('engagement_score', { ascending: false })
    .limit(limit);

  if (platforms && platforms.length > 0) {
    query = query.in('platform', platforms);
  }

  if (region) {
    query = query.eq('region', region);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[social-posts] Query error:', error.message);
    return [];
  }

  return (data || []) as DBSocialPost[];
}

// ============================================================================
// Watched Trends
// ============================================================================

export async function createWatchedTrend(input: {
  userId: string;
  projectId: string;
  query: string;
  queryType: 'hashtag' | 'keyword' | 'phrase';
  platforms?: string[];
  regions?: string[];
}): Promise<DBWatchedTrend | null> {
  console.log('[watched-trends] Creating watched trend with input:', input);

  const insertData = {
    user_id: input.userId,
    project_id: input.projectId,
    query: input.query,
    query_type: input.queryType,
    platforms: input.platforms || ['reddit', 'google_trends', 'x'],
    regions: input.regions || ['global'],
    is_active: true,
  };

  console.log('[watched-trends] Insert data:', insertData);

  const { data, error } = await supabase
    .from('watched_trends')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[watched-trends] Create error:', error.message, 'Code:', error.code, 'Details:', error.details, 'Hint:', error.hint);
    return null;
  }

  console.log('[watched-trends] Successfully created:', data);
  return data as DBWatchedTrend;
}

export async function getWatchedTrends(
  projectId: string,
  userId?: string
): Promise<DBWatchedTrend[]> {
  let query = supabase
    .from('watched_trends')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[watched-trends] Query error:', error.message);
    return [];
  }

  return (data || []) as DBWatchedTrend[];
}

export async function deleteWatchedTrend(
  trendId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('watched_trends')
    .delete()
    .eq('id', trendId)
    .eq('user_id', userId);

  return !error;
}

export async function getActiveWatchedTrendsForScraping(): Promise<DBWatchedTrend[]> {
  const { data, error } = await supabase
    .from('watched_trends')
    .select('*')
    .eq('is_active', true)
    .or('last_scraped_at.is.null,last_scraped_at.lt.' + new Date(Date.now() - 10 * 60 * 1000).toISOString());

  if (error) {
    console.error('[watched-trends] Active query error:', error.message);
    return [];
  }

  return (data || []) as DBWatchedTrend[];
}

export async function updateWatchedTrendScrapedAt(trendId: string): Promise<void> {
  await supabase
    .from('watched_trends')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', trendId);
}

// ============================================================================
// Trend Snapshots
// ============================================================================

export async function createTrendSnapshot(input: {
  topicHash: string;
  topicName: string;
  watchedTrendId?: string;
  totalEngagement: number;
  totalPosts: number;
  platformsData: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('trend_snapshots').insert({
    topic_hash: input.topicHash,
    topic_name: input.topicName,
    watched_trend_id: input.watchedTrendId || null,
    total_engagement: input.totalEngagement,
    total_posts: input.totalPosts,
    platforms_data: input.platformsData,
  });

  if (error) {
    console.error('[trend-snapshots] Create error:', error.message);
  }
}

export async function getTrendSnapshots(
  topicHash: string,
  hoursBack = 24
): Promise<DBTrendSnapshot[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('trend_snapshots')
    .select('*')
    .eq('topic_hash', topicHash)
    .gte('snapshot_at', cutoff)
    .order('snapshot_at', { ascending: true });

  if (error) {
    console.error('[trend-snapshots] Query error:', error.message);
    return [];
  }

  return (data || []) as DBTrendSnapshot[];
}

// ============================================================================
// Hashtag Metrics
// ============================================================================

export async function upsertHashtagMetrics(
  hashtag: string,
  metrics: {
    currentPosts: number;
    currentEngagement: number;
    platforms: Record<string, number>;
  }
): Promise<void> {
  const normalized = hashtag.toLowerCase().replace(/^#/, '');

  // First, get existing metrics for momentum calculation
  const { data: existing } = await supabase
    .from('hashtag_metrics')
    .select('current_engagement, engagement_1h_ago')
    .eq('hashtag_normalized', normalized)
    .single();

  // Calculate momentum
  let momentumScore = 0;
  let momentumDirection: 'rising' | 'falling' | 'stable' = 'stable';
  let percentChange = 0;

  if (existing) {
    const oldEngagement = existing.engagement_1h_ago || existing.current_engagement || 1;
    percentChange = Math.round(
      ((metrics.currentEngagement - oldEngagement) / oldEngagement) * 100
    );
    momentumScore = Math.min(100, Math.max(-100, percentChange));
    momentumDirection =
      percentChange > 10 ? 'rising' : percentChange < -10 ? 'falling' : 'stable';
  }

  const { error } = await supabase.from('hashtag_metrics').upsert(
    {
      hashtag,
      hashtag_normalized: normalized,
      current_posts: metrics.currentPosts,
      current_engagement: metrics.currentEngagement,
      engagement_1h_ago: existing?.current_engagement || metrics.currentEngagement,
      momentum_score: momentumScore,
      momentum_direction: momentumDirection,
      percent_change: percentChange,
      platform_breakdown: metrics.platforms,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: 'hashtag_normalized' }
  );

  if (error) {
    console.error('[hashtag-metrics] Upsert error:', error.message);
  }
}

export async function getTrendingHashtagsFromDB(options: {
  limit?: number;
  direction?: 'rising' | 'falling' | 'stable';
}): Promise<DBHashtagMetrics[]> {
  const { limit = 20, direction } = options;

  let query = supabase
    .from('hashtag_metrics')
    .select('*')
    .order('current_engagement', { ascending: false })
    .limit(limit);

  if (direction) {
    query = query.eq('momentum_direction', direction);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[hashtag-metrics] Query error:', error.message);
    return [];
  }

  return (data || []) as DBHashtagMetrics[];
}

// ============================================================================
// Cleanup
// ============================================================================

export async function cleanupOldSocialPosts(daysOld = 7): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('social_posts')
    .delete()
    .lt('scraped_at', cutoff)
    .select('id');

  if (error) {
    console.error('[cleanup] Social posts error:', error.message);
    return 0;
  }

  return data?.length || 0;
}

export async function cleanupOldSnapshots(daysOld = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('trend_snapshots')
    .delete()
    .lt('snapshot_at', cutoff)
    .select('id');

  if (error) {
    console.error('[cleanup] Snapshots error:', error.message);
    return 0;
  }

  return data?.length || 0;
}
