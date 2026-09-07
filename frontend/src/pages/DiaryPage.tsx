import { useState } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Plus, Check, X, Image as ImageIcon } from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useCreateHomework } from '../hooks/useHomework';
import { getWeekDates, formatTime, cn, getDefaultScheduleDate, compressImageFile, isLessonNow } from '../lib/utils';
import { HomeworkInline } from '../components/homework/HomeworkInline';
import { useLanguage } from '../i18n/LanguageContext';
import type { DaySchedule, LessonSlot } from '../types';

export function DiaryPage() {
  const { t, language } = useLanguage();
  /* Initialize week view with weekend auto-advance if today is Saturday/Sunday */
  const [currentDate, setCurrentDate] = useState(getDefaultScheduleDate);
  
  const { start, end } = getWeekDates(currentDate);
  const { data: schedule, isLoading } = useSchedule(start, end);
  const createMutation = useCreateHomework();

  /* Inline homework creation state — tracks which lesson slot is being added to */
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [newHwText, setNewHwText] = useState('');
  const [newHwImages, setNewHwImages] = useState<string[]>([]);

  const handlePrevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));
  const handleCurrentWeek = () => setCurrentDate(getDefaultScheduleDate());

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  /* Submit new homework for a lesson in diary view */
  const handleAddHomework = (lesson: LessonSlot) => {
    if (newHwText.trim() || newHwImages.length > 0) {
      createMutation.mutate(
        {
          subject_id: lesson.subject.id,
          due_date: lesson.date,
          lesson_order: lesson.lesson_order,
          text: newHwText.trim() || (language === 'uk' ? 'Фото завдання' : 'Photo attachment'),
          images: newHwImages,
        },
        { onSuccess: () => { setAddingKey(null); setNewHwText(''); setNewHwImages([]); } }
      );
    } else {
      setAddingKey(null);
    }
  };

  /* Compress and attach images selected via file browser */
  const handleHwFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImageFile(files[i]);
        setNewHwImages((prev) => [...prev, compressed]);
      } catch (err) { console.error('Failed to compress image:', err); }
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
          } catch (err) { console.error('Failed to compress pasted image:', err); }
        }
      }
    }
  };

  // Helper to get day data
  const getDayData = (index: number): DaySchedule | undefined => {
    return schedule?.find(day => {
      try {
        // Assume date is 'yyyy-MM-dd', parse it to get weekday (1=Mon..5=Fri)
        // Note: JS Date getDay: 0=Sun, 1=Mon. Our index is 0..4 (Mon..Fri).
        const d = parseISO(day.date);
        let dayOfWeek = d.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7; // Treat Sun as 7
        return dayOfWeek - 1 === index;
      } catch (e) {
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
        className={cn(
          "bg-bg-secondary rounded-lg border flex flex-col min-h-[250px] snap-center w-full shrink-0",
          isToday ? "border-accent shadow-sm" : "border-border"
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
              return (
                <div 
                  key={lesson.lesson_order} 
                  className={cn(
                    "flex gap-2 py-1.5 px-1.5 rounded-md border-b border-border-light last:border-0 text-sm transition-all duration-300",
                    isCurrent && "bg-accent/10 border border-accent/40 shadow-xs ring-1 ring-accent/30"
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
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: lesson.subject.color_hex || 'var(--color-accent)' }}
                          title={lesson.subject.name}
                        />
                        <span className="font-semibold text-text-primary truncate">
                          {lesson.subject.name}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-accent text-white shrink-0 animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                            {t('now')}
                          </span>
                        )}
                      </div>
                      {lesson.cabinet && (
                        <span className="text-xs text-text-muted whitespace-nowrap">{t('cabinet_short')} {lesson.cabinet}</span>
                      )}
                    </div>
                    <div className={cn("text-[11px] text-text-muted", isCurrent && "text-accent font-medium")}>
                      {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                    </div>
                    <div className="mt-0.5 pl-1 border-l-2 border-border-light">
                    {lesson.homework?.map((hw) => (
                      <HomeworkInline key={hw.id} homework={hw} />
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
                              if (e.key === 'Escape') { setAddingKey(null); setNewHwImages([]); }
                            }}
                            className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
                            autoFocus
                          />
                          <label className="p-0.5 text-text-muted hover:text-accent cursor-pointer rounded hover:bg-bg-tertiary transition-colors" title={language === 'uk' ? 'Прикріпити фото' : 'Attach image'}>
                            <ImageIcon size={13} />
                            <input type="file" accept="image/*" multiple onChange={handleHwFileChange} className="hidden" />
                          </label>
                          <button onClick={() => handleAddHomework(lesson)} className="text-success hover:bg-success/10 p-0.5 rounded transition-colors"><Check size={13} /></button>
                          <button onClick={() => { setAddingKey(null); setNewHwText(''); setNewHwImages([]); }} className="text-text-muted hover:bg-bg-tertiary p-0.5 rounded transition-colors"><X size={13} /></button>
                        </div>
                        {/* Attached image thumbnails */}
                        {newHwImages.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                            {newHwImages.map((img, idx) => (
                              <div key={idx} className="relative w-10 h-10 rounded border border-border overflow-hidden">
                                <img src={img} alt={`att-${idx}`} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => setNewHwImages(p => p.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-danger/80 text-white rounded-bl p-0.5"><X size={8} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingKey(`${dayData?.date}-${lesson.lesson_order}`); setNewHwText(''); setNewHwImages([]); }}
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
                {leftColDays.map(index => renderDayCard(index, dayKeys[index]))}
              </div>
              <div className="flex flex-col gap-4">
                {rightColDays.map(index => renderDayCard(index, dayKeys[index]))}
              </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 h-full w-full">
              {dayKeys.map((dayKey, index) => (
                <div key={index} className="w-full shrink-0 snap-center">
                  {renderDayCard(index, dayKey)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
