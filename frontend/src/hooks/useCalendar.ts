import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  generateSchedule,
} from '../services/calendar.service';

/**
 * Fetch calendar items for a project within a date range.
 * `startDate` and `endDate` should be YYYY-MM-DD strings.
 */
export function useCalendarItems(
  projectId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['calendarItems', projectId, startDate, endDate],
    queryFn: () => getCalendarItems(projectId!, startDate, endDate),
    enabled: !!projectId && !!startDate && !!endDate,
  });
}

export function useCreateCalendarItem(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCalendarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}

export function useUpdateCalendarItem(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: Parameters<typeof updateCalendarItem>[1] & { id: string }) =>
      updateCalendarItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}

export function useDeleteCalendarItem(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCalendarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}

export function useAutoSchedule(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateSchedule(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarItems', projectId] });
    },
  });
}
