import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Attachment } from '../types';
import {
  fetchLessonNotes,
  createLessonNote,
  updateLessonNote,
  deleteLessonNote,
} from '../api/client';

export const useLessonNotes = (targetDate?: string, lessonOrder?: number, subjectId?: string) => {
  return useQuery({
    queryKey: ['lesson-notes', targetDate, lessonOrder, subjectId],
    queryFn: () => fetchLessonNotes(targetDate, lessonOrder, subjectId),
    enabled: Boolean(targetDate && lessonOrder !== undefined),
  });
};

export const useCreateLessonNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLessonNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-notes'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useUpdateLessonNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        text?: string;
        images?: string[];
        attachments?: Attachment[];
      };
    }) => updateLessonNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-notes'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useDeleteLessonNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLessonNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-notes'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};
