import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSchedule,
  aiParseSchedule,
  bulkCommitSchedule,
  bulkCommitByName,
  fetchScheduleRules,
  deleteAllSchedule,
  clearAllAppData,
} from '../api/client';

/* Hook to fetch schedule for a date range */
export const useSchedule = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['schedule', startDate, endDate],
    queryFn: () => fetchSchedule(startDate, endDate),
  });
};

/* Hook for AI-powered schedule image parsing */
export const useAiParse = () => {
  return useMutation({
    mutationFn: aiParseSchedule,
  });
};

/* Hook for bulk committing schedule rules by subject ID */
export const useBulkCommit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCommitSchedule,
    onSuccess: () => {
      /* Invalidate schedule queries to reflect new rules */
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
    },
  });
};

/* Hook for bulk committing schedule rules by subject name (AI import flow) */
export const useBulkCommitByName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCommitByName,
    onSuccess: () => {
      /* Invalidate both schedule and subjects queries since new subjects may be auto-created */
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
};

/* Hook to fetch raw schedule rules */
export const useScheduleRules = (weekType?: string) => {
  return useQuery({
    queryKey: ['schedule-rules', weekType],
    queryFn: () => fetchScheduleRules(weekType),
  });
};

/* Hook to delete schedule rules */
export const useDeleteAllSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};

/* Hook to permanently wipe all application data */
export const useClearAllAppData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearAllAppData,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
};

