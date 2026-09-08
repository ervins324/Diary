import { useState } from 'react';
import { Plus, Image as ImageIcon, X, Check, ArrowLeftRight, Compass, RotateCcw, Link as LinkIcon, Loader2 } from 'lucide-react';
import type { LessonSlot, Attachment } from '../../types';
import { formatTime, compressImageFile, isLessonNow, cn } from '../../lib/utils';
import { getEventTypeInfo } from '../../lib/customTypes';
import { HomeworkInline } from '../homework/HomeworkInline';
import { AttachmentChip } from '../homework/AttachmentChip';
import { AddLinkModal } from '../homework/AddLinkModal';
import { LessonOverrideModal } from './LessonOverrideModal';
import { useCreateHomework } from '../../hooks/useHomework';
import { useFileUpload } from '../../hooks/useFileUpload';
import { fetchNextLesson, fetchPreviousLesson } from '../../hooks/useScheduleOverrides';
import { useLanguage } from '../../i18n/LanguageContext';

interface LessonCardProps {
  lesson: LessonSlot;
  onFindNextLesson?: (subjectId: string, currentDate?: string, currentLessonOrder?: number) => void;
  onFindPreviousLesson?: (subjectId: string, currentDate?: string, currentLessonOrder?: number) => void;
}

export function LessonCard({ lesson, onFindNextLesson, onFindPreviousLesson }: LessonCardProps) {
  const { t, language } = useLanguage();
  const [isAddingHomework, setIsAddingHomework] = useState(false);
  const [newHomework, setNewHomework] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedItems, setAttachedItems] = useState<Attachment[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLocatingPrev, setIsLocatingPrev] = useState(false);

  const createMutation = useCreateHomework();
  const uploadMutation = useFileUpload();

  const isCurrentLesson = isLessonNow(lesson.start_time, lesson.end_time, lesson.date);

  /* Submit new homework entry with text, images, and attachments */
  const handleAddHomework = () => {
    if (newHomework.trim() || attachedImages.length > 0 || attachedItems.length > 0) {
      createMutation.mutate(
        {
          subject_id: lesson.subject.id,
          due_date: lesson.date,
          lesson_order: lesson.lesson_order,
          text:
            newHomework.trim() ||
            (language === 'uk' ? 'Прикріплені матеріали' : 'Attached materials'),
          images: attachedImages,
          attachments: attachedItems,
        },
        {
          onSuccess: () => {
            setNewHomework('');
            setAttachedImages([]);
            setAttachedItems([]);
            setIsAddingHomework(false);
          },
        }
      );
    } else {
      setIsAddingHomework(false);
    }
  };

  /* Handle file upload (supports PDF documents, PPT/PPTX presentations, and images) */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      const isPresentation = (
        lowerName.endsWith('.pptx') ||
        lowerName.endsWith('.ppt') ||
        file.type.includes('presentation') ||
        file.type.includes('powerpoint')
      );

      if (file.type === 'application/pdf' || isPresentation) {
        try {
          const uploaded = await uploadMutation.mutateAsync(file);
          setAttachedItems((prev) => [
            ...prev,
            {
              id: uploaded.id,
              name: uploaded.filename,
              type: isPresentation ? 'presentation' : 'pdf',
              url: uploaded.url,
              size: uploaded.size,
            },
          ]);
        } catch (err) {
          console.error('Failed to upload file:', err);
        }
      } else if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImageFile(file);
          setAttachedImages((prev) => [...prev, compressed]);
        } catch (err) {
          console.error('Failed to compress image:', err);
        }
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

  /* Remove an attached item (PDF or link) before submitting */
  const handleRemoveItem = (indexToRemove: number) => {
    setAttachedItems((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  /* Locate next lesson closest to today */
  const handleLocateNext = async () => {
    if (onFindNextLesson) {
      onFindNextLesson(lesson.subject.id, lesson.date, lesson.lesson_order);
      return;
    }
    try {
      setIsLocating(true);
      const result = await fetchNextLesson(lesson.subject.id, lesson.date, lesson.lesson_order);
      if (!result) {
        alert(
          language === 'uk'
            ? 'Не знайдено наступного уроку для цього предмету.'
            : 'No upcoming lesson found for this subject.'
        );
        return;
      }
      window.dispatchEvent(
        new CustomEvent('diary:navigate-and-highlight', {
          detail: {
            date: result.date,
            lessonOrder: result.lesson_order,
            subjectId: result.subject_id,
          },
        })
      );
    } catch (err) {
      console.error('Failed to locate next lesson:', err);
    } finally {
      setIsLocating(false);
    }
  };

  /* Return to previous lesson of this subject */
  const handleLocatePrevious = async () => {
    if (onFindPreviousLesson) {
      onFindPreviousLesson(lesson.subject.id, lesson.date, lesson.lesson_order);
      return;
    }
    try {
      setIsLocatingPrev(true);
      const result = await fetchPreviousLesson(lesson.subject.id, lesson.date, lesson.lesson_order);
      if (!result) {
        alert(
          language === 'uk'
            ? 'Не знайдено попереднього уроку для цього предмету.'
            : 'No previous lesson found for this subject.'
        );
        return;
      }
      window.dispatchEvent(
        new CustomEvent('diary:navigate-and-highlight', {
          detail: {
            date: result.date,
            lessonOrder: result.lesson_order,
            subjectId: result.subject_id,
          },
        })
      );
    } catch (err) {
      console.error('Failed to locate previous lesson:', err);
    } finally {
      setIsLocatingPrev(false);
    }
  };

  return (
    <div
      id={`lesson-${lesson.lesson_order}`}
      className={cn(
        "relative bg-bg-secondary rounded-lg border shadow-xs overflow-hidden flex flex-col transition-all duration-300",
        isCurrentLesson
          ? "border-accent ring-2 ring-accent/30 shadow-md bg-accent/5"
          : "border-border",
        lesson.is_override && !isCurrentLesson && !lesson.event_type && "border-amber-500/40 bg-amber-500/5",
        lesson.event_type === 'control_work' && "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/20",
        lesson.event_type === 'test' && "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20",
        lesson.event_type === 'essay' && "border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/20",
        lesson.event_type === 'project' && "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20",
        lesson.is_cancelled && "opacity-75 bg-bg-tertiary/50"
      )}
    >
      {/* Color strip */}
      <div 
        className={cn("absolute left-0 top-0 bottom-0", isCurrentLesson ? "w-2.5" : "w-1.5")}
        style={{
          backgroundColor: lesson.is_cancelled
            ? '#94A3B8'
            : lesson.subject.color_hex || 'var(--color-accent)',
        }} 
      />
      
      <div className="pl-4 pr-3 py-3 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full",
              isCurrentLesson ? "bg-accent text-white font-bold" : "bg-bg-tertiary text-text-secondary"
            )}>
              {lesson.lesson_order}
            </span>

            {/* Subject display: If overridden, shows changed lesson and previous in brackets */}
            {lesson.is_cancelled ? (
              <span className="font-semibold text-text-muted line-through">
                {language === 'uk' ? 'Скасовано' : 'Cancelled'}
                {lesson.original_subject && (
                  <span className="ml-1 text-xs text-text-muted font-normal no-underline inline-block">
                    ({lesson.original_subject.name})
                  </span>
                )}
              </span>
            ) : lesson.is_override && lesson.original_subject ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-bold text-text-primary">
                  {lesson.subject.name}
                </span>
                <span className="text-xs text-text-muted font-medium">
                  ({lesson.original_subject.name})
                </span>
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {language === 'uk' ? 'Заміна' : 'Substitution'}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-text-primary">
                {lesson.subject.name}
              </span>
            )}

            {/* Special event / assessment badge (Control Work, Test, Essay, Project, and Custom Types) */}
            {lesson.event_type && (() => {
              const info = getEventTypeInfo(lesson.event_type, language);
              if (!info) return null;
              return (
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold border shadow-2xs"
                  style={{
                    backgroundColor: `${info.color}20`,
                    color: info.color,
                    borderColor: `${info.color}40`,
                  }}
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </span>
              );
            })()}

            {isCurrentLesson && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-accent text-white shadow-xs animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                {t('now')}
              </span>
            )}
          </div>

          {/* Top-right actions: Cabinet badge, Substitution modal trigger, and Next lesson locator */}
          <div className="flex items-center gap-1.5">
            {lesson.cabinet && !lesson.is_cancelled && localStorage.getItem('show_cabinets') !== 'false' && (
              <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary font-medium">
                {t('cabinet_short')} {lesson.cabinet}
              </span>
            )}

            {/* Locate previous lesson button */}
            <button
              onClick={handleLocatePrevious}
              disabled={isLocatingPrev}
              className="p-1 text-text-muted hover:text-accent rounded hover:bg-bg-tertiary transition-colors"
              title={
                language === 'uk'
                  ? 'Повернутися до попереднього уроку цього предмету'
                  : 'Return to previous lesson of this subject'
              }
            >
              {isLocatingPrev ? <Loader2 size={14} className="animate-spin text-accent" /> : <RotateCcw size={14} />}
            </button>

            {/* Locate next lesson button */}
            <button
              onClick={handleLocateNext}
              disabled={isLocating}
              className="p-1 text-text-muted hover:text-accent rounded hover:bg-bg-tertiary transition-colors"
              title={
                language === 'uk'
                  ? 'Знайти найближчий наступний урок цього предмету'
                  : 'Find closest next lesson of this subject'
              }
            >
              {isLocating ? <Loader2 size={14} className="animate-spin text-accent" /> : <Compass size={14} />}
            </button>

            {/* Substitution & Event override trigger button */}
            <button
              onClick={() => setIsOverrideModalOpen(true)}
              className={cn(
                "p-1 rounded transition-colors",
                lesson.event_type === 'control_work'
                  ? "text-rose-500 hover:bg-rose-500/10"
                  : lesson.event_type
                  ? "text-accent hover:bg-accent/10"
                  : lesson.is_override
                  ? "text-amber-500 hover:bg-amber-500/10"
                  : "text-text-muted hover:text-accent hover:bg-bg-tertiary"
              )}
              title={
                language === 'uk'
                  ? 'Заміна або подія уроку (контрольна, тест, твір, проєкт)'
                  : 'Lesson substitution or event (control work, test, essay, project)'
              }
            >
              <ArrowLeftRight size={14} />
            </button>
          </div>
        </div>
        
        <div className="text-xs text-text-muted flex items-center gap-1.5">
          <span className={cn(isCurrentLesson && "font-semibold text-accent")}>
            {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
          </span>
          {isCurrentLesson && (
            <span className="text-[10px] uppercase font-bold text-accent tracking-wider">• {t('lesson_now')}</span>
          )}
          {lesson.override_note && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">
              • {lesson.override_note}
            </span>
          )}
        </div>

        <div className="mt-1">
          {lesson.homework?.map((hw) => (
            <HomeworkInline
              key={hw.id}
              homework={hw}
              currentDate={lesson.date}
              currentLessonOrder={lesson.lesson_order}
              onFindNextLesson={onFindNextLesson}
              onFindPreviousLesson={onFindPreviousLesson}
            />
          ))}
          
          {isAddingHomework ? (
            <div 
              className="flex flex-col gap-2 mt-2 p-2 bg-bg-primary rounded border border-border"
              onPaste={handlePaste}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    language === 'uk'
                      ? 'Додати завдання, прикріпити PDF/PPTX або фото (Ctrl+V)...'
                      : 'Add task, attach PDF/PPTX or paste photo (Ctrl+V)...'
                  }
                  value={newHomework}
                  onChange={(e) => setNewHomework(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHomework();
                    if (e.key === 'Escape') {
                      setIsAddingHomework(false);
                      setAttachedImages([]);
                      setAttachedItems([]);
                    }
                  }}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  autoFocus
                />

                {/* Photo / PDF / PPT / PPTX file attachment button */}
                <label 
                  className="p-1 text-text-muted hover:text-accent cursor-pointer rounded hover:bg-bg-tertiary transition-colors" 
                  title={language === 'uk' ? 'Прикріпити PDF, PPTX або фото' : 'Attach PDF, PPTX or image'}
                >
                  <ImageIcon size={16} />
                  <input
                    type="file"
                    accept="image/*,application/pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {/* Link button for presentation / PDF URL */}
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="p-1 text-text-muted hover:text-accent rounded hover:bg-bg-tertiary transition-colors"
                  title={language === 'uk' ? 'Додати посилання на презентацію чи PDF' : 'Add link to presentation or PDF'}
                >
                  <LinkIcon size={16} />
                </button>

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
                    setAttachedItems([]);
                  }} 
                  className="text-text-muted hover:bg-bg-tertiary p-1 rounded transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Attached items (PDF / Presentation / Link chips) */}
              {attachedItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                  {attachedItems.map((item, idx) => (
                    <AttachmentChip
                      key={idx}
                      attachment={item}
                      onRemove={() => handleRemoveItem(idx)}
                    />
                  ))}
                </div>
              )}

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

      {/* Add link modal */}
      <AddLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onAdd={(newAtt) => setAttachedItems((prev) => [...prev, newAtt])}
      />

      {/* Lesson override substitution modal */}
      <LessonOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        lesson={lesson}
      />
    </div>
  );
}
