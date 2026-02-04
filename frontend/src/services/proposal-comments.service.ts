import api from './api';
import type { ProposalComment, CommentType, CommentCounts } from '../types';

// ---------------------------------------------------------------------------
// Comments API
// ---------------------------------------------------------------------------

export interface ListCommentsParams {
  unresolvedOnly?: boolean;
}

export async function getComments(
  proposalId: string,
  params?: ListCommentsParams
): Promise<ProposalComment[]> {
  const { data } = await api.get<ProposalComment[]>(
    `/topics/proposals/${proposalId}/comments`,
    { params }
  );
  return data;
}

export interface CreateCommentInput {
  content: string;
  parentCommentId?: string;
  commentType?: CommentType;
}

export async function createComment(
  proposalId: string,
  input: CreateCommentInput
): Promise<ProposalComment> {
  const { data } = await api.post<ProposalComment>(
    `/topics/proposals/${proposalId}/comments`,
    input
  );
  return data;
}

export interface UpdateCommentInput {
  content?: string;
  commentType?: CommentType;
}

export async function updateComment(
  proposalId: string,
  commentId: string,
  input: UpdateCommentInput
): Promise<ProposalComment> {
  const { data } = await api.patch<ProposalComment>(
    `/topics/proposals/${proposalId}/comments/${commentId}`,
    input
  );
  return data;
}

export async function deleteComment(proposalId: string, commentId: string): Promise<void> {
  await api.delete(`/topics/proposals/${proposalId}/comments/${commentId}`);
}

export async function resolveComment(
  proposalId: string,
  commentId: string
): Promise<ProposalComment> {
  const { data } = await api.post<ProposalComment>(
    `/topics/proposals/${proposalId}/comments/${commentId}/resolve`
  );
  return data;
}

export async function unresolveComment(
  proposalId: string,
  commentId: string
): Promise<ProposalComment> {
  const { data } = await api.post<ProposalComment>(
    `/topics/proposals/${proposalId}/comments/${commentId}/unresolve`
  );
  return data;
}

export async function getCommentCounts(proposalId: string): Promise<CommentCounts> {
  const { data } = await api.get<CommentCounts>(
    `/topics/proposals/${proposalId}/comments/count`
  );
  return data;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getCommentTypeLabel(type: CommentType): string {
  const labels: Record<CommentType, string> = {
    internal: 'Internal',
    client_feedback: 'Client Feedback',
    revision_request: 'Revision Request',
  };
  return labels[type];
}

export function getCommentTypeColor(type: CommentType): string {
  const colors: Record<CommentType, string> = {
    internal: 'gray',
    client_feedback: 'blue',
    revision_request: 'orange',
  };
  return colors[type];
}

export function formatCommentDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
