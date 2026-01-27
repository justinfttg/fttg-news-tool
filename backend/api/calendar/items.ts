import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getCalendarItems,
  getCalendarItemById,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
} from '../../src/db/queries/calendar.queries';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CalendarItemStatus = z.enum([
  'draft', 'pending_review', 'approved', 'in_production', 'published', 'cancelled',
]);

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

const CreateItemSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM or HH:MM:SS').optional(),
  durationSeconds: z.number().int().positive().optional(),
  newsStoryId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM or HH:MM:SS').nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  status: CalendarItemStatus.optional(),
  newsStoryId: z.string().uuid().nullable().optional(),
  selectedAngleId: z.string().uuid().nullable().optional(),
  scriptId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
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

// ---------------------------------------------------------------------------
// GET /api/calendar/items
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
    const { projectId, startDate, endDate } = ListQuerySchema.parse(req.query);

    const member = await verifyMembership(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const items = await getCalendarItems(projectId, startDate, endDate);
    return res.status(200).json(items);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch calendar items';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/calendar/items
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
    const input = CreateItemSchema.parse(req.body);

    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create calendar items' });
    }

    const item = await createCalendarItem({
      ...input,
      createdByUserId: userId,
    });

    return res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to create calendar item';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/calendar/items/:id
// ---------------------------------------------------------------------------

export async function updateHandler(req: Request, res: Response) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const itemId = req.params.id;
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID required' });
    }

    const existing = await getCalendarItemById(itemId);
    if (!existing) {
      return res.status(404).json({ error: 'Calendar item not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update calendar items' });
    }

    const input = UpdateItemSchema.parse(req.body);

    // If status is changing to 'approved', stamp approval fields
    const updateData: any = { ...input };
    if (input.status === 'approved' && existing.status !== 'approved') {
      updateData.approvedByUserId = userId;
      updateData.approvedAt = new Date().toISOString();
    }

    const item = await updateCalendarItem(itemId, updateData);
    return res.status(200).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to update calendar item';
    return res.status(500).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/calendar/items/:id
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
    const itemId = req.params.id;
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID required' });
    }

    const existing = await getCalendarItemById(itemId);
    if (!existing) {
      return res.status(404).json({ error: 'Calendar item not found' });
    }

    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete calendar items' });
    }

    await deleteCalendarItem(itemId);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete calendar item';
    return res.status(500).json({ error: message });
  }
}
