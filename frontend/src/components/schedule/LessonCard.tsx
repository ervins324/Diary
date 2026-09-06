import { useState } from 'react';
import { Plus, Image as ImageIcon, X, Check } from 'lucide-react';
import type { LessonSlot } from '../../types';
import { formatTime, compressImageFile } from '../../lib/utils';
import { HomeworkInline } from '../homework/HomeworkInline';
import { useCreateHomework } from '../../hooks/useHomework';
import { useLanguage } from '../../i18n/LanguageContext';

interface LessonCardProps {
  lesson: LessonSlot;
}

export function LessonCard({ lesson }: LessonCardProps) {
  const { t, language } = useLanguage();
  const [isAddingHomework, setIsAddingHomework] = useState(false);
  const [newHomework, setNewHomework] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const createMutation = useCreateHomework();

  /* Submit new homework entry with text and optional images */
  const handleAddHomework = () => {
    if (newHomework.trim() || attachedImages.length > 0) {
      createMutation.mutate(
        {
          subject_id: lesson.subject.id,
          due_date: lesson.date,
          lesson_order: lesson.lesson_order,
          text: newHomework.trim() || (language === 'uk' ? 'Фото завдання' : 'Photo attachment'),
          images: attachedImages,
        },
        {
          onSuccess: () => {
            setNewHomework('');
            setAttachedImages([]);
            setIsAddingHomework(false);
          },
        }
      );
    } else {
      setIsAddingHomework(false);
    }
  };

  /* Compress and attach images selected via file browser */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImageFile(files[i]);
        setAttachedImages((prev) => [...prev, compressed]);
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }
    e.target.value = '';
  };

  /* Intercept Ctrl+V clipboard paste to directly attach copied images */
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
            setAttachedImages((prev) => [...prev, compressed]);
          } catch (err) {
            console.error('Failed to compress pasted image:', err);
          }
        }
      }
    }
  };

  /* Remove an attached image before submitting */
  const handleRemoveImage = (indexToRemove: number) => {
    setAttachedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="relative bg-bg-secondary rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Color strip */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5" 
        style={{ backgroundColor: lesson.subject.color_hex || 'var(--color-accent)' }} 
      />
      
      <div className="pl-4 pr-3 py-3 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-bg-tertiary text-text-secondary">
              {lesson.lesson_order}
            </span>
            <span className="font-semibold text-text-primary">
              {lesson.subject.name}
            </span>
          </div>
          {lesson.cabinet && (
            <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary font-medium">
              {t('cabinet_short')} {lesson.cabinet}
            </span>
          )}
        </div>
        
        <div className="text-xs text-text-muted">
          {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
        </div>

        <div className="mt-1">
          {lesson.homework?.map((hw) => (
            <HomeworkInline key={hw.id} homework={hw} />
          ))}
          
          {isAddingHomework ? (
            <div 
              className="flex flex-col gap-2 mt-2 p-2 bg-bg-primary rounded border border-border"
              onPaste={handlePaste}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={language === 'uk' ? 'Додати Д/З (введіть текст або вставте Ctrl+V фото)...' : 'Add homework (type or paste Ctrl+V photo)...'}
                  value={newHomework}
                  onChange={(e) => setNewHomework(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHomework();
                    if (e.key === 'Escape') {
                      setIsAddingHomework(false);
                      setAttachedImages([]);
                    }
                  }}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  autoFocus
                />
                {/* Photo attachment button */}
                <label 
                  className="p-1 text-text-muted hover:text-accent cursor-pointer rounded hover:bg-bg-tertiary transition-colors" 
                  title={language === 'uk' ? 'Прикріпити зображення' : 'Attach image'}
                >
                  <ImageIcon size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <button 
                  onClick={handleAddHomework} 
                  className="text-success hover:bg-success/10 p-1 rounded transition-colors"
                  title="Save"
                >
                  <Check size={16} />
                </button>
                <button 
                  onClick={() => {
                    setIsAddingHomework(false);
                    setAttachedImages([]);
                  }} 
                  className="text-text-muted hover:bg-bg-tertiary p-1 rounded transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preview thumbnails of attached images */}
              {attachedImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                  {attachedImages.map((imgUrl, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded border border-border overflow-hidden group">
                      <img src={imgUrl} alt={`attached-${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0 right-0 bg-danger/80 text-white rounded-bl p-0.5 opacity-90 hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAddingHomework(true)}
              className="mt-2 flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
            >
              <Plus size={12} /> {t('add_homework') || 'Add Homework'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
