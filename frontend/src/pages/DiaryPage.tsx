import { useState } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { getWeekDates, formatTime, cn } from '../lib/utils';
import { HomeworkInline } from '../components/homework/HomeworkInline';
import { useLanguage } from '../i18n/LanguageContext';
import type { DaySchedule, LessonSlot } from '../types';

export function DiaryPage() {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { start, end } = getWeekDates(currentDate);
  const { data: schedule, isLoading } = useSchedule(start, end);

  const handlePrevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));
  const handleCurrentWeek = () => setCurrentDate(new Date());

  const todayStr = format(new Date(), 'yyyy-MM-dd');

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
            dayData.lessons.map((lesson: LessonSlot) => (
              <div key={lesson.lesson_order} className="flex gap-2 py-1.5 border-b border-border-light last:border-0 text-sm">
                <div className="w-5 font-medium text-text-muted text-center shrink-0">
                  {lesson.lesson_order}
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-medium text-text-primary truncate" style={{ color: lesson.subject.color_hex || 'inherit' }}>
                      {lesson.subject.name}
                    </span>
                    {lesson.cabinet && (
                      <span className="text-xs text-text-muted whitespace-nowrap">{t('cabinet_short')} {lesson.cabinet}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                  </div>
                  <div className="mt-0.5 pl-1 border-l-2 border-border-light">
                    {lesson.homework?.map((hw) => (
                      <HomeworkInline key={hw.id} homework={hw} />
                    ))}
                    {(!lesson.homework || lesson.homework.length === 0) && (
                      <span className="text-xs text-text-muted italic">{t('no_homework')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
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
