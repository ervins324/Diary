import { useState, useRef, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export function FileDropzone({ onFileSelect, selectedFile }: FileDropzoneProps) {
  const { t } = useLanguage();
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle clipboard paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            onFileSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [onFileSelect]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors w-full",
        isDragActive ? "border-accent bg-accent-light text-accent" : "border-border hover:border-accent hover:bg-bg-tertiary text-text-secondary"
      )}
    >
      <input 
        ref={inputRef} 
        type="file" 
        className="hidden" 
        accept="image/*" 
        onChange={handleChange} 
      />
      <UploadCloud size={48} className="mb-4 text-text-muted" />
      {selectedFile ? (
        <p className="font-medium text-text-primary">Selected: {selectedFile.name}</p>
      ) : (
        <>
          <p className="font-medium mb-1">{t('drop_image_hint')}</p>
          <p className="text-sm text-text-muted">{t('supports_formats')}</p>
        </>
      )}
    </div>
  );
}
