import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import { calculateSchedule, toDateString } from '../../src/services/calendar/frequency-calculator';
import { bulkCreateCalendarItems, countCalendarItems } from '../../src/db/queries/calendar.queries';

const GenerateScheduleSchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * POST /api/calendar/schedule
 *
 * Auto-generate draft calendar slots based on the project's
 * posting frequency, date range, and video quota.
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { projectId } = GenerateScheduleSchema.parse(req.body);

    // Verify membership (editor or owner)
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot generate schedules' });
    }

    // Fetch project to get frequency config
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('posting_frequency, custom_frequency_days, video_quota_per_year, start_date, end_date')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Calculate end date — fall back to 1 year from start
    const startDate = new Date(project.start_date);
    const endDate = project.end_date
      ? new Date(project.end_date)
      : new Date(new Date(project.start_date).setFullYear(startDate.getFullYear() + 1));

    // Determine remaining quota
    const existingCount = await countCalendarItems(projectId);
    const quota = project.video_quota_per_year ?? undefined;
    const remainingQuota = quota !== undefined ? Math.max(0, quota - existingCount) : undefined;

    if (remainingQuota === 0) {
      return res.status(409).json({
        error: 'Quota reached',
        quota: quota,
        existing: existingCount,
      });
    }

    // Calculate dates
    const dates = calculateSchedule(
      startDate,
      endDate,
      project.posting_frequency,
      project.custom_frequency_days ?? undefined,
      remainingQuota
    );

    if (dates.length === 0) {
      return res.status(200).json({ items: [], message: 'No dates to schedule in the given range' });
    }

    // Filter out dates that already have a calendar item to avoid duplicates
    const dateStrings = dates.map(toDateString);

    const { data: existing } = await supabase
      .from('calendar_items')
      .select('scheduled_date')
      .eq('project_id', projectId)
      .in('scheduled_date', dateStrings);

    const existingDates = new Set((existing || []).map((e: any) => e.scheduled_date));
    const newDates = dateStrings.filter((d) => !existingDates.has(d));

    if (newDates.length === 0) {
      return res.status(200).json({ items: [], message: 'All dates already have calendar items' });
    }

    // Bulk insert
    const items = await bulkCreateCalendarItems({
      projectId,
      createdByUserId: userId,
      dates: newDates,
    });

    return res.status(201).json({ items, created: items.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to generate schedule';
    return res.status(500).json({ error: message });
  }
}
