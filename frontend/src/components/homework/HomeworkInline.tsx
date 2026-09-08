import { useState, useEffect, useRef } from 'react';
import { Check, X, Edit2, Trash2, Image as ImageIcon, Compass, RotateCcw, Link as LinkIcon, Loader2, Timer, Play, Pause, RotateCcw as ResetIcon } from 'lucide-react';
import { useUpdateHomework, useDeleteHomework } from '../../hooks/useHomework';
import { useFileUpload } from '../../hooks/useFileUpload';
import { fetchNextLesson, fetchPreviousLesson } from '../../hooks/useScheduleOverrides';
import type { HomeworkEntry, Attachment } from '../../types';
import { cn, compressImageFile } from '../../lib/utils';
import { AttachmentChip } from './AttachmentChip';
import { AddLinkModal } from './AddLinkModal';
import { useLanguage } from '../../i18n/LanguageContext';

interface HomeworkInlineProps {
  homework: HomeworkEntry;
  currentDate?: string;
  currentLessonOrder?: number;
  onFindNextLesson?: (subjectId: string, currentDate?: string, currentLessonOrder?: number) => void;
  onFindPreviousLesson?: (subjectId: string, currentDate?: string, currentLessonOrder?: number) => void;
}

/**
 * Inline homework display within a LessonCard.
 * Shows completion toggle, text, attached image thumbnails with lightbox,
 * PDF and presentation chips, edit/delete/locate actions on hover,
 * and an integrated study stopwatch timer.
 */
