import { useMutation } from '@tanstack/react-query';
import { uploadStoredFile } from '../api/client';

export function useFileUpload() {
  return useMutation({
    mutationFn: (file: File) => uploadStoredFile(file),
  });
}
