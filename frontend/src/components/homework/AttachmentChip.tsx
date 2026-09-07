import React from 'react';
import { FileText, Presentation, Link as LinkIcon, Image as ImageIcon, ExternalLink, Download, X } from 'lucide-react';
import type { Attachment } from '../../types';

interface AttachmentChipProps {
  attachment: Attachment;
  onRemove?: () => void;
  onClickImage?: (url: string) => void;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentChip({ attachment, onRemove, onClickImage }: AttachmentChipProps) {
  const isImage = attachment.type === 'image';
  const isPdf = attachment.type === 'pdf';
  const isPresentation = attachment.type === 'presentation';
  const isStoredFile = attachment.url.startsWith('/api/v1/files/');

  const handleClick = (e: React.MouseEvent) => {
    if (onRemove && (e.target as HTMLElement).closest('.remove-btn')) {
      return;
    }
    if ((e.target as HTMLElement).closest('.download-btn')) {
      return;
    }
    if (isImage && onClickImage) {
      onClickImage(attachment.url);
      return;
    }
    // If it's a stored presentation (.pptx / .ppt), download directly
    if (isStoredFile && isPresentation) {
      window.open(`${attachment.url}?download=true`, '_blank');
      return;
    }
    // Open PDF, presentation link or web link in new browser tab
    window.open(attachment.url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const downloadUrl = isStoredFile
      ? `${attachment.url}?download=true`
      : attachment.url;
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = attachment.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border cursor-pointer transition-colors max-w-full group select-none shadow-2xs"
      title={`${attachment.name} (${attachment.type})`}
    >
      {/* Icon based on type */}
      {isPdf ? (
        <FileText size={14} className="text-red-500 shrink-0" />
      ) : isPresentation ? (
        <Presentation size={14} className="text-amber-500 shrink-0" />
      ) : isImage ? (
        <ImageIcon size={14} className="text-emerald-500 shrink-0" />
      ) : (
        <LinkIcon size={14} className="text-sky-500 shrink-0" />
      )}

      {/* Label and size */}
      <span className="truncate max-w-[130px] font-medium text-text-primary">
        {attachment.name}
      </span>

      {attachment.size ? (
        <span className="text-[10px] text-text-muted shrink-0">
          {formatFileSize(attachment.size)}
        </span>
      ) : null}

      {/* Download action button for stored files */}
      {isStoredFile && (
        <button
          type="button"
          onClick={handleDownload}
          className="download-btn text-text-muted hover:text-accent p-0.5 rounded hover:bg-bg-secondary transition-colors"
          title={`Download ${attachment.name}`}
        >
          <Download size={11} />
        </button>
      )}

      {!onRemove && !isStoredFile && (
        <ExternalLink size={10} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5" />
      )}

      {/* Remove button during edit mode */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="remove-btn text-text-muted hover:text-danger p-0.5 ml-0.5 rounded hover:bg-bg-secondary transition-colors"
          title="Remove attachment"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
