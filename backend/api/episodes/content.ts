import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getContentWithDetails,
  saveContentVersion,
  submitForReview,
  requestRevisions,
  approveContent,
  lockContent,
  getContentFeedback,
  createContentFeedback,
  resolveFeedback,
  getContentVersions,
  getContentVersion,
  type ContentType,
  type FeedbackType,
} from '../../src/db/queries/episode-content.queries';

// ============================================================================
// Validation Schemas
// ============================================================================

const ContentTypeSchema = z.enum(['video_script', 'article']);

const SaveVersionSchema = z.object({
  title: z.string().max(500).optional(),
  body: z.string().min(1),
  changeSummary: z.string().max(500).optional(),
});

const CreateFeedbackSchema = z.object({
  versionId: z.string().uuid(),
  comment: z.string().min(1).max(5000),
  feedbackType: z.enum(['comment', 'revision_request', 'approval']).default('comment'),
  highlightStart: z.number().optional(),
  highlightEnd: z.number().optional(),
  highlightedText: z.string().optional(),
  parentFeedbackId: z.string().uuid().optional(),
  isClientFeedback: z.boolean().optional(),
});

// ============================================================================
// Helpers
// ============================================================================

async function verifyMembership(
  projectId: string,
  userId: string
): Promise<{ role: string } | null> {
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return data;
}

async function getEpisodeProjectId(episodeId: string): Promise<string | null> {
  const { data } = await supabase
    .from('production_episodes')
    .select('project_id')
    .eq('id', episodeId)
    .single();

  return data?.project_id || null;
}

// ============================================================================
// GET /api/episodes/:episodeId/content/:contentType
// Get content with details
// ============================================================================

export async function getContentHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  if (!ContentTypeSchema.safeParse(contentType).success) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const result = await getContentWithDetails(episodeId, contentType as ContentType);

    if (!result) {
      // No content yet - return empty state
      return res.status(200).json({
        content: null,
        latestVersion: null,
        versions: [],
        unresolvedFeedbackCount: 0,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[episodes/content] Get error:', error);
    return res.status(500).json({ error: 'Failed to get content' });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/save
// Save a new version
// ============================================================================

export async function saveVersionHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  if (!ContentTypeSchema.safeParse(contentType).success) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  try {
    const input = SaveVersionSchema.parse(req.body);

    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit content' });
    }

    const result = await saveContentVersion({
      episodeId,
      contentType: contentType as ContentType,
      title: input.title,
      body: input.body,
      changeSummary: input.changeSummary,
      userId,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('[episodes/content] Save error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save content';
    return res.status(500).json({ error: message });
  }
}

// ============================================================================
// GET /api/episodes/:episodeId/content/:contentType/versions
// Get all versions
// ============================================================================

export async function getVersionsHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  if (!ContentTypeSchema.safeParse(contentType).success) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Get content first
    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(200).json({ versions: [] });
    }

    const versions = await getContentVersions(content.id);
    return res.status(200).json({ versions });
  } catch (error) {
    console.error('[episodes/content] Get versions error:', error);
    return res.status(500).json({ error: 'Failed to get versions' });
  }
}

// ============================================================================
// GET /api/episodes/:episodeId/content/:contentType/versions/:versionNumber
// Get specific version
// ============================================================================

export async function getVersionHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType, versionNumber } = req.params;

  if (!ContentTypeSchema.safeParse(contentType).success) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Get content first
    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const version = await getContentVersion(content.id, parseInt(versionNumber));
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    return res.status(200).json({ version });
  } catch (error) {
    console.error('[episodes/content] Get version error:', error);
    return res.status(500).json({ error: 'Failed to get version' });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/submit
// Submit for review
// ============================================================================

export async function submitHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member || member.role === 'viewer') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const updated = await submitForReview(content.id);
    return res.status(200).json({ content: updated });
  } catch (error) {
    console.error('[episodes/content] Submit error:', error);
    return res.status(500).json({ error: 'Failed to submit for review' });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/request-revisions
// Request revisions
// ============================================================================

export async function requestRevisionsHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member || member.role === 'viewer') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const updated = await requestRevisions(content.id);
    return res.status(200).json({ content: updated });
  } catch (error) {
    console.error('[episodes/content] Request revisions error:', error);
    return res.status(500).json({ error: 'Failed to request revisions' });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/approve
// Approve content
// ============================================================================

export async function approveHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member || member.role === 'viewer') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const updated = await approveContent(content.id, userId);
    return res.status(200).json({ content: updated });
  } catch (error) {
    console.error('[episodes/content] Approve error:', error);
    return res.status(500).json({ error: 'Failed to approve content' });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/lock
// Lock content
// ============================================================================

export async function lockHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member || member.role === 'viewer') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { data: content } = await supabase
      .from('episode_content')
      .select('id, status')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved content can be locked' });
    }

    const updated = await lockContent(content.id, userId);
    return res.status(200).json({ content: updated });
  } catch (error) {
    console.error('[episodes/content] Lock error:', error);
    return res.status(500).json({ error: 'Failed to lock content' });
  }
}

// ============================================================================
// GET /api/episodes/:episodeId/content/:contentType/feedback
// Get feedback for content
// ============================================================================

export async function getFeedbackHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;
  const { versionId } = req.query;

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(200).json({ feedback: [] });
    }

    const feedback = await getContentFeedback(
      content.id,
      versionId ? String(versionId) : undefined
    );
    return res.status(200).json({ feedback });
  } catch (error) {
    console.error('[episodes/content] Get feedback error:', error);
    return res.status(500).json({ error: 'Failed to get feedback' });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/feedback
// Add feedback
// ============================================================================

export async function addFeedbackHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, contentType } = req.params;

  try {
    const input = CreateFeedbackSchema.parse(req.body);

    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const { data: content } = await supabase
      .from('episode_content')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('content_type', contentType)
      .single();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const feedback = await createContentFeedback({
      contentId: content.id,
      versionId: input.versionId,
      comment: input.comment,
      feedbackType: input.feedbackType as FeedbackType,
      highlightStart: input.highlightStart,
      highlightEnd: input.highlightEnd,
      highlightedText: input.highlightedText,
      parentFeedbackId: input.parentFeedbackId,
      authorUserId: userId,
      isClientFeedback: input.isClientFeedback,
    });

    // If this is a revision request, update content status
    if (input.feedbackType === 'revision_request') {
      await requestRevisions(content.id);
    }

    return res.status(201).json({ feedback });
  } catch (error) {
    console.error('[episodes/content] Add feedback error:', error);
    const message = error instanceof Error ? error.message : 'Failed to add feedback';
    return res.status(500).json({ error: message });
  }
}

// ============================================================================
// POST /api/episodes/:episodeId/content/:contentType/feedback/:feedbackId/resolve
// Resolve feedback
// ============================================================================

export async function resolveFeedbackHandler(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { episodeId, feedbackId } = req.params;

  try {
    const projectId = await getEpisodeProjectId(episodeId);
    if (!projectId) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const feedback = await resolveFeedback(feedbackId, userId);
    return res.status(200).json({ feedback });
  } catch (error) {
    console.error('[episodes/content] Resolve feedback error:', error);
    return res.status(500).json({ error: 'Failed to resolve feedback' });
  }
}
