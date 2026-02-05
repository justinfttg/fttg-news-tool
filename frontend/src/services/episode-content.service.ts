import api from './api';

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
  author?: { id: string; email: string; full_name: string };
  replies?: ContentFeedback[];
}

export interface ContentWithDetails {
  content: EpisodeContent | null;
  latestVersion: ContentVersion | null;
  versions: ContentVersion[];
  unresolvedFeedbackCount: number;
}

// ============================================================================
// API Functions
// ============================================================================

export async function getEpisodeContent(
  episodeId: string,
  contentType: ContentType
): Promise<ContentWithDetails> {
  const { data } = await api.get<ContentWithDetails>(
    `/episodes/${episodeId}/content/${contentType}`
  );
  return data;
}

export async function saveContentVersion(
  episodeId: string,
  contentType: ContentType,
  input: {
    title?: string;
    body: string;
    changeSummary?: string;
  }
): Promise<{ content: EpisodeContent; version: ContentVersion }> {
  const { data } = await api.post<{ content: EpisodeContent; version: ContentVersion }>(
    `/episodes/${episodeId}/content/${contentType}/save`,
    input
  );
  return data;
}

export async function submitContentForReview(
  episodeId: string,
  contentType: ContentType
): Promise<{ content: EpisodeContent }> {
  const { data } = await api.post<{ content: EpisodeContent }>(
    `/episodes/${episodeId}/content/${contentType}/submit`
  );
  return data;
}

export async function approveContent(
  episodeId: string,
  contentType: ContentType
): Promise<{ content: EpisodeContent }> {
  const { data } = await api.post<{ content: EpisodeContent }>(
    `/episodes/${episodeId}/content/${contentType}/approve`
  );
  return data;
}

export async function lockContent(
  episodeId: string,
  contentType: ContentType
): Promise<{ content: EpisodeContent }> {
  const { data } = await api.post<{ content: EpisodeContent }>(
    `/episodes/${episodeId}/content/${contentType}/lock`
  );
  return data;
}

export async function getContentFeedback(
  episodeId: string,
  contentType: ContentType,
  versionId?: string
): Promise<{ feedback: ContentFeedback[] }> {
  const params = versionId ? `?versionId=${versionId}` : '';
  const { data } = await api.get<{ feedback: ContentFeedback[] }>(
    `/episodes/${episodeId}/content/${contentType}/feedback${params}`
  );
  return data;
}

export async function addContentFeedback(
  episodeId: string,
  contentType: ContentType,
  input: {
    versionId: string;
    comment: string;
    feedbackType?: FeedbackType;
    highlightStart?: number;
    highlightEnd?: number;
    highlightedText?: string;
    parentFeedbackId?: string;
    isClientFeedback?: boolean;
  }
): Promise<{ feedback: ContentFeedback }> {
  const { data } = await api.post<{ feedback: ContentFeedback }>(
    `/episodes/${episodeId}/content/${contentType}/feedback`,
    input
  );
  return data;
}

export async function resolveFeedback(
  episodeId: string,
  contentType: ContentType,
  feedbackId: string
): Promise<{ feedback: ContentFeedback }> {
  const { data } = await api.post<{ feedback: ContentFeedback }>(
    `/episodes/${episodeId}/content/${contentType}/feedback/${feedbackId}/resolve`
  );
  return data;
}

// ============================================================================
// Helpers
// ============================================================================

export function getStatusLabel(status: ContentStatus): string {
  const labels: Record<ContentStatus, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    needs_revision: 'Needs Revision',
    approved: 'Approved',
    locked: 'Locked',
  };
  return labels[status];
}

export function getStatusColor(status: ContentStatus): string {
  const colors: Record<ContentStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    needs_revision: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    locked: 'bg-blue-100 text-blue-700',
  };
  return colors[status];
}

export function getContentTypeLabel(type: ContentType): string {
  return type === 'video_script' ? 'Video Script' : 'Article';
}
