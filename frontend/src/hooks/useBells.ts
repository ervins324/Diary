import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBells,
  createBellSlot,
  updateBellSlot,
  deleteBellSlot,
  bulkCommitBells,
  aiParseBells,
  parseBellsJson,
} from '../api/client';
import type { BellSlot } from '../types';

export const useBells = () => {
  return useQuery<BellSlot[]>({
    queryKey: ['bells'],
    queryFn: fetchBells,
  });
};

export const useSaveBellSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slot: Partial<BellSlot>) => {
      if (slot.id) {
        return updateBellSlot(slot.id, slot);
      }
      return createBellSlot(slot);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bells'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useDeleteBellSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBellSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bells'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useBulkCommitBells = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slots: Partial<BellSlot>[]) => bulkCommitBells(slots),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bells'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
};

export const useAiParseBells = () => {
  return useMutation({
    mutationFn: (file: File) => aiParseBells(file),
  });
};

export const useParseBellsJson = () => {
  return useMutation({
    mutationFn: (rawJson: string) => parseBellsJson(rawJson),
  });
};
