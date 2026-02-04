import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setTemplateAsDefault,
  ensureDefaultTemplates,
} from '../../src/db/queries/workflow-templates.queries';
import { validateMilestoneOffsets } from '../../src/services/production/milestone-calculator';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TimelineTypeSchema = z.enum(['normal', 'breaking_news', 'emergency']);

const MilestoneTypeSchema = z.enum([
  'topic_confirmation', 'script_deadline', 'script_approval', 'production_day',
  'post_production', 'draft_1_review', 'draft_2_review', 'final_delivery',
  'topic_approval', 'custom',
]);

const MilestoneOffsetSchema = z.object({
  milestone_type: MilestoneTypeSchema,
  days_offset: z.number().int().min(-365).max(365),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  label: z.string().max(100).nullable(),
  is_client_facing: z.boolean(),
  requires_client_approval: z.boolean(),
});

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
  timelineType: TimelineTypeSchema.optional(),
});

const CreateTemplateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  timelineType: TimelineTypeSchema,
  isDefault: z.boolean().optional(),
  milestoneOffsets: z.array(MilestoneOffsetSchema).min(1),
});

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  timelineType: TimelineTypeSchema.optional(),
  isDefault: z.boolean().optional(),
  milestoneOffsets: z.array(MilestoneOffsetSchema).min(1).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function getProjectIdFromTemplate(templateId: string): Promise<string | null> {
  const template = await getTemplateById(templateId);
  return template?.project_id || null;
}

// ---------------------------------------------------------------------------
// GET /api/workflows/templates - List templates
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
    const query = ListQuerySchema.parse(req.query);

    const member = await verifyMembership(query.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Ensure default templates exist
    await ensureDefaultTemplates(query.projectId);

    const templates = await getTemplates(query.projectId, query.timelineType);
    return res.status(200).json(templates);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/workflows/templates - Create template
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
    const input = CreateTemplateSchema.parse(req.body);

    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create templates' });
    }

    // Validate milestone offsets
    const validationErrors = validateMilestoneOffsets(input.milestoneOffsets);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Invalid milestone offsets', details: validationErrors });
    }

    const template = await createTemplate(input);
    return res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to create template';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/workflows/templates/:id - Get single template
// ---------------------------------------------------------------------------

export async function getHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const templateId = req.params.id;
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    const template = await getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const member = await verifyMembership(template.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    return res.status(200).json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch template';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/workflows/templates/:id - Update template
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
    const templateId = req.params.id;
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    const projectId = await getProjectIdFromTemplate(templateId);
    if (!projectId) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update templates' });
    }

    const input = UpdateTemplateSchema.parse(req.body);

    // Validate milestone offsets if provided
    if (input.milestoneOffsets) {
      const validationErrors = validateMilestoneOffsets(input.milestoneOffsets);
      if (validationErrors.length > 0) {
        return res.status(400).json({ error: 'Invalid milestone offsets', details: validationErrors });
      }
    }

    const template = await updateTemplate(templateId, input);
    return res.status(200).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to update template';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/workflows/templates/:id - Delete template
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
    const templateId = req.params.id;
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    const projectId = await getProjectIdFromTemplate(templateId);
    if (!projectId) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can delete templates' });
    }

    await deleteTemplate(templateId);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/workflows/templates/:id/default - Set as default
// ---------------------------------------------------------------------------

export async function setDefaultHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const templateId = req.params.id;
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    const projectId = await getProjectIdFromTemplate(templateId);
    if (!projectId) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot modify templates' });
    }

    const template = await setTemplateAsDefault(templateId);
    return res.status(200).json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set default template';
    return res.status(500).json({ error: message });
  }
}
