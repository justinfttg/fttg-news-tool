import { supabase } from '../client';

// ============================================================================
// Types
// ============================================================================

export type ContentType = 'video_script' | 'article';
export type ContentStatus = 'draft' | 'in_review' | 'needs_revision' | 'approved' | 'locked';
export type FeedbackType = 'comment' | 'revision_request' | 'approval';

export interface EpisodeContent {
  id: string;
  episode_id: string;
  content_type: ContentType;
  current_version: number;
  status: ContentStatus;
  approved_at: string | null;
  approved_by_user_id: string | null;
  locked_at: string | null;
  locked_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  title: string | null;
  body: string;
  word_count: number | null;
  change_summary: string | null;
  created_at: string;
  created_by_user_id: string | null;
  // Joined
  created_by?: { id: string; email: string; full_name: string };
}

export interface ContentFeedback {
  id: string;
  content_id: string;
  version_id: string;
  comment: string;
  feedback_type: FeedbackType;
  highlight_start: number | null;
  highlight_end: number | null;
  highlighted_text: string | null;
  parent_feedback_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  author_user_id: string;
  is_client_feedback: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  author?: { id: string; email: string; full_name: string };
  replies?: ContentFeedback[];
}

// ============================================================================
// Episode Content CRUD
// ============================================================================

const CONTENT_COLUMNS = 'id, episode_id, content_type, current_version, status, approved_at, approved_by_user_id, locked_at, locked_by_user_id, created_at, updated_at, created_by_user_id';

export async function getEpisodeContent(
  episodeId: string,
  contentType: ContentType
): Promise<EpisodeContent | null> {
  const { data, error } = await supabase
    .from('episode_content')
    .select(CONTENT_COLUMNS)
    .eq('episode_id', episodeId)
    .eq('content_type', contentType)
    .single();

  if (error) return null;
  return data as EpisodeContent;
}

export async function getEpisodeContentById(id: string): Promise<EpisodeContent | null> {
  const { data, error } = await supabase
    .from('episode_content')
    .select(CONTENT_COLUMNS)
    .eq('id', id)
    .single();

  if (error) return null;
  return data as EpisodeContent;
}

export async function createEpisodeContent(input: {
  episodeId: string;
  contentType: ContentType;
  createdByUserId: string;
}): Promise<EpisodeContent> {
  const { data, error } = await supabase
    .from('episode_content')
    .insert({
      episode_id: input.episodeId,
      content_type: input.contentType,
      current_version: 0,
      status: 'draft',
      created_by_user_id: input.createdByUserId,
    })
    .select(CONTENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create episode content');
  }

  return data as EpisodeContent;
}

export async function updateEpisodeContent(
  id: string,
  input: {
    status?: ContentStatus;
    currentVersion?: number;
    approvedAt?: string | null;
    approvedByUserId?: string | null;
    lockedAt?: string | null;
    lockedByUserId?: string | null;
  }
): Promise<EpisodeContent> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.status !== undefined) payload.status = input.status;
  if (input.currentVersion !== undefined) payload.current_version = input.currentVersion;
  if (input.approvedAt !== undefined) payload.approved_at = input.approvedAt;
  if (input.approvedByUserId !== undefined) payload.approved_by_user_id = input.approvedByUserId;
  if (input.lockedAt !== undefined) payload.locked_at = input.lockedAt;
  if (input.lockedByUserId !== undefined) payload.locked_by_user_id = input.lockedByUserId;

  const { data, error } = await supabase
    .from('episode_content')
    .update(payload)
    .eq('id', id)
    .select(CONTENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update episode content');
  }

  return data as EpisodeContent;
}

// ============================================================================
// Content Versions CRUD
// ============================================================================

const VERSION_COLUMNS = 'id, content_id, version_number, title, body, word_count, change_summary, created_at, created_by_user_id';

// Helper to normalize Supabase join results (arrays to single objects)
function normalizeVersion(row: Record<string, unknown>): ContentVersion {
  const created_by = row.created_by as Array<{ id: string; email: string; full_name: string }> | null;
  return {
    ...row,
    created_by: created_by?.[0] || undefined,
  } as ContentVersion;
}

function normalizeFeedback(row: Record<string, unknown>): ContentFeedback {
  const author = row.author as Array<{ id: string; email: string; full_name: string }> | null;
  return {
    ...row,
    author: author?.[0] || undefined,
    replies: (row.replies as ContentFeedback[]) || [],
  } as ContentFeedback;
}

