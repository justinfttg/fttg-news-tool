import { supabase } from '../client';
import type { NewsStory } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarkedStory {
  id: string;
  userId: string;
  projectId: string;
  newsStoryId: string;
  markedAt: string;
  story?: NewsStory;
}

export interface MarkedStoriesQuery {
  projectId: string;
  userId: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// 1. markStory — add a story to user's marked list
// ---------------------------------------------------------------------------

export async function markStory(
  userId: string,
  projectId: string,
  newsStoryId: string
): Promise<MarkedStory | null> {
  const { data, error } = await supabase
    .from('marked_stories')
    .insert({
      user_id: userId,
      project_id: projectId,
      news_story_id: newsStoryId,
    })
    .select('id, user_id, project_id, news_story_id, marked_at')
    .single();

  if (error) {
    // Handle duplicate - story already marked
    if (error.code === '23505') {
      // Return existing marked story
      const { data: existing } = await supabase
        .from('marked_stories')
        .select('id, user_id, project_id, news_story_id, marked_at')
        .eq('user_id', userId)
        .eq('news_story_id', newsStoryId)
        .single();

      if (existing) {
        return {
          id: existing.id,
          userId: existing.user_id,
          projectId: existing.project_id,
          newsStoryId: existing.news_story_id,
          markedAt: existing.marked_at,
        };
      }
    }
    console.error('Failed to mark story:', error.message);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    newsStoryId: data.news_story_id,
    markedAt: data.marked_at,
  };
}

// ---------------------------------------------------------------------------
// 2. unmarkStory — remove a story from user's marked list
// ---------------------------------------------------------------------------

export async function unmarkStory(
  userId: string,
  newsStoryId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('marked_stories')
    .delete()
    .eq('user_id', userId)
    .eq('news_story_id', newsStoryId);

  if (error) {
    console.error('Failed to unmark story:', error.message);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// 3. isStoryMarked — check if a story is marked by user
// ---------------------------------------------------------------------------

export async function isStoryMarked(
  userId: string,
  newsStoryId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('marked_stories')
    .select('id')
    .eq('user_id', userId)
    .eq('news_story_id', newsStoryId)
    .single();

  if (error) return false;
  return !!data;
}

// ---------------------------------------------------------------------------
// 4. getMarkedStoryIds — get all marked story IDs for a user (for bulk check)
// ---------------------------------------------------------------------------

export async function getMarkedStoryIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('marked_stories')
    .select('news_story_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get marked story IDs:', error.message);
    return new Set();
  }

  return new Set((data || []).map((d: any) => d.news_story_id));
}

// ---------------------------------------------------------------------------
// 5. getMarkedStories — get paginated list of marked stories with full details
// ---------------------------------------------------------------------------

export async function getMarkedStories(
  query: MarkedStoriesQuery
): Promise<{ stories: NewsStory[]; total: number }> {
  const { projectId, userId, page, limit } = query;
  const offset = (page - 1) * limit;

  // First, get marked story records with count
  const { data: markedData, error: markedError, count } = await supabase
    .from('marked_stories')
    .select('news_story_id, marked_at', { count: 'exact' })
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('marked_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (markedError) {
    throw new Error(markedError.message);
  }

  if (!markedData || markedData.length === 0) {
    return { stories: [], total: 0 };
  }

  // Get the story IDs in order
  const storyIds = markedData.map((m: any) => m.news_story_id);

  // Fetch the actual stories
  const { data: storiesData, error: storiesError } = await supabase
    .from('news_stories')
    .select('id, title, summary, content, source, url, region, category, is_trending, social_platforms, trend_score, published_at, scraped_at, thumbnail_url')
    .in('id', storyIds);

  if (storiesError) {
    throw new Error(storiesError.message);
  }

  // Create a map for quick lookup
  const storyMap = new Map<string, NewsStory>();
  for (const story of storiesData || []) {
    storyMap.set(story.id, story as NewsStory);
  }

  // Return stories in marked_at order
  const orderedStories: NewsStory[] = [];
  for (const marked of markedData) {
    const story = storyMap.get(marked.news_story_id);
    if (story) {
      orderedStories.push(story);
    }
  }

  return {
    stories: orderedStories,
    total: count || 0,
  };
}

// ---------------------------------------------------------------------------
// 6. getMarkedCount — get count of marked stories for a user/project
// ---------------------------------------------------------------------------

export async function getMarkedCount(
  userId: string,
  projectId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('marked_stories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('project_id', projectId);

  if (error) {
    console.error('Failed to get marked count:', error.message);
    return 0;
  }

  return count || 0;
}
