import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  postingFrequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'custom']).default('weekly'),
  customFrequencyDays: z.number().positive().optional(),
  videoQuotaPerYear: z.number().positive().optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date').optional(),
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  const orgId = (req as any).user?.orgId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const input = CreateProjectSchema.parse(req.body);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: input.name,
        description: input.description || null,
        owner_org_id: orgId || null,
        created_by_user_id: userId,
        posting_frequency: input.postingFrequency,
        custom_frequency_days: input.customFrequencyDays || null,
        video_quota_per_year: input.videoQuotaPerYear || null,
        start_date: input.startDate,
        end_date: input.endDate || null,
      })
      .select('*')
      .single();

    if (projectError || !project) {
      throw new Error(projectError?.message || 'Failed to create project');
    }

    // Add creator as project owner
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: userId,
        role: 'owner',
        can_create_stories: true,
        can_approve_stories: true,
        can_generate_scripts: true,
        can_invite_members: true,
      });

    if (memberError) {
      console.error('Failed to add creator as project member:', memberError.message);
    }

    return res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to create project';
    return res.status(500).json({ error: message });
  }
}
