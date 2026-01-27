import { supabase } from '../client';
import type { CalendarItem } from '../../types';

// ---------------------------------------------------------------------------
// Column selection (single source of truth)
// ---------------------------------------------------------------------------

const ITEM_COLUMNS = 'id, project_id, news_story_id, title, scheduled_date, scheduled_time, duration_seconds, status, selected_angle_id, script_id, created_by_user_id, approved_by_user_id, approved_at, notes, created_at, updated_at';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCalendarItemInput {
  projectId: string;
  title: string;
  scheduledDate: string;
  scheduledTime?: string;
  durationSeconds?: number;
  newsStoryId?: string;
  notes?: string;
  createdByUserId: string;
}

export interface UpdateCalendarItemInput {
  title?: string;
  scheduledDate?: string;
  scheduledTime?: string | null;
  durationSeconds?: number | null;
  status?: CalendarItem['status'];
  newsStoryId?: string | null;
  selectedAngleId?: string | null;
  scriptId?: string | null;
  notes?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
}

export interface BulkCreateInput {
  projectId: string;
  createdByUserId: string;
  dates: string[]; // YYYY-MM-DD strings
}

// ---------------------------------------------------------------------------
// 1. getCalendarItems — list items for a project within a date range
// ---------------------------------------------------------------------------

export async function getCalendarItems(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<CalendarItem[]> {
  const { data, error } = await supabase
    .from('calendar_items')
    .select(ITEM_COLUMNS)
    .eq('project_id', projectId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as CalendarItem[];
}

// ---------------------------------------------------------------------------
// 2. getCalendarItemById
// ---------------------------------------------------------------------------

export async function getCalendarItemById(id: string): Promise<CalendarItem | null> {
  const { data, error } = await supabase
    .from('calendar_items')
    .select(ITEM_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as CalendarItem;
}

// ---------------------------------------------------------------------------
// 3. createCalendarItem
// ---------------------------------------------------------------------------

export async function createCalendarItem(input: CreateCalendarItemInput): Promise<CalendarItem> {
  const { data, error } = await supabase
    .from('calendar_items')
    .insert({
      project_id: input.projectId,
      title: input.title,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime || null,
      duration_seconds: input.durationSeconds || null,
      news_story_id: input.newsStoryId || null,
      notes: input.notes || null,
      created_by_user_id: input.createdByUserId,
      status: 'draft',
    })
    .select(ITEM_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create calendar item');
  }

  return data as CalendarItem;
}

// ---------------------------------------------------------------------------
// 4. updateCalendarItem
// ---------------------------------------------------------------------------

export async function updateCalendarItem(
  id: string,
  input: UpdateCalendarItemInput
): Promise<CalendarItem> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) payload.title = input.title;
  if (input.scheduledDate !== undefined) payload.scheduled_date = input.scheduledDate;
  if (input.scheduledTime !== undefined) payload.scheduled_time = input.scheduledTime;
  if (input.durationSeconds !== undefined) payload.duration_seconds = input.durationSeconds;
  if (input.status !== undefined) payload.status = input.status;
  if (input.newsStoryId !== undefined) payload.news_story_id = input.newsStoryId;
  if (input.selectedAngleId !== undefined) payload.selected_angle_id = input.selectedAngleId;
  if (input.scriptId !== undefined) payload.script_id = input.scriptId;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.approvedByUserId !== undefined) payload.approved_by_user_id = input.approvedByUserId;
  if (input.approvedAt !== undefined) payload.approved_at = input.approvedAt;

  const { data, error } = await supabase
    .from('calendar_items')
    .update(payload)
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update calendar item');
  }

  return data as CalendarItem;
}

// ---------------------------------------------------------------------------
// 5. deleteCalendarItem
// ---------------------------------------------------------------------------

export async function deleteCalendarItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_items')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// 6. bulkCreateCalendarItems — used by the auto-scheduler
// ---------------------------------------------------------------------------

export async function bulkCreateCalendarItems(input: BulkCreateInput): Promise<CalendarItem[]> {
  const rows = input.dates.map((date, idx) => ({
    project_id: input.projectId,
    title: `Slot ${idx + 1}`,
    scheduled_date: date,
    scheduled_time: null,
    duration_seconds: null,
    news_story_id: null,
    notes: null,
    created_by_user_id: input.createdByUserId,
    status: 'draft' as const,
  }));

  const { data, error } = await supabase
    .from('calendar_items')
    .insert(rows)
    .select(ITEM_COLUMNS);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to bulk create calendar items');
  }

  return data as CalendarItem[];
}

// ---------------------------------------------------------------------------
// 7. countCalendarItems — for quota tracking
// ---------------------------------------------------------------------------

export async function countCalendarItems(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('calendar_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .neq('status', 'cancelled');

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}
