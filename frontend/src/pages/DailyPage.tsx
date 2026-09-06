import { useState } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Wand2, Loader2 } from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { LessonCard } from '../components/schedule/LessonCard';
import { AiImportModal } from '../components/ai-import/AiImportModal';
import { formatDate, getDefaultScheduleDate } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';

export function DailyPage() {
  const { t } = useLanguage();
  /* Initialize date with weekend auto-advance if today is Saturday/Sunday */
  const [currentDate, setCurrentDate] = useState(getDefaultScheduleDate);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const { data: schedule, isLoading } = useSchedule(dateStr, dateStr);

  const handlePrevDay = () => setCurrentDate((prev) => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate((prev) => addDays(prev, 1));
  const handleToday = () => setCurrentDate(getDefaultScheduleDate());

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

  return (
    <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full p-4 md:p-6 relative">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <button onClick={handlePrevDay} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
            <ChevronLeft size={24} className="text-text-secondary" />
          </button>
          
          <div className="flex flex-col items-center text-center">
            <h1 className="text-xl font-bold text-text-primary capitalize">
              {getDayName(currentDate)}
            </h1>
            <span className="text-sm text-text-muted">{formatDate(dateStr)}</span>
          </div>
          
          <button onClick={handleNextDay} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
            <ChevronRight size={24} className="text-text-secondary" />
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
            className="px-4 py-1.5 bg-bg-secondary border border-border rounded-md text-sm font-medium text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {t('today')}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
              <LessonCard key={lesson.lesson_order} lesson={lesson} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAiModalOpen(true)}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-accent text-white rounded-full shadow-lg flex items-center justify-center hover:bg-accent/90 transition-transform hover:scale-105 active:scale-95"
        aria-label={t('import_ai_schedule')}
      >
        <Wand2 size={24} />
      </button>

      <AiImportModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}
