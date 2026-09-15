import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  bulkCommitHolidays,
  parseHolidaysJson,
} from '../api/client';
import type { Holiday } from '../types';

export const useHolidays = () => {
  return useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: fetchHolidays,
  });
};

export const useSaveHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holiday: { id?: string; name: string; start_date: string; end_date: string }) => {
      if (holiday.id) {
        return updateHoliday(holiday.id, holiday);
      }
      return createHoliday(holiday);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useDeleteHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useBulkCommitHolidays = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holidays: { name: string; start_date: string; end_date: string }[]) => bulkCommitHolidays(holidays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useParseHolidaysJson = () => {
  return useMutation({
    mutationFn: (rawJson: string) => parseHolidaysJson(rawJson),
  });
};