export function HomeworkInline({
  homework,
  currentDate,
  currentLessonOrder,
  onFindNextLesson,
  onFindPreviousLesson,
}: HomeworkInlineProps) {
  const { language, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  /* Use homework.text to match backend HomeworkRead schema */
  const [editText, setEditText] = useState(homework.text);
  /* Editable images array */
  const [editImages, setEditImages] = useState<string[]>(homework.images || []);
  /* Editable attachments array */
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(homework.attachments || []);
  /* State for lightbox modal */
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  /* State for add link modal */
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  /* Locating status */
  const [isLocating, setIsLocating] = useState(false);
  const [isLocatingPrev, setIsLocatingPrev] = useState(false);

  /* Stopwatch state */
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsSpent, setSecondsSpent] = useState<number>(homework.time_spent_seconds || 0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial seconds if homework prop updates from server
  useEffect(() => {
    if (!timerRunning && homework.time_spent_seconds !== undefined) {
      setSecondsSpent(homework.time_spent_seconds || 0);
    }
  }, [homework.time_spent_seconds, timerRunning]);

  // Stopwatch ticking effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setSecondsSpent((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  const updateMutation = useUpdateHomework();
  const deleteMutation = useDeleteHomework();
  const uploadMutation = useFileUpload();

  /* Toggle the completion status */
  const handleToggle = () => {
    updateMutation.mutate({ id: homework.id, data: { is_completed: !homework.is_completed } });
  };

  /* Format seconds to mm:ss or hh:mm:ss */
  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /* Save stopwatch time to backend */
  const handleSaveTimer = (newSeconds: number) => {
    updateMutation.mutate({
      id: homework.id,
      data: { time_spent_seconds: newSeconds },
    });
  };

  /* Toggle stopwatch running/pause */
  const handleToggleTimer = () => {
    if (timerRunning) {
      // Pausing: save current time
      setTimerRunning(false);
      handleSaveTimer(secondsSpent);
    } else {
      setTimerRunning(true);
    }
  };

  /* Reset stopwatch */
  const handleResetTimer = () => {
    setTimerRunning(false);
    setSecondsSpent(0);
    handleSaveTimer(0);
  };

  /* Save edited text, images, and attachments */
  const handleSave = () => {
    const hasTextChanged = editText.trim() !== homework.text;
    const hasImagesChanged = JSON.stringify(editImages) !== JSON.stringify(homework.images || []);
    const hasAttachmentsChanged = JSON.stringify(editAttachments) !== JSON.stringify(homework.attachments || []);
    if (hasTextChanged || hasImagesChanged || hasAttachmentsChanged) {
      updateMutation.mutate({
        id: homework.id,
        data: {
          text: editText.trim(),
          images: editImages,
          attachments: editAttachments,
        },
      });
    }
    setIsEditing(false);
  };

  /* Delete with confirmation */
  const handleDelete = () => {
    if (confirm(language === 'uk' ? 'Видалити це домашнє завдання?' : 'Delete this homework?')) {
      deleteMutation.mutate(homework.id);
    }
  };

  /* Handle locating the closest next lesson to today for this subject */
  const handleLocateNext = async () => {
    const targetDate = currentDate || homework.due_date;
    const targetOrder = currentLessonOrder ?? (homework.lesson_order ?? undefined);
    if (onFindNextLesson) {
      onFindNextLesson(homework.subject_id, targetDate, targetOrder);
      return;
    }
    try {
      setIsLocating(true);
      const result = await fetchNextLesson(homework.subject_id, targetDate, targetOrder);
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

  /* Handle returning to the previous lesson for this subject */
  const handleLocatePrevious = async () => {
    const targetDate = currentDate || homework.due_date;
    const targetOrder = currentLessonOrder ?? (homework.lesson_order ?? undefined);
    if (onFindPreviousLesson) {
      onFindPreviousLesson(homework.subject_id, targetDate, targetOrder);
      return;
    }
    try {
      setIsLocatingPrev(true);
      const result = await fetchPreviousLesson(homework.subject_id, targetDate, targetOrder);
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

  /* Handle file upload during edit mode (supports PDF documents, PPT/PPTX presentations, and images) */
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
          setEditAttachments((prev) => [
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
          setEditImages((prev) => [...prev, compressed]);
        } catch (err) {
          console.error('Failed to compress image:', err);
        }
      }
    }
    e.target.value = '';
  };

  /* Remove an image during edit */
  const handleRemoveImage = (indexToRemove: number) => {
    setEditImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  /* Remove an attachment during edit */
  const handleRemoveAttachment = (indexToRemove: number) => {
    setEditAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
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
          {/* Add image, PDF or PPT/PPTX file button */}
          <label
            className="p-1 text-text-muted hover:text-accent cursor-pointer rounded hover:bg-bg-tertiary transition-colors"
            title={language === 'uk' ? 'Прикріпити PDF, PPTX або зображення' : 'Attach PDF, PPTX or image'}
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

          {/* Add presentation / PDF link button */}
          <button
            type="button"
            onClick={() => setIsLinkModalOpen(true)}
            className="p-1 text-text-muted hover:text-accent rounded hover:bg-bg-tertiary transition-colors"
            title={language === 'uk' ? 'Додати посилання (Презентація/PDF/Сайт)' : 'Add link (Presentation/PDF/Web)'}
          >
            <LinkIcon size={16} />
          </button>

          <button onClick={handleSave} className="text-success hover:bg-success/10 p-1 rounded" title="Save">
            <Check size={16} />
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditImages(homework.images || []);
              setEditAttachments(homework.attachments || []);
              setEditText(homework.text);
            }}
            className="text-text-muted hover:bg-bg-tertiary p-1 rounded"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Attachment chips in edit mode */}
        {editAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {editAttachments.map((att, idx) => (
              <AttachmentChip
                key={idx}
                attachment={att}
                onRemove={() => handleRemoveAttachment(idx)}
                onClickImage={(url) => setLightboxImage(url)}
              />
            ))}
          </div>
        )}

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

        {/* Add link modal */}
        <AddLinkModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onAdd={(newAtt) => setEditAttachments((prev) => [...prev, newAtt])}
        />
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
          {/* Edit/delete actions, locate previous/next lesson, and stopwatch buttons — visible on hover and touch */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            {/* Stopwatch toggle button */}
            <button
              onClick={() => setIsTimerOpen((prev) => !prev)}
              className={cn(
                "p-1 transition-colors rounded",
                timerRunning ? "text-accent animate-pulse" : (secondsSpent > 0 ? "text-accent/80 hover:text-accent" : "text-text-muted hover:text-accent")
              )}
              title={t('hw_timer_label')}
            >
              <Timer size={12} />
            </button>
            {/* Locate previous lesson button */}
            <button
              onClick={handleLocatePrevious}
              disabled={isLocatingPrev}
              className="text-text-muted hover:text-accent p-1 transition-colors"
              title={
                language === 'uk'
                  ? 'Повернутися до попереднього уроку цього предмету'
                  : 'Return to previous lesson of this subject'
              }
            >
              {isLocatingPrev ? <Loader2 size={12} className="animate-spin text-accent" /> : <RotateCcw size={12} />}
            </button>
            {/* Locate next lesson button */}
            <button
              onClick={handleLocateNext}
              disabled={isLocating}
              className="text-text-muted hover:text-accent p-1 transition-colors"
              title={
                language === 'uk'
                  ? 'Перейти та підсвітити наступний урок (найближчий до сьогодні)'
                  : 'Locate & highlight next lesson closest to today'
              }
            >
              {isLocating ? <Loader2 size={12} className="animate-spin text-accent" /> : <Compass size={12} />}
            </button>
            <button onClick={() => setIsEditing(true)} className="text-text-muted hover:text-accent p-1" title="Edit">
              <Edit2 size={12} />
            </button>
            <button onClick={handleDelete} className="text-text-muted hover:text-danger p-1" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Stopwatch Active Controls or Saved Time Chip */}
        {(isTimerOpen || timerRunning || secondsSpent > 0) && (
          <div className="flex items-center gap-2 pl-6 py-0.5 text-xs">
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono",
              timerRunning
                ? "bg-accent/15 border-accent/40 text-accent"
                : "bg-bg-tertiary border-border text-text-muted"
            )}>
              <Timer size={11} className={timerRunning ? "animate-spin" : ""} />
              <span>{formatTime(secondsSpent)}</span>
            </div>

            {/* Stopwatch controls when opened or running */}
            {(isTimerOpen || timerRunning) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleTimer}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                    timerRunning
                      ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
                      : "bg-accent/20 text-accent hover:bg-accent/30"
                  )}
                >
                  {timerRunning ? <><Pause size={11} /> {t('hw_timer_pause')}</> : <><Play size={11} /> {t('hw_timer_start')}</>}
                </button>
                {secondsSpent > 0 && !timerRunning && (
                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="p-1 text-text-muted hover:text-danger rounded transition-colors"
                    title={t('hw_timer_reset')}
                  >
                    <ResetIcon size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Display attached PDF / Presentation / Link chips */}
        {homework.attachments && homework.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-6 pt-0.5">
            {homework.attachments.map((att, idx) => (
              <AttachmentChip
                key={idx}
                attachment={att}
                onClickImage={(url) => setLightboxImage(url)}
              />
            ))}
          </div>
        )}

        {/* Display attached image thumbnails */}
        {homework.images && homework.images.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-6 pt-0.5">
            {homework.images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setLightboxImage(imgUrl)}
                className="relative rounded border border-border overflow-hidden hover:opacity-85 focus:outline-none focus:ring-1 focus:ring-accent transition shadow-2xs"
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
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
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
