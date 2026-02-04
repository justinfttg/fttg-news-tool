import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getCommentsByProposalId,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  getCommentCount,
} from '../../src/db/queries/proposal-comments.queries';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CommentTypeSchema = z.enum(['internal', 'client_feedback', 'revision_request']);

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
  commentType: CommentTypeSchema.optional(),
});

const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  commentType: CommentTypeSchema.optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyMembershipByProposal(
  proposalId: string,
  userId: string
): Promise<{ role: string; projectId: string } | null> {
  // Get the project ID from the proposal
  const { data: proposal } = await supabase
    .from('topic_proposals')
    .select('project_id')
    .eq('id', proposalId)
    .single();

  if (!proposal) return null;

  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', proposal.project_id)
    .eq('user_id', userId)
    .single();

  if (!member) return null;

  return { role: member.role, projectId: proposal.project_id };
}

async function verifyMembershipByComment(
  commentId: string,
  userId: string
): Promise<{ role: string; projectId: string; authorId: string } | null> {
  const comment = await getCommentById(commentId, false);
  if (!comment) return null;

  const membership = await verifyMembershipByProposal(comment.topic_proposal_id, userId);
  if (!membership) return null;

  return { ...membership, authorId: comment.author_user_id };
}

// ---------------------------------------------------------------------------
// GET /api/topics/proposals/:id/comments - List comments
// ---------------------------------------------------------------------------

export async function listHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const proposalId = req.params.id;
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID required' });
    }

    const membership = await verifyMembershipByProposal(proposalId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to view this proposal' });
    }

    const unresolvedOnly = req.query.unresolvedOnly === 'true';

    const comments = await getCommentsByProposalId(proposalId, {
      includeAuthor: true,
      unresolvedOnly,
    });

    return res.status(200).json(comments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch comments';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics/proposals/:id/comments - Create comment
// ---------------------------------------------------------------------------

export async function createHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const proposalId = req.params.id;
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID required' });
    }

    const membership = await verifyMembershipByProposal(proposalId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to comment on this proposal' });
    }
    if (membership.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot add comments' });
    }

    const input = CreateCommentSchema.parse(req.body);

    const comment = await createComment({
      topicProposalId: proposalId,
      content: input.content,
      parentCommentId: input.parentCommentId,
      authorUserId: userId,
      commentType: input.commentType,
    });

    return res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to create comment';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/topics/proposals/:id/comments/:commentId - Update comment
// ---------------------------------------------------------------------------

export async function updateHandler(req: Request, res: Response) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const commentId = req.params.commentId;
    if (!commentId) {
      return res.status(400).json({ error: 'Comment ID required' });
    }

    const membership = await verifyMembershipByComment(commentId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to update this comment' });
    }

    // Only author can update their own comment (or owner/editor)
    if (membership.authorId !== userId && membership.role === 'viewer') {
      return res.status(403).json({ error: 'Cannot update comments from other users' });
    }

    const input = UpdateCommentSchema.parse(req.body);
    const comment = await updateComment(commentId, input);

    return res.status(200).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to update comment';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/topics/proposals/:id/comments/:commentId - Delete comment
// ---------------------------------------------------------------------------

export async function deleteHandler(req: Request, res: Response) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const commentId = req.params.commentId;
    if (!commentId) {
      return res.status(400).json({ error: 'Comment ID required' });
    }

    const membership = await verifyMembershipByComment(commentId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Only author can delete their own comment (or owner)
    if (membership.authorId !== userId && membership.role !== 'owner') {
      return res.status(403).json({ error: 'Cannot delete comments from other users' });
    }

    await deleteComment(commentId);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics/proposals/:id/comments/:commentId/resolve - Resolve comment
// ---------------------------------------------------------------------------

export async function resolveHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const commentId = req.params.commentId;
    if (!commentId) {
      return res.status(400).json({ error: 'Comment ID required' });
    }

    const membership = await verifyMembershipByComment(commentId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to resolve this comment' });
    }
    if (membership.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot resolve comments' });
    }

    const comment = await resolveComment(commentId, userId);
    return res.status(200).json(comment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve comment';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics/proposals/:id/comments/:commentId/unresolve - Unresolve
// ---------------------------------------------------------------------------

export async function unresolveHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const commentId = req.params.commentId;
    if (!commentId) {
      return res.status(400).json({ error: 'Comment ID required' });
    }

    const membership = await verifyMembershipByComment(commentId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to unresolve this comment' });
    }
    if (membership.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot unresolve comments' });
    }

    const comment = await unresolveComment(commentId);
    return res.status(200).json(comment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unresolve comment';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/topics/proposals/:id/comments/count - Get comment count
// ---------------------------------------------------------------------------

export async function countHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const proposalId = req.params.id;
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID required' });
    }

    const membership = await verifyMembershipByProposal(proposalId, userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to view this proposal' });
    }

    const total = await getCommentCount(proposalId);
    const unresolved = await getCommentCount(proposalId, { unresolvedOnly: true });
    const revisionRequests = await getCommentCount(proposalId, {
      commentType: 'revision_request',
      unresolvedOnly: true,
    });

    return res.status(200).json({ total, unresolved, revisionRequests });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch comment count';
    return res.status(500).json({ error: message });
  }
}
