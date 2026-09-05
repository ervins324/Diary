import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSchedule, aiParseSchedule, bulkCommitSchedule, bulkCommitByName } from '../api/client';

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
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
};
