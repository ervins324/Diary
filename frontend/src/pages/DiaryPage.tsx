import { useState, useEffect, useRef } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Plus, Check, X, Image as ImageIcon, ArrowLeftRight, Compass, RotateCcw, Link as LinkIcon } from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useCreateHomework } from '../hooks/useHomework';
import { useFileUpload } from '../hooks/useFileUpload';
import { fetchNextLesson, fetchPreviousLesson } from '../hooks/useScheduleOverrides';
import { getWeekDates, formatTime, cn, getDefaultScheduleDate, compressImageFile, isLessonNow } from '../lib/utils';
import { HomeworkInline } from '../components/homework/HomeworkInline';
import { AttachmentChip } from '../components/homework/AttachmentChip';
import { AddLinkModal } from '../components/homework/AddLinkModal';
import { LessonOverrideModal } from '../components/schedule/LessonOverrideModal';
import { useLanguage } from '../i18n/LanguageContext';
import type { DaySchedule, LessonSlot, Attachment } from '../types';

export function DiaryPage() {
  const { t, language } = useLanguage();
  /* Initialize week view with weekend auto-advance if today is Saturday/Sunday */
  const [currentDate, setCurrentDate] = useState(getDefaultScheduleDate);
  
  const { start, end } = getWeekDates(currentDate);
  const { data: schedule, isLoading } = useSchedule(start, end);
  const createMutation = useCreateHomework();
  const uploadMutation = useFileUpload();

  /* Target highlight lesson state */
  const [targetHighlight, setTargetHighlight] = useState<{ date: string; lessonOrder: number } | null>(null);

  /* Inline homework creation state — tracks which lesson slot is being added to */
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [newHwText, setNewHwText] = useState('');
  const [newHwImages, setNewHwImages] = useState<string[]>([]);
  const [newHwAttachments, setNewHwAttachments] = useState<Attachment[]>([]);
  const [isHwLinkModalOpen, setIsHwLinkModalOpen] = useState(false);

  /* Active lesson for substitution modal */
  const [overrideLesson, setOverrideLesson] = useState<LessonSlot | null>(null);

  /* Container ref for mobile horizontal swipe container */
  const mobileContainerRef = useRef<HTMLDivElement>(null);

  const handlePrevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));
  const handleCurrentWeek = () => setCurrentDate(getDefaultScheduleDate());

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  /* Submit new homework for a lesson in diary view */
  const handleAddHomework = (lesson: LessonSlot) => {
    if (newHwText.trim() || newHwImages.length > 0 || newHwAttachments.length > 0) {
      createMutation.mutate(
        {
          subject_id: lesson.subject.id,
          due_date: lesson.date,
          lesson_order: lesson.lesson_order,
          text:
            newHwText.trim() ||
            (language === 'uk' ? 'Прикріплені матеріали' : 'Attached materials'),
          images: newHwImages,
          attachments: newHwAttachments,
        },
        {
          onSuccess: () => {
            setAddingKey(null);
            setNewHwText('');
            setNewHwImages([]);
            setNewHwAttachments([]);
          },
        }
      );
    } else {
      setAddingKey(null);
    }
  };

  /* Compress and attach images or upload PDFs / PPT / PPTX presentations selected via file browser */
  const handleHwFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setNewHwAttachments((prev) => [
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
          setNewHwImages((prev) => [...prev, compressed]);
        } catch (err) {
          console.error('Failed to compress image:', err);
        }
      }
    }
    e.target.value = '';
  };

  /* Intercept Ctrl+V clipboard paste to directly attach copied images */
  const handleHwPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImageFile(file);
            setNewHwImages((prev) => [...prev, compressed]);
          } catch (err) {
            console.error('Failed to compress pasted image:', err);
          }
        }
      }
    }
  };

  /* Locate next lesson closest to today and jump to it */
  const handleLocateNext = async (subjectId: string, cDate?: string, cOrder?: number) => {
    try {
      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const result = await fetchNextLesson(subjectId, cDate || todayIso, cOrder);
      if (!result) {
        alert(
          language === 'uk'
            ? 'Не знайдено наступного уроку для цього предмету.'
            : 'No upcoming lesson found for this subject.'
        );
        return;
      }
      // If outside currently viewed week, navigate week to target date
      if (result.date < start || result.date > end) {
        setCurrentDate(parseISO(result.date));
      }
      setTargetHighlight({ date: result.date, lessonOrder: result.lesson_order });
    } catch (err) {
      console.error('Failed to locate next lesson:', err);
    }
  };

  /* Return to previous lesson of this subject and jump to it */
  const handleLocatePrevious = async (subjectId: string, cDate?: string, cOrder?: number) => {
    try {
      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const result = await fetchPreviousLesson(subjectId, cDate || todayIso, cOrder);
      if (!result) {
        alert(
          language === 'uk'
            ? 'Не знайдено попереднього уроку для цього предмету.'
            : 'No previous lesson found for this subject.'
        );
        return;
      }
      // If outside currently viewed week, navigate week to target date
      if (result.date < start || result.date > end) {
        setCurrentDate(parseISO(result.date));
      }
      setTargetHighlight({ date: result.date, lessonOrder: result.lesson_order });
    } catch (err) {
      console.error('Failed to locate previous lesson:', err);
    }
  };

  /* Listen for global next lesson jump events */
  useEffect(() => {
    const handleGlobalJump = (e: Event) => {
      const customEvent = e as CustomEvent<{ date: string; lessonOrder: number; subjectId: string }>;
      if (!customEvent.detail) return;
      const { date: targetDateStr, lessonOrder } = customEvent.detail;
      if (targetDateStr < start || targetDateStr > end) {
        setCurrentDate(parseISO(targetDateStr));
      }
      setTargetHighlight({ date: targetDateStr, lessonOrder });
    };

    window.addEventListener('diary:navigate-and-highlight', handleGlobalJump);
    return () => {
      window.removeEventListener('diary:navigate-and-highlight', handleGlobalJump);
    };
  }, [start, end]);

  /* Smoothly scroll to targeted lesson in diary view and highlight */
  useEffect(() => {
    if (targetHighlight && !isLoading && schedule) {
      const timer = setTimeout(() => {
        const targetId = `diary-lesson-${targetHighlight.date}-${targetHighlight.lessonOrder}`;
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          el.classList.add('ring-4', 'ring-accent', 'ring-offset-2', 'scale-[1.02]');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-accent', 'ring-offset-2', 'scale-[1.02]');
            setTargetHighlight(null);
          }, 2500);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [targetHighlight, isLoading, schedule]);

  // Helper to get day data
  const getDayData = (index: number): DaySchedule | undefined => {
    return schedule?.find((day) => {
      try {
        const d = parseISO(day.date);
        let dayOfWeek = d.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7; // Treat Sun as 7
        return dayOfWeek - 1 === index;
      } catch {
        return false;
      }
    });
  };

  // 5 days: Monday through Friday (Saturday excluded as requested)
  const dayKeys: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'> = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ];
  // 3 days in left column (Mon, Tue, Wed), 2 days in right column (Thu, Fri)
  const leftColDays = [0, 1, 2];
  const rightColDays = [3, 4];

  const renderDayCard = (dayIndex: number, dayKey: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday') => {
    const dayData = getDayData(dayIndex);
    const isToday = dayData?.date === todayStr;

    return (
      <div 
        key={dayIndex} 
        id={`diary-day-${dayData?.date || dayIndex}`}
        className={cn(
          "bg-bg-secondary rounded-lg border flex flex-col min-h-[250px] snap-center w-full shrink-0 transition-shadow",
          isToday ? "border-accent shadow-xs" : "border-border"
        )}
      >
        <div className={cn(
          "px-4 py-2 border-b border-border flex justify-between items-center rounded-t-lg",
          isToday ? "bg-accent-light text-accent" : "bg-bg-tertiary text-text-primary"
        )}>
          <span className="font-semibold">{t(dayKey)}</span>
          {dayData?.date && (
            <span className="text-sm opacity-80">{format(parseISO(dayData.date), 'dd.MM')}</span>
          )}
        </div>
        
        <div className="p-2 flex-1 flex flex-col gap-1 overflow-y-auto">
          {!dayData || dayData.lessons.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-text-muted italic">
              {t('no_lessons')}
            </div>
          ) : (
            dayData.lessons.map((lesson: LessonSlot) => {
              const isCurrent = isLessonNow(lesson.start_time, lesson.end_time, dayData.date);
              const lessonElementId = `diary-lesson-${dayData.date}-${lesson.lesson_order}`;

              return (
                <div 
                  key={lesson.lesson_order} 
                  id={lessonElementId}
                  className={cn(
                    "flex gap-2 py-1.5 px-1.5 rounded-md border-b border-border-light last:border-0 text-sm transition-all duration-300",
                    isCurrent && "bg-accent/10 border border-accent/40 shadow-2xs ring-1 ring-accent/30",
                    lesson.is_override && !isCurrent && !lesson.event_type && "bg-amber-500/5 border border-amber-500/30",
                    lesson.event_type === 'control_work' && "bg-rose-500/5 border border-rose-500/30",
                    lesson.event_type === 'test' && "bg-amber-500/5 border border-amber-500/30",
                    lesson.event_type === 'essay' && "bg-purple-500/5 border border-purple-500/30",
                    lesson.event_type === 'project' && "bg-sky-500/5 border border-sky-500/30",
                    lesson.is_cancelled && "opacity-75 bg-bg-tertiary/50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center font-medium text-xs shrink-0 self-start mt-0.5",
                    isCurrent ? "bg-accent text-white font-bold" : "text-text-muted bg-bg-tertiary"
                  )}>
                    {lesson.lesson_order}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between items-baseline gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{
                            backgroundColor: lesson.is_cancelled
                              ? '#94A3B8'
                              : lesson.subject.color_hex || 'var(--color-accent)',
                          }}
                          title={lesson.subject.name}
                        />

                        {/* Substituted lesson rendering: Changed lesson and original in brackets */}
                        {lesson.is_cancelled ? (
                          <span className="font-semibold text-text-muted line-through truncate">
                            {language === 'uk' ? 'Скасовано' : 'Cancelled'}
                            {lesson.original_subject && (
                              <span className="ml-1 text-xs text-text-muted font-normal no-underline inline-block">
                                ({lesson.original_subject.name})
                              </span>
                            )}
                          </span>
                        ) : lesson.is_override && lesson.original_subject ? (
                          <div className="flex items-baseline gap-1 truncate">
                            <span className="font-bold text-text-primary truncate">
                              {lesson.subject.name}
                            </span>
                            <span className="text-xs text-text-muted font-medium shrink-0">
                              ({lesson.original_subject.name})
                            </span>
                            <span className="inline-flex items-center text-[9px] px-1 py-0.2 rounded font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                              {language === 'uk' ? 'Заміна' : 'Sub'}
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-text-primary truncate">
                            {lesson.subject.name}
                          </span>
                        )}

                        {/* Event type badge (Control Work, Test, Essay, Project) */}
                        {lesson.event_type && (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded font-bold border shrink-0",
                            lesson.event_type === 'control_work' && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
                            lesson.event_type === 'test' && "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
                            lesson.event_type === 'essay' && "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
                            lesson.event_type === 'project' && "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
                          )}>
                            {lesson.event_type === 'control_work' && `🔥 ${t('event_control_work')}`}
                            {lesson.event_type === 'test' && `📝 ${t('event_test')}`}
                            {lesson.event_type === 'essay' && `✍️ ${t('event_essay')}`}
                            {lesson.event_type === 'project' && `🚀 ${t('event_project')}`}
                          </span>
                        )}

                        {isCurrent && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-accent text-white shrink-0 animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                            {t('now')}
                          </span>
                        )}
                      </div>

                      {/* Right actions: Cabinet & Quick Substitution / Locate icons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {lesson.cabinet && !lesson.is_cancelled && localStorage.getItem('show_cabinets') !== 'false' && (
                          <span className="text-xs text-text-muted whitespace-nowrap">
                            {t('cabinet_short')} {lesson.cabinet}
                          </span>
                        )}

                        {/* Locate previous lesson button */}
                        <button
                          type="button"
                          onClick={() => handleLocatePrevious(lesson.subject.id, dayData.date, lesson.lesson_order)}
                          className="text-text-muted hover:text-accent p-0.5 rounded transition-colors"
                          title={
                            language === 'uk'
                              ? 'Повернутися до попереднього уроку цього предмету'
                              : 'Return to previous lesson of this subject'
                          }
                        >
                          <RotateCcw size={12} />
                        </button>

                        {/* Locate next lesson button */}
                        <button
                          type="button"
                          onClick={() => handleLocateNext(lesson.subject.id, dayData.date, lesson.lesson_order)}
                          className="text-text-muted hover:text-accent p-0.5 rounded transition-colors"
                          title={
                            language === 'uk'
                              ? 'Знайти найближчий наступний урок цього предмету'
                              : 'Find next lesson closest to today'
                          }
                        >
                          <Compass size={12} />
                        </button>

                        {/* Lesson override / event button */}
                        <button
                          type="button"
                          onClick={() => setOverrideLesson(lesson)}
                          className={cn(
                            "p-0.5 rounded transition-colors",
                            lesson.event_type === 'control_work'
                              ? "text-rose-500 hover:bg-rose-500/10"
                              : lesson.event_type
                              ? "text-accent hover:bg-accent/10"
                              : lesson.is_override
                              ? "text-amber-500 hover:bg-amber-500/10"
                              : "text-text-muted hover:text-accent"
                          )}
                          title={
                            language === 'uk'
                              ? 'Заміна або подія уроку (контрольна, тест, твір, проєкт)'
                              : 'Lesson substitution or event (control work, test, essay, project)'
                          }
                        >
                          <ArrowLeftRight size={12} />
                        </button>
                      </div>
                    </div>

                    <div className={cn("text-[11px] text-text-muted", isCurrent && "text-accent font-medium")}>
                      {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                      {lesson.override_note && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400 italic">
                          • {lesson.override_note}
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 pl-1 border-l-2 border-border-light">
                      {lesson.homework?.map((hw) => (
                        <HomeworkInline
                          key={hw.id}
                          homework={hw}
                          currentDate={dayData?.date}
                          currentLessonOrder={lesson.lesson_order}
                          onFindNextLesson={handleLocateNext}
                          onFindPreviousLesson={handleLocatePrevious}
                        />
                      ))}
                      {(!lesson.homework || lesson.homework.length === 0) && addingKey !== `${dayData?.date}-${lesson.lesson_order}` && (
                        <span className="text-xs text-text-muted italic">{t('no_homework')}</span>
                      )}

                      {/* Inline homework creation form */}
                      {addingKey === `${dayData?.date}-${lesson.lesson_order}` ? (
                        <div className="flex flex-col gap-1.5 mt-1 p-1.5 bg-bg-primary rounded border border-border" onPaste={handleHwPaste}>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder={language === 'uk' ? 'Д/З (або Ctrl+V фото)...' : 'Homework (or Ctrl+V photo)...'}
                              value={newHwText}
                              onChange={(e) => setNewHwText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddHomework(lesson);
                                if (e.key === 'Escape') {
                                  setAddingKey(null);
                                  setNewHwImages([]);
                                  setNewHwAttachments([]);
                                }
                              }}
                              className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
                              autoFocus
                            />

                            {/* Photo / PDF / PPT / PPTX file attachment button */}
                            <label
                              className="p-0.5 text-text-muted hover:text-accent cursor-pointer rounded hover:bg-bg-tertiary transition-colors"
                              title={language === 'uk' ? 'Прикріпити PDF, PPTX або фото' : 'Attach PDF, PPTX or image'}
                            >
                              <ImageIcon size={13} />
                              <input
                                type="file"
                                accept="image/*,application/pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                multiple
                                onChange={handleHwFileChange}
                                className="hidden"
                              />
                            </label>

                            {/* Add presentation / PDF link button */}
                            <button
                              type="button"
                              onClick={() => setIsHwLinkModalOpen(true)}
                              className="p-0.5 text-text-muted hover:text-accent rounded hover:bg-bg-tertiary transition-colors"
                              title={language === 'uk' ? 'Додати посилання' : 'Add link'}
                            >
                              <LinkIcon size={13} />
                            </button>

                            <button onClick={() => handleAddHomework(lesson)} className="text-success hover:bg-success/10 p-0.5 rounded transition-colors" title="Save">
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setAddingKey(null);
                                setNewHwText('');
                                setNewHwImages([]);
                                setNewHwAttachments([]);
                              }}
                              className="text-text-muted hover:bg-bg-tertiary p-0.5 rounded transition-colors"
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Attached items (PDF / Presentation / Link chips) */}
                          {newHwAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                              {newHwAttachments.map((item, idx) => (
                                <AttachmentChip
                                  key={idx}
                                  attachment={item}
                                  onRemove={() => setNewHwAttachments((p) => p.filter((_, i) => i !== idx))}
                                />
                              ))}
                            </div>
                          )}

                          {/* Attached image thumbnails */}
                          {newHwImages.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                              {newHwImages.map((img, idx) => (
                                <div key={idx} className="relative w-10 h-10 rounded border border-border overflow-hidden">
                                  <img src={img} alt={`att-${idx}`} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setNewHwImages((p) => p.filter((_, i) => i !== idx))}
                                    className="absolute top-0 right-0 bg-danger/80 text-white rounded-bl p-0.5"
                                  >
                                    <X size={8} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingKey(`${dayData?.date}-${lesson.lesson_order}`);
                            setNewHwText('');
                            setNewHwImages([]);
                            setNewHwAttachments([]);
                          }}
                          className="mt-1 flex items-center gap-0.5 text-[11px] text-text-muted hover:text-accent transition-colors"
                        >
                          <Plus size={11} /> {t('add_homework') || 'Add HW'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-6xl mx-auto w-full p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <button onClick={handlePrevWeek} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
          <ChevronLeft size={24} className="text-text-secondary" />
        </button>
        
        <div className="flex flex-col items-center text-center cursor-pointer" onClick={handleCurrentWeek}>
          <h1 className="text-xl font-bold text-text-primary">{t('week')}</h1>
          <span className="text-sm text-text-muted">
            {format(parseISO(start), 'MMM d')} - {format(parseISO(end), 'MMM d, yyyy')}
          </span>
        </div>
        
        <button onClick={handleNextWeek} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
          <ChevronRight size={24} className="text-text-secondary" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex justify-center items-center">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : (
          <>
            {/* Desktop View (Mon-Wed left, Thu-Fri right) */}
            <div className="hidden md:grid grid-cols-2 gap-6 h-full items-start">
              <div className="flex flex-col gap-4">
                {leftColDays.map((index) => renderDayCard(index, dayKeys[index]))}
              </div>
              <div className="flex flex-col gap-4">
                {rightColDays.map((index) => renderDayCard(index, dayKeys[index]))}
              </div>
            </div>

            {/* Mobile View */}
            <div
              ref={mobileContainerRef}
              className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 h-full w-full"
            >
              {dayKeys.map((dayKey, index) => (
                <div key={index} className="w-full shrink-0 snap-center">
                  {renderDayCard(index, dayKey)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add link modal for diary homework inline form */}
      <AddLinkModal
        isOpen={isHwLinkModalOpen}
        onClose={() => setIsHwLinkModalOpen(false)}
        onAdd={(newAtt) => setNewHwAttachments((prev) => [...prev, newAtt])}
      />

      {/* Substitution Override Modal */}
      {overrideLesson && (
        <LessonOverrideModal
          isOpen={true}
          onClose={() => setOverrideLesson(null)}
          lesson={overrideLesson}
        />
      )}
    </div>
  );
}
