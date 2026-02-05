import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getTopicProposalById,
  updateTopicProposal,
  deleteTopicProposal,
} from '../../src/db/queries/topic-proposals.queries';

// ============================================================================
// Schemas
// ============================================================================

const UpdateProposalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  hook: z.string().min(1).max(2000).optional(),
  audienceCareStatement: z.string().max(1000).nullable().optional(),
  talkingPoints: z.array(z.object({
    point: z.string(),
    supporting_detail: z.string(),
    duration_estimate_seconds: z.number(),
    audience_framing: z.string().optional(),
  })).optional(),
  researchCitations: z.array(z.object({
    title: z.string(),
    url: z.string(),
    source_type: z.enum(['statistic', 'study', 'expert_opinion', 'news']),
    snippet: z.string(),
    accessed_at: z.string(),
    relevance_to_audience: z.string().optional(),
  })).optional(),
  sourceStoryIds: z.array(z.string()).optional(),
  status: z.enum(['draft', 'reviewed', 'approved', 'rejected', 'archived']).optional(),
  reviewNotes: z.string().max(2000).nullable().optional(),
});

// ============================================================================
// Helpers
// ============================================================================

async function verifyMembership(
  projectId: string,
  userId: string
): Promise<{ role: string; can_approve_stories: boolean } | null> {
  const { data } = await supabase
    .from('project_members')
    .select('role, can_approve_stories')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return data;
}

// ============================================================================
// GET /api/topics/proposals/:id
// ============================================================================

export async function getHandler(req: Request, res: Response) {
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

    const proposal = await getTopicProposalById(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Topic proposal not found' });
    }

    // Verify project membership
    const member = await verifyMembership(proposal.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Fetch source stories (partial data for display)
    if (proposal.source_story_ids && proposal.source_story_ids.length > 0) {
      const { data: stories } = await supabase
        .from('news_stories')
        .select('id, title, summary, source, url, category, published_at, thumbnail_url')
        .in('id', proposal.source_story_ids);

      (proposal as any).source_stories = stories || [];
    }

    return res.status(200).json({ proposal });
  } catch (error) {
    console.error('[topics/proposals/:id] Get error:', error);
    return res.status(500).json({ error: 'Failed to fetch topic proposal' });
  }
}

// ============================================================================
// PATCH /api/topics/proposals/:id
// ============================================================================

export async function updateHandler(req: Request, res: Response) {
  if (req.method !== 'PATCH') {
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

    const existing = await getTopicProposalById(proposalId);
    if (!existing) {
      return res.status(404).json({ error: 'Topic proposal not found' });
    }

    // Verify project membership
    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Parse and validate input
    const input = UpdateProposalSchema.parse(req.body);

    // Check approval permissions
    if (input.status === 'approved' && !member.can_approve_stories && member.role !== 'owner') {
      return res.status(403).json({ error: 'You do not have permission to approve proposals' });
    }

    // Viewers cannot edit
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit topic proposals' });
    }

    const proposal = await updateTopicProposal(proposalId, input);

    return res.status(200).json({ proposal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[topics/proposals/:id] Update error:', error);
    return res.status(500).json({ error: 'Failed to update topic proposal' });
  }
}

// ============================================================================
// DELETE /api/topics/proposals/:id
// ============================================================================

export async function deleteHandler(req: Request, res: Response) {
  if (req.method !== 'DELETE') {
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

    const existing = await getTopicProposalById(proposalId);
    if (!existing) {
      return res.status(404).json({ error: 'Topic proposal not found' });
    }

    // Verify project membership
    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Only owner or creator can delete
    if (member.role !== 'owner' && existing.created_by_user_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this proposal' });
    }

    await deleteTopicProposal(proposalId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[topics/proposals/:id] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete topic proposal' });
  }
}
