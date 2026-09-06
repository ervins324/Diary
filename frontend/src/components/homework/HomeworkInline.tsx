import { useState } from 'react';
import { Check, X, Edit2, Trash2, Image as ImageIcon } from 'lucide-react';
import { useUpdateHomework, useDeleteHomework } from '../../hooks/useHomework';
import type { HomeworkEntry } from '../../types';
import { cn, compressImageFile } from '../../lib/utils';

interface HomeworkInlineProps {
  homework: HomeworkEntry;
}

/**
 * Inline homework display within a LessonCard.
 * Shows completion toggle, text, attached image thumbnails with lightbox, and edit/delete actions on hover.
 */
export function HomeworkInline({ homework }: HomeworkInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  /* Use homework.text to match backend HomeworkRead schema */
  const [editText, setEditText] = useState(homework.text);
  /* Editable images array */
  const [editImages, setEditImages] = useState<string[]>(homework.images || []);
  /* State for lightbox modal */
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const updateMutation = useUpdateHomework();
  const deleteMutation = useDeleteHomework();

  /* Toggle the completion status */
  const handleToggle = () => {
    updateMutation.mutate({ id: homework.id, data: { is_completed: !homework.is_completed } });
  };

  /* Save edited text and images */
  const handleSave = () => {
    const hasTextChanged = editText.trim() !== homework.text;
    const hasImagesChanged = JSON.stringify(editImages) !== JSON.stringify(homework.images || []);
    if (hasTextChanged || hasImagesChanged) {
      updateMutation.mutate({
        id: homework.id,
        data: { text: editText.trim(), images: editImages },
      });
    }
    setIsEditing(false);
  };

  /* Delete with confirmation */
  const handleDelete = () => {
    if (confirm('Delete this homework?')) {
      deleteMutation.mutate(homework.id);
    }
  };

  /* Handle file upload during edit mode */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImageFile(files[i]);
        setEditImages((prev) => [...prev, compressed]);
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }
    e.target.value = '';
  };

  /* Remove an image during edit */
  const handleRemoveImage = (indexToRemove: number) => {
    setEditImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  /* Handle clipboard paste during edit mode */
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImageFile(file);
            setEditImages((prev) => [...prev, compressed]);
          } catch (err) {
            console.error('Failed to compress pasted image:', err);
          }
        }
      }
    }
  };

  /* Inline edit mode */
  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 mt-2 p-2 bg-bg-secondary rounded border border-border" onPaste={handlePaste}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          {/* Add image button */}
          <label className="p-1 text-text-muted hover:text-accent cursor-pointer rounded hover:bg-bg-tertiary transition-colors" title="Attach image">
            <ImageIcon size={16} />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <button onClick={handleSave} className="text-success hover:bg-success/10 p-1 rounded">
            <Check size={16} />
          </button>
          <button onClick={() => { setIsEditing(false); setEditImages(homework.images || []); setEditText(homework.text); }} className="text-text-muted hover:bg-bg-tertiary p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Thumbnail previews in edit mode */}
        {editImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {editImages.map((imgUrl, idx) => (
              <div key={idx} className="relative w-12 h-12 rounded border border-border overflow-hidden group">
                <img src={imgUrl} alt={`upload-${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-0 right-0 bg-danger/80 text-white rounded-bl p-0.5 opacity-90 hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* Default display mode */
  return (
    <>
      <div className="group flex flex-col gap-1 mt-1">
        <div className="flex items-start gap-2">
          {/* Completion checkbox */}
          <button
            onClick={handleToggle}
            className={cn(
              "mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
              homework.is_completed ? "bg-success border-success text-white" : "border-border hover:border-accent"
            )}
          >
            {homework.is_completed && <Check size={12} />}
          </button>
          {/* Homework text with strikethrough when completed */}
          <span className={cn("text-sm flex-1 leading-snug break-words", homework.is_completed && "line-through text-text-muted")}>
            {homework.text}
          </span>
          {/* Edit/delete actions — visible on hover */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="text-text-muted hover:text-accent p-1" title="Edit">
              <Edit2 size={12} />
            </button>
            <button onClick={handleDelete} className="text-text-muted hover:text-danger p-1" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Display attached image thumbnails */}
        {homework.images && homework.images.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-6 pt-0.5">
            {homework.images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setLightboxImage(imgUrl)}
                className="relative rounded border border-border overflow-hidden hover:opacity-85 focus:outline-none focus:ring-1 focus:ring-accent transition shadow-sm"
              >
                <img src={imgUrl} alt={`hw-img-${idx}`} className="w-12 h-12 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox full-size image modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-accent p-1 rounded-full bg-black/50"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImage}
              alt="Full size homework"
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
