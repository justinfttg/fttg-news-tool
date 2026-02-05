import api from './api';
import { CalendarItem } from '../types';

export async function getCalendarItems(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<CalendarItem[]> {
  const { data } = await api.get<CalendarItem[]>('/calendar/items', {
    params: { projectId, startDate, endDate },
  });
  return data;
}

export async function createCalendarItem(input: {
  projectId: string;
  title: string;
  scheduledDate: string;
  scheduledTime?: string;
  durationSeconds?: number;
  newsStoryId?: string;
  notes?: string;
}): Promise<CalendarItem> {
  const { data } = await api.post<CalendarItem>('/calendar/items', input);
  return data;
}

export async function updateCalendarItem(
  id: string,
  input: {
    title?: string;
    scheduledDate?: string;
    scheduledTime?: string | null;
    durationSeconds?: number | null;
    status?: CalendarItem['status'];
    newsStoryId?: string | null;
    selectedAngleId?: string | null;
    scriptId?: string | null;
    notes?: string | null;
  }
): Promise<CalendarItem> {
  const { data } = await api.put<CalendarItem>(`/calendar/items/${id}`, input);
  return data;
}

export async function deleteCalendarItem(id: string): Promise<void> {
  await api.delete(`/calendar/items/${id}`);
}
