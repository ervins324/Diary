import { useState, useEffect } from 'react';
import { X, Loader2, Save, Calendar } from 'lucide-react';
import { EditablePreview } from '../ai-import/EditablePreview';
import { useScheduleRules, useBulkCommitByName } from '../../hooks/useSchedule';
import { useBells } from '../../hooks/useBells';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AiParsedDay } from '../../types';

interface ScheduleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeekType?: string;
}

const DEFAULT_DAYS = [
  { day_of_week: 1, day_name: 'Понеділок' },
  { day_of_week: 2, day_name: 'Вівторок' },
  { day_of_week: 3, day_name: 'Середа' },
  { day_of_week: 4, day_name: 'Четвер' },
  { day_of_week: 5, day_name: "П'ятниця" },
];

export function ScheduleEditorModal({ isOpen, onClose, initialWeekType = 'numerator' }: ScheduleEditorModalProps) {
  const { t, language } = useLanguage();
  const [weekType, setWeekType] = useState<string>(initialWeekType);
  const [scheduleData, setScheduleData] = useState<AiParsedDay[]>([]);
  
  const { data: rawRules, isLoading } = useScheduleRules(weekType === 'both' ? undefined : weekType);
  const commitMutation = useBulkCommitByName();
  /* Fetch imported bell schedule for smart time fallbacks */
  const { data: bellSlots } = useBells();

  // Populate editor data when raw rules are loaded or weekType changes
  useEffect(() => {
    if (!isOpen) return;

    // Localized day names
    const dayNames = [
      language === 'uk' ? 'Понеділок' : 'Monday',
      language === 'uk' ? 'Вівторок' : 'Tuesday',
      language === 'uk' ? 'Середа' : 'Wednesday',
      language === 'uk' ? 'Четвер' : 'Thursday',
      language === 'uk' ? "П'ятниця" : 'Friday',
    ];

    // Group rules by day_of_week (1..5)
    const groupedDays: AiParsedDay[] = DEFAULT_DAYS.map((d, index) => {
      const dayRules = (rawRules || []).filter(r => r.day_of_week === d.day_of_week);
      // Sort by lesson_order
      dayRules.sort((a, b) => a.lesson_order - b.lesson_order);

      return {
        day_of_week: d.day_of_week,
        day_name: dayNames[index],
        lessons: dayRules.map(r => {
          /* Use imported bell schedule times as fallback, then hardcoded defaults */
          const bellSlot = bellSlots?.find(b => b.lesson_order === r.lesson_order);
          const fallbackStart = bellSlot ? bellSlot.start_time.substring(0, 5) : '08:30';
          const fallbackEnd = bellSlot ? bellSlot.end_time.substring(0, 5) : '09:15';

          return {
            order: r.lesson_order,
            subject_name: r.subject.name,
            start_time: (r.start_time || fallbackStart).substring(0, 5),
            end_time: (r.end_time || fallbackEnd).substring(0, 5),
            cabinet: r.cabinet || '',
          };
        }),
      };
    });

    setScheduleData(groupedDays);
  }, [rawRules, isOpen, weekType, language, bellSlots]);

  if (!isOpen) return null;

  const handleCommit = async () => {
    const rules = scheduleData.flatMap(day =>
      day.lessons.map(lesson => {
        /* Use imported bell schedule times as fallback, then hardcoded defaults */
        const bellSlot = bellSlots?.find(b => b.lesson_order === lesson.order);
        const fallbackStart = bellSlot ? bellSlot.start_time.substring(0, 5) : '08:30';
        const fallbackEnd = bellSlot ? bellSlot.end_time.substring(0, 5) : '09:15';

        return {
          subject_name: lesson.subject_name,
          day_of_week: day.day_of_week,
          lesson_order: lesson.order,
          start_time: (lesson.start_time || fallbackStart).substring(0, 5),
          end_time: (lesson.end_time || fallbackEnd).substring(0, 5),
          cabinet: lesson.cabinet || null,
        };
      })
    );

    const weekTypes = weekType === 'both' ? ['numerator', 'denominator'] : [weekType];

    for (const wt of weekTypes) {
      await commitMutation.mutateAsync({ week_type: wt, rules });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div className="bg-bg-secondary w-full max-w-5xl rounded-xl shadow-2xl border border-border flex flex-col h-[92vh] max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t('schedule_editor')}</h2>
              <p className="text-xs text-text-muted">{t('schedule_editor_desc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Week type selector */}
            <select
              value={weekType}
              onChange={(e) => setWeekType(e.target.value)}
              className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent"
            >
              <option value="numerator">{t('numerator_week')}</option>
              <option value="denominator">{t('denominator_week')}</option>
              <option value="both">{t('both_weeks')}</option>
            </select>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex-1 flex justify-center items-center gap-2 text-text-muted">
              <Loader2 size={20} className="animate-spin text-accent" />
              <span>Loading schedule rules...</span>
            </div>
          ) : (
            <div className="flex-1 border border-border rounded-lg overflow-hidden bg-bg-primary min-h-0 flex flex-col shadow-xs">
              <EditablePreview data={scheduleData} onChange={setScheduleData} bellSlots={bellSlots} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-3 bg-bg-tertiary/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCommit}
            disabled={commitMutation.isPending}
            className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs"
          >
            {commitMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{t('commit_to_schedule')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