export async function getContentVersions(contentId: string): Promise<ContentVersion[]> {
  const { data, error } = await supabase
    .from('episode_content_versions')
    .select(`${VERSION_COLUMNS}, created_by:users!created_by_user_id(id, email, full_name)`)
    .eq('content_id', contentId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(normalizeVersion);
}

export async function getContentVersion(
  contentId: string,
  versionNumber: number
): Promise<ContentVersion | null> {
  const { data, error } = await supabase
    .from('episode_content_versions')
    .select(`${VERSION_COLUMNS}, created_by:users!created_by_user_id(id, email, full_name)`)
    .eq('content_id', contentId)
    .eq('version_number', versionNumber)
    .single();

  if (error) return null;
  return normalizeVersion(data);
}

export async function getLatestContentVersion(contentId: string): Promise<ContentVersion | null> {
  const { data, error } = await supabase
    .from('episode_content_versions')
    .select(`${VERSION_COLUMNS}, created_by:users!created_by_user_id(id, email, full_name)`)
    .eq('content_id', contentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return normalizeVersion(data);
}

export async function createContentVersion(input: {
  contentId: string;
  versionNumber: number;
  title?: string;
  body: string;
  changeSummary?: string;
  createdByUserId: string;
}): Promise<ContentVersion> {
  const wordCount = input.body.trim().split(/\s+/).filter(Boolean).length;

  const { data, error } = await supabase
    .from('episode_content_versions')
    .insert({
      content_id: input.contentId,
      version_number: input.versionNumber,
      title: input.title || null,
      body: input.body,
      word_count: wordCount,
      change_summary: input.changeSummary || null,
      created_by_user_id: input.createdByUserId,
    })
    .select(`${VERSION_COLUMNS}, created_by:users!created_by_user_id(id, email, full_name)`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create content version');
  }

  return normalizeVersion(data);
}

// ============================================================================
// Content Feedback CRUD
// ============================================================================

const FEEDBACK_COLUMNS = 'id, content_id, version_id, comment, feedback_type, highlight_start, highlight_end, highlighted_text, parent_feedback_id, is_resolved, resolved_at, resolved_by_user_id, author_user_id, is_client_feedback, created_at, updated_at';

export async function getContentFeedback(
  contentId: string,
  versionId?: string
): Promise<ContentFeedback[]> {
  let query = supabase
    .from('episode_content_feedback')
    .select(`${FEEDBACK_COLUMNS}, author:users!author_user_id(id, email, full_name)`)
    .eq('content_id', contentId)
    .is('parent_feedback_id', null)
    .order('created_at', { ascending: true });

  if (versionId) {
    query = query.eq('version_id', versionId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Fetch replies for each comment
  const feedbackWithReplies = await Promise.all(
    (data || []).map(async (feedback) => {
      const { data: replies } = await supabase
        .from('episode_content_feedback')
        .select(`${FEEDBACK_COLUMNS}, author:users!author_user_id(id, email, full_name)`)
        .eq('parent_feedback_id', feedback.id)
        .order('created_at', { ascending: true });

      const normalizedFeedback = normalizeFeedback(feedback);
      normalizedFeedback.replies = (replies || []).map(normalizeFeedback);
      return normalizedFeedback;
    })
  );

  return feedbackWithReplies;
}

export async function getUnresolvedFeedbackCount(contentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('episode_content_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('content_id', contentId)
    .eq('is_resolved', false)
    .eq('feedback_type', 'revision_request');

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export async function createContentFeedback(input: {
  contentId: string;
  versionId: string;
  comment: string;
  feedbackType: FeedbackType;
  highlightStart?: number;
  highlightEnd?: number;
  highlightedText?: string;
  parentFeedbackId?: string;
  authorUserId: string;
  isClientFeedback?: boolean;
}): Promise<ContentFeedback> {
  const { data, error } = await supabase
    .from('episode_content_feedback')
    .insert({
      content_id: input.contentId,
      version_id: input.versionId,
      comment: input.comment,
      feedback_type: input.feedbackType,
      highlight_start: input.highlightStart ?? null,
      highlight_end: input.highlightEnd ?? null,
      highlighted_text: input.highlightedText ?? null,
      parent_feedback_id: input.parentFeedbackId ?? null,
      author_user_id: input.authorUserId,
      is_client_feedback: input.isClientFeedback ?? false,
    })
    .select(`${FEEDBACK_COLUMNS}, author:users!author_user_id(id, email, full_name)`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create feedback');
  }

  return normalizeFeedback(data);
}

export async function updateContentFeedback(
  id: string,
  input: {
    comment?: string;
    isResolved?: boolean;
    resolvedAt?: string | null;
    resolvedByUserId?: string | null;
  }
): Promise<ContentFeedback> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.comment !== undefined) payload.comment = input.comment;
  if (input.isResolved !== undefined) payload.is_resolved = input.isResolved;
  if (input.resolvedAt !== undefined) payload.resolved_at = input.resolvedAt;
  if (input.resolvedByUserId !== undefined) payload.resolved_by_user_id = input.resolvedByUserId;

  const { data, error } = await supabase
    .from('episode_content_feedback')
    .update(payload)
    .eq('id', id)
    .select(`${FEEDBACK_COLUMNS}, author:users!author_user_id(id, email, full_name)`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update feedback');
  }

  return normalizeFeedback(data);
}

export async function deleteContentFeedback(id: string): Promise<void> {
  const { error } = await supabase
    .from('episode_content_feedback')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================================
// Composite Operations
// ============================================================================

/**
 * Get content with latest version and feedback counts
 */
export async function getContentWithDetails(
  episodeId: string,
  contentType: ContentType
): Promise<{
  content: EpisodeContent;
  latestVersion: ContentVersion | null;
  versions: ContentVersion[];
  unresolvedFeedbackCount: number;
} | null> {
  const content = await getEpisodeContent(episodeId, contentType);
  if (!content) return null;

  const [latestVersion, versions, unresolvedFeedbackCount] = await Promise.all([
    getLatestContentVersion(content.id),
    getContentVersions(content.id),
    getUnresolvedFeedbackCount(content.id),
  ]);

  return {
    content,
    latestVersion,
    versions,
    unresolvedFeedbackCount,
  };
}

/**
 * Create or get content, then save a new version
 */
export async function saveContentVersion(input: {
  episodeId: string;
  contentType: ContentType;
  title?: string;
  body: string;
  changeSummary?: string;
  userId: string;
}): Promise<{ content: EpisodeContent; version: ContentVersion }> {
  // Get or create content
  let content = await getEpisodeContent(input.episodeId, input.contentType);

  if (!content) {
    content = await createEpisodeContent({
      episodeId: input.episodeId,
      contentType: input.contentType,
      createdByUserId: input.userId,
    });
  }

  // Content is locked, cannot save
  if (content.status === 'locked') {
    throw new Error('Content is locked and cannot be edited');
  }

  // Create new version
  const newVersionNumber = content.current_version + 1;
  const version = await createContentVersion({
    contentId: content.id,
    versionNumber: newVersionNumber,
    title: input.title,
    body: input.body,
    changeSummary: input.changeSummary,
    createdByUserId: input.userId,
  });

  // Update content with new version number
  const updatedContent = await updateEpisodeContent(content.id, {
    currentVersion: newVersionNumber,
    status: 'draft',
  });

  return { content: updatedContent, version };
}

/**
 * Submit content for review
 */
export async function submitForReview(contentId: string): Promise<EpisodeContent> {
  return updateEpisodeContent(contentId, { status: 'in_review' });
}

/**
 * Request revisions (mark as needs_revision)
 */
export async function requestRevisions(contentId: string): Promise<EpisodeContent> {
  return updateEpisodeContent(contentId, { status: 'needs_revision' });
}

/**
 * Approve content
 */
export async function approveContent(
  contentId: string,
  userId: string
): Promise<EpisodeContent> {
  return updateEpisodeContent(contentId, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedByUserId: userId,
  });
}

/**
 * Lock content (no further edits allowed)
 */
export async function lockContent(
  contentId: string,
  userId: string
): Promise<EpisodeContent> {
  return updateEpisodeContent(contentId, {
    status: 'locked',
    lockedAt: new Date().toISOString(),
    lockedByUserId: userId,
  });
}

/**
 * Resolve feedback
 */
export async function resolveFeedback(
  feedbackId: string,
  userId: string
): Promise<ContentFeedback> {
  return updateContentFeedback(feedbackId, {
    isResolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedByUserId: userId,
  });
}
