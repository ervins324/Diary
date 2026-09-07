import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  setScheduleOverride,
  deleteScheduleOverride,
  fetchScheduleOverrides,
  fetchNextLesson,
  fetchPreviousLesson,
} from '../api/client';
import type { ScheduleOverride, NextLesson, PreviousLesson } from '../types';

export function useScheduleOverrides(startDate?: string, endDate?: string) {
  return useQuery<ScheduleOverride[]>({
    queryKey: ['schedule-overrides', startDate, endDate],
    queryFn: () => fetchScheduleOverrides(startDate, endDate),
    staleTime: 60 * 1000,
  });
}

export function useSetScheduleOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ScheduleOverride>) => setScheduleOverride(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteScheduleOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetDate, lessonOrder }: { targetDate: string; lessonOrder: number }) =>
      deleteScheduleOverride(targetDate, lessonOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export { fetchNextLesson, fetchPreviousLesson };
export type { NextLesson, PreviousLesson };
