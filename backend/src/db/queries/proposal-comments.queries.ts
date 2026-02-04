import { supabase } from '../client';
import type { ProposalComment, User } from '../../types';

// ---------------------------------------------------------------------------
// Column selection (single source of truth)
// ---------------------------------------------------------------------------

const COMMENT_COLUMNS = `
  id, topic_proposal_id, content, parent_comment_id, author_user_id,
  comment_type, is_resolved, resolved_at, resolved_by_user_id,
  created_at, updated_at
`;

const USER_COLUMNS = 'id, email, full_name';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCommentInput {
  topicProposalId: string;
  content: string;
  parentCommentId?: string;
  authorUserId: string;
  commentType?: 'internal' | 'client_feedback' | 'revision_request';
}

export interface UpdateCommentInput {
  content?: string;
  commentType?: 'internal' | 'client_feedback' | 'revision_request';
}

// ---------------------------------------------------------------------------
// Comment Queries
// ---------------------------------------------------------------------------

/**
 * Get all comments for a proposal (threaded)
 */
export async function getCommentsByProposalId(
  proposalId: string,
  options?: {
    includeAuthor?: boolean;
    unresolvedOnly?: boolean;
  }
): Promise<ProposalComment[]> {
  let query = supabase
    .from('proposal_comments')
    .select(options?.includeAuthor
      ? `${COMMENT_COLUMNS}, author:users!author_user_id(${USER_COLUMNS})`
      : COMMENT_COLUMNS
    )
    .eq('topic_proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (options?.unresolvedOnly) {
    query = query.eq('is_resolved', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Transform and build threaded structure
  const comments = (data || []).map(transformComment) as (ProposalComment & { author?: User })[];
  return buildCommentTree(comments);
}

/**
 * Get a single comment by ID
 */
export async function getCommentById(
  id: string,
  includeAuthor = true
): Promise<ProposalComment | null> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .select(includeAuthor
      ? `${COMMENT_COLUMNS}, author:users!author_user_id(${USER_COLUMNS})`
      : COMMENT_COLUMNS
    )
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return transformComment(data) as ProposalComment;
}

/**
 * Create a comment
 */
export async function createComment(input: CreateCommentInput): Promise<ProposalComment> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .insert({
      topic_proposal_id: input.topicProposalId,
      content: input.content,
      parent_comment_id: input.parentCommentId || null,
      author_user_id: input.authorUserId,
      comment_type: input.commentType || 'internal',
      is_resolved: false,
    })
    .select(`${COMMENT_COLUMNS}, author:users!author_user_id(${USER_COLUMNS})`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create comment');
  }

  return transformComment(data) as ProposalComment;
}

/**
 * Update a comment
 */
export async function updateComment(
  id: string,
  input: UpdateCommentInput
): Promise<ProposalComment> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.content !== undefined) payload.content = input.content;
  if (input.commentType !== undefined) payload.comment_type = input.commentType;

  const { data, error } = await supabase
    .from('proposal_comments')
    .update(payload)
    .eq('id', id)
    .select(`${COMMENT_COLUMNS}, author:users!author_user_id(${USER_COLUMNS})`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update comment');
  }

  return transformComment(data) as ProposalComment;
}

/**
 * Delete a comment (and its replies via cascade)
 */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('proposal_comments').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Resolve a comment (mark as addressed)
 */
export async function resolveComment(
  id: string,
  resolvedByUserId: string
): Promise<ProposalComment> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: resolvedByUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`${COMMENT_COLUMNS}, author:users!author_user_id(${USER_COLUMNS})`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to resolve comment');
  }

  return transformComment(data) as ProposalComment;
}

/**
 * Unresolve a comment
 */
export async function unresolveComment(id: string): Promise<ProposalComment> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .update({
      is_resolved: false,
      resolved_at: null,
      resolved_by_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`${COMMENT_COLUMNS}, author:users!author_user_id(${USER_COLUMNS})`)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to unresolve comment');
  }

  return transformComment(data) as ProposalComment;
}

/**
 * Get unresolved revision request count for a proposal
 */
export async function getUnresolvedRevisionRequestCount(
  proposalId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('proposal_comments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_proposal_id', proposalId)
    .eq('comment_type', 'revision_request')
    .eq('is_resolved', false);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

/**
 * Get comment count for a proposal
 */
export async function getCommentCount(
  proposalId: string,
  options?: {
    commentType?: 'internal' | 'client_feedback' | 'revision_request';
    unresolvedOnly?: boolean;
  }
): Promise<number> {
  let query = supabase
    .from('proposal_comments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_proposal_id', proposalId);

  if (options?.commentType) {
    query = query.eq('comment_type', options.commentType);
  }
  if (options?.unresolvedOnly) {
    query = query.eq('is_resolved', false);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

/**
 * Get comment counts for multiple proposals
 */
export async function getCommentCountsByProposalIds(
  proposalIds: string[]
): Promise<Map<string, { total: number; unresolved: number }>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('proposal_comments')
    .select('topic_proposal_id, is_resolved')
    .in('topic_proposal_id', proposalIds);

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, { total: number; unresolved: number }>();

  for (const proposalId of proposalIds) {
    counts.set(proposalId, { total: 0, unresolved: 0 });
  }

  for (const row of data || []) {
    const entry = counts.get(row.topic_proposal_id);
    if (entry) {
      entry.total += 1;
      if (!row.is_resolved) {
        entry.unresolved += 1;
      }
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Transform raw Supabase comment data to proper format
 * Supabase returns author as array when using foreign key join
 */
function transformComment(row: any): ProposalComment {
  return {
    ...row,
    author: Array.isArray(row.author) ? row.author[0] : row.author,
  };
}

/**
 * Build a threaded comment tree from flat list
 */
function buildCommentTree(comments: ProposalComment[]): ProposalComment[] {
  const commentMap = new Map<string, ProposalComment>();
  const rootComments: ProposalComment[] = [];

  // First pass: index all comments
  for (const comment of comments) {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  }

  // Second pass: build tree
  for (const comment of comments) {
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(comment);
      } else {
        // Orphaned reply, treat as root
        rootComments.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  }

  return rootComments;
}
