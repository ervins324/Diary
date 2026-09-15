import { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, BookOpen } from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useHomework } from '../hooks/useHomework';
import { fetchNextLesson, fetchPreviousLesson } from '../hooks/useScheduleOverrides';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { LessonCard } from '../components/schedule/LessonCard';
import { formatDate, getDefaultScheduleDate } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';

export function DailyPage() {
  const { t, language } = useLanguage();
  /* Initialize date with weekend auto-advance if today is Saturday/Sunday */
  const [currentDate, setCurrentDate] = useState(getDefaultScheduleDate);
  const [targetHighlightOrder, setTargetHighlightOrder] = useState<number | null>(null);

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const { data: schedule, isLoading } = useSchedule(dateStr, dateStr);

  const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
  const nextMonday = currentDate.getDay() === 6 ? addDays(currentDate, 2) : addDays(currentDate, 1);
  const nextFriday = addDays(nextMonday, 4);
  const nextMondayStr = format(nextMonday, 'yyyy-MM-dd');
  const nextFridayStr = format(nextFriday, 'yyyy-MM-dd');

  const { data: upcomingHomework = [] } = useHomework(
    undefined,
    undefined,
    isWeekend ? nextMondayStr : undefined,
    isWeekend ? nextFridayStr : undefined
  );
  const pendingWeekendHw = upcomingHomework.filter((h) => !h.is_completed);

  const handlePrevDay = useCallback(() => setCurrentDate((prev) => subDays(prev, 1)), []);
  const handleNextDay = useCallback(() => setCurrentDate((prev) => addDays(prev, 1)), []);
  const handleToday = useCallback(() => setCurrentDate(getDefaultScheduleDate()), []);

  /* Mobile touch swipe gesture handler */
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleNextDay,
    onSwipeRight: handlePrevDay,
  });

  /* Keyboard shortcuts for day navigation (ArrowLeft / ArrowRight / A / D / T) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        handlePrevDay();
      } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        handleNextDay();
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        handleToday();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevDay, handleNextDay, handleToday]);

  const currentDaySchedule = schedule?.[0];

  const getDayName = (date: Date) => {
    const day = date.getDay(); // 0 is Sun, 1 is Mon...
    const map: Record<number, any> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return t(map[day]);
  };

  /* Listen for global next lesson jump events */
  useEffect(() => {
    const handleNavigateAndHighlight = (e: Event) => {
      const customEvent = e as CustomEvent<{ date: string; lessonOrder: number; subjectId: string }>;
      if (!customEvent.detail) return;
      const { date: targetDateStr, lessonOrder } = customEvent.detail;
      setCurrentDate(parseISO(targetDateStr));
      setTargetHighlightOrder(lessonOrder);
    };

    window.addEventListener('diary:navigate-and-highlight', handleNavigateAndHighlight);
    return () => {
      window.removeEventListener('diary:navigate-and-highlight', handleNavigateAndHighlight);
    };
  }, []);

  /* Scroll and highlight targeted lesson once schedule data finishes loading */
  useEffect(() => {
    if (targetHighlightOrder !== null && !isLoading && currentDaySchedule) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`lesson-${targetHighlightOrder}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-accent', 'ring-offset-2', 'scale-[1.02]');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-accent', 'ring-offset-2', 'scale-[1.02]');
            setTargetHighlightOrder(null);
          }, 2500);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [targetHighlightOrder, isLoading, currentDaySchedule]);

  /* Handler when clicking locate next lesson button on any card */
  const handleFindNextLesson = async (subjectId: string, cDate?: string, cOrder?: number) => {
    try {
      const result = await fetchNextLesson(subjectId, cDate || dateStr, cOrder);
      if (!result) {
        alert(
          language === 'uk'
            ? 'Не знайдено наступного уроку для цього предмету.'
            : 'No upcoming lesson found for this subject.'
        );
        return;
      }
      setCurrentDate(parseISO(result.date));
      setTargetHighlightOrder(result.lesson_order);
    } catch (err) {
      console.error('Failed to locate next lesson:', err);
    }
  };

  /* Handler when clicking return to previous lesson button on any card */
  const handleFindPreviousLesson = async (subjectId: string, cDate?: string, cOrder?: number) => {
    try {
      const result = await fetchPreviousLesson(subjectId, cDate || dateStr, cOrder);
      if (!result) {
        alert(
          language === 'uk'
            ? 'Не знайдено попереднього уроку для цього предмету.'
            : 'No previous lesson found for this subject.'
        );
        return;
      }
      setCurrentDate(parseISO(result.date));
      setTargetHighlightOrder(result.lesson_order);
    } catch (err) {
      console.error('Failed to locate previous lesson:', err);
    }
  };

  return (
    <div
      {...swipeHandlers}
      className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full p-4 md:p-6 relative touch-pan-y"
    >
      {/* Header with date navigation, shortcut indicators, and swipe support */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <button
            onClick={handlePrevDay}
            className="p-2.5 rounded-full hover:bg-bg-tertiary active:scale-95 transition-all text-text-secondary hover:text-text-primary"
            title="← / A (Previous day)"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex flex-col items-center text-center">
            <h1 className="text-xl font-bold text-text-primary capitalize">
              {getDayName(currentDate)}
            </h1>
            <span className="text-sm text-text-muted">{formatDate(dateStr)}</span>
          </div>
          
          <button
            onClick={handleNextDay}
            className="p-2.5 rounded-full hover:bg-bg-tertiary active:scale-95 transition-all text-text-secondary hover:text-text-primary"
            title="→ / D (Next day)"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {currentDaySchedule?.week_type && (
            <span className="px-3 py-1 bg-bg-tertiary text-text-secondary rounded-full text-xs font-medium uppercase tracking-wider">
              {currentDaySchedule.week_type === 'numerator'
                ? t('numerator_week')
                : currentDaySchedule.week_type === 'denominator'
                ? t('denominator_week')
                : currentDaySchedule.week_type}
            </span>
          )}
          <button 
            onClick={handleToday}
            className="px-4 py-1.5 bg-bg-secondary border border-border rounded-md text-sm font-medium text-text-primary hover:bg-bg-tertiary active:scale-95 transition-all shadow-2xs"
            title="T (Jump to Today)"
          >
            {t('today')}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Holiday Banner if today is a school holiday */}
        {currentDaySchedule?.is_holiday && (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 border border-amber-500/30 flex items-center gap-3 shadow-xs">
            <span className="text-2xl">🏖️</span>
            <div>
              <h3 className="font-bold text-text-primary text-base">
                {currentDaySchedule.holiday_name || t('holiday_title')}
              </h3>
              <p className="text-xs text-text-muted">
                {t('holiday_no_lessons_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Weekend Homework Reminder Card */}
        {isWeekend && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="text-amber-500 shrink-0" size={20} />
                <div>
                  <h3 className="font-bold text-text-primary text-sm">
                    {t('weekend_hw_reminder_title')}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {pendingWeekendHw.length > 0
                      ? t('weekend_hw_reminder_desc').replace('{count}', String(pendingWeekendHw.length))
                      : t('weekend_hw_all_done')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentDate(nextMonday)}
                className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 rounded-lg font-medium transition-colors cursor-pointer"
              >
                {t('view_next_week')} →
              </button>
            </div>

            {pendingWeekendHw.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {pendingWeekendHw.slice(0, 4).map((hw) => (
                  <div key={hw.id} className="p-2.5 bg-bg-primary rounded-lg border border-border/80 flex items-start gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: hw.subject?.color_hex || 'var(--color-accent)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-text-primary truncate">{hw.subject?.name}</span>
                        <span className="text-[10px] text-text-muted shrink-0">{formatDate(hw.due_date)}</span>
                      </div>
                      <p className="text-text-secondary truncate mt-0.5">{hw.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : !currentDaySchedule || currentDaySchedule.lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-text-muted text-lg mb-2">{t('no_lessons_scheduled')}</p>
            <p className="text-sm text-text-secondary">{t('take_a_break')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentDaySchedule.lessons.map((lesson) => (
              <LessonCard
                key={lesson.lesson_order}
                lesson={lesson}
                onFindNextLesson={handleFindNextLesson}
                onFindPreviousLesson={handleFindPreviousLesson}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
