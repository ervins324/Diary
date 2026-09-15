import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchHomework, createHomework, updateHomework, deleteHomework } from '../api/client';

export const useHomework = (date?: string, subjectId?: string, fromDate?: string, toDate?: string) => {
  return useQuery({
    queryKey: ['homework', date, subjectId, fromDate, toDate],
    queryFn: () => fetchHomework(date, subjectId, fromDate, toDate),
  });
};

export const useCreateHomework = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHomework,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      /* Invalidate stats so homework completion rate updates immediately */
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};

export const useUpdateHomework = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateHomework(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      /* Invalidate stats so homework completion rate updates immediately */
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};

export const useDeleteHomework = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteHomework,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      /* Invalidate stats so homework completion rate updates immediately */
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
};
