import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, BookOpen, Coffee, CheckCircle, Flame, Sparkles } from 'lucide-react';
import { useSchedule } from '../../hooks/useSchedule';
import { getWeekDates, isLessonNow, cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';
import { getEventTypeInfo } from '../../lib/customTypes';
import type { LessonSlot } from '../../types';

interface LiveScheduleWidgetProps {
  variant?: 'sidebar' | 'mobile';
  className?: string;
}

export function LiveScheduleWidget({ variant = 'sidebar', className }: LiveScheduleWidgetProps) {
  const { t, language } = useLanguage();

  // Settings from localStorage with reactive state
  const [config, setConfig] = useState(() => ({
    enabled: localStorage.getItem('live_widget_enabled') !== 'false',
    showLesson: localStorage.getItem('live_widget_show_lesson') !== 'false',
    showHomework: localStorage.getItem('live_widget_show_homework') !== 'false',
    showEvents: localStorage.getItem('live_widget_show_events') !== 'false',
  }));

  // Re-read config on custom event from settings
  useEffect(() => {
    const handleConfigChange = () => {
      setConfig({
        enabled: localStorage.getItem('live_widget_enabled') !== 'false',
        showLesson: localStorage.getItem('live_widget_show_lesson') !== 'false',
        showHomework: localStorage.getItem('live_widget_show_homework') !== 'false',
        showEvents: localStorage.getItem('live_widget_show_events') !== 'false',
      });
    };
    window.addEventListener('live_widget_settings_changed', handleConfigChange);
    return () => window.removeEventListener('live_widget_settings_changed', handleConfigChange);
  }, []);

  // Periodic 30s clock tick to keep lesson & break calculation fresh
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = format(now, 'yyyy-MM-dd');
  const { start: weekStart, end: weekEnd } = getWeekDates(now);
  const { data: weekSchedule } = useSchedule(weekStart, weekEnd);

  // Today's lessons
  const todayDay = useMemo(() => {
    return weekSchedule?.find((d) => d.date === todayStr);
  }, [weekSchedule, todayStr]);

  const todayLessons = useMemo(() => {
    return (todayDay?.lessons || []).slice().sort((a, b) => a.lesson_order - b.lesson_order);
  }, [todayDay]);

  // Current lesson or break state determination
  const liveStatus = useMemo(() => {
    if (!todayLessons.length) {
      return { type: 'no_lessons' as const };
    }

    const currentHours = now.getHours();
    const currentMins = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMins;

    // 1. Check if a non-cancelled lesson is happening right now
    const activeLesson = todayLessons.find(
      (l) => !l.is_cancelled && isLessonNow(l.start_time, l.end_time, todayStr)
    );

    if (activeLesson) {
      return {
        type: 'lesson_now' as const,
        lesson: activeLesson,
      };
    }

    // Convert "HH:MM" or "HH:MM:SS" to minutes of day
    const parseTimeToMins = (tStr: string) => {
      const parts = tStr.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    // Find next upcoming non-cancelled lesson today
    const upcomingLesson = todayLessons.find((l) => {
      if (l.is_cancelled) return false;
      const startMins = parseTimeToMins(l.start_time);
      return startMins > currentTimeMinutes;
    });

    if (upcomingLesson) {
      const startMins = parseTimeToMins(upcomingLesson.start_time);
      const minutesUntil = Math.max(0, startMins - currentTimeMinutes);

      // Check if previous lesson just ended (meaning we are on a break)
      const prevLesson = [...todayLessons]
        .reverse()
        .find((l) => !l.is_cancelled && parseTimeToMins(l.end_time) <= currentTimeMinutes);

      if (prevLesson) {
        return {
          type: 'break_now' as const,
          minutesLeft: minutesUntil,
          nextLesson: upcomingLesson,
        };
      }

      return {
        type: 'before_school' as const,
        minutesLeft: minutesUntil,
        firstLesson: upcomingLesson,
      };
    }

    // All lessons finished for today
    return { type: 'finished' as const };
  }, [todayLessons, now, todayStr]);

  // Pending homework count
  const pendingHwCount = useMemo(() => {
    if (!weekSchedule) return 0;
    let count = 0;
    for (const day of weekSchedule) {
      for (const lesson of day.lessons) {
        for (const hw of lesson.homework || []) {
          if (!hw.is_completed) {
            count++;
          }
        }
      }
    }
    return count;
  }, [weekSchedule]);

  // Planned academic events for this week
  const upcomingEvents = useMemo(() => {
    if (!weekSchedule) return [];
    const events: { date: string; lesson: LessonSlot }[] = [];
    for (const day of weekSchedule) {
      if (day.date >= todayStr) {
        for (const lesson of day.lessons) {
          if (lesson.event_type && !lesson.is_cancelled) {
            events.push({ date: day.date, lesson });
          }
        }
      }
    }
    return events;
  }, [weekSchedule, todayStr]);

  if (!config.enabled) {
    return null;
  }

  // Mobile compact banner
  if (variant === 'mobile') {
    return (
      <div className={cn("px-3 py-2 bg-bg-secondary/90 backdrop-blur-xs border-b border-border text-xs flex items-center justify-between gap-2 overflow-x-auto", className)}>
        {/* Lesson / Break Status */}
        {config.showLesson && (
          <div className="flex items-center gap-1.5 shrink-0">
            {liveStatus.type === 'lesson_now' && (
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{liveStatus.lesson.subject.name}</span>
                <span className="text-[10px] text-text-muted">({liveStatus.lesson.start_time.slice(0, 5)}-{liveStatus.lesson.end_time.slice(0, 5)})</span>
              </span>
            )}
            {liveStatus.type === 'break_now' && (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <Coffee size={13} />
                <span>{language === 'uk' ? 'Перерва' : 'Break'} ({liveStatus.minutesLeft}m)</span>
                <span className="text-[10px] text-text-muted">→ {liveStatus.nextLesson.subject.name}</span>
              </span>
            )}
            {liveStatus.type === 'before_school' && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <Clock size={13} />
                <span>{liveStatus.firstLesson.start_time.slice(0, 5)}: {liveStatus.firstLesson.subject.name}</span>
              </span>
            )}
            {liveStatus.type === 'finished' && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <CheckCircle size={13} className="text-success" />
                <span>{language === 'uk' ? 'Уроки завершено' : 'Day finished'}</span>
              </span>
            )}
            {liveStatus.type === 'no_lessons' && (
              <span className="text-text-muted">
                {language === 'uk' ? 'Сьогодні вихідний' : 'No lessons today'}
              </span>
            )}
          </div>
        )}

        {/* Homework & Event Quick Counters */}
        <div className="flex items-center gap-2 shrink-0">
          {config.showHomework && pendingHwCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px] bg-amber-500/10 px-2 py-0.5 rounded-full">
              <BookOpen size={11} />
              <span>{pendingHwCount} {language === 'uk' ? 'ДЗ' : 'HW'}</span>
            </span>
          )}
          {config.showEvents && upcomingEvents.length > 0 && (
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
              <Flame size={11} />
              <span>{upcomingEvents.length}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // Sidebar Desktop Card
  return (
    <div className={cn("p-3 mx-3 rounded-xl border border-border/70 bg-bg-tertiary/40 backdrop-blur-xs flex flex-col gap-2.5 shadow-2xs transition-all", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
          <Sparkles size={11} className="text-accent" />
          <span>{language === 'uk' ? 'Зараз у школі' : 'Live Status'}</span>
        </span>
        {liveStatus.type === 'lesson_now' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{t('now')}</span>
          </span>
        )}
      </div>

      {/* Lesson / Break Status Card */}
      {config.showLesson && (
        <div className="p-2.5 rounded-lg bg-bg-secondary border border-border-light text-xs">
          {liveStatus.type === 'lesson_now' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-text-primary truncate">
                  {liveStatus.lesson.subject.name}
                </span>
                {liveStatus.lesson.cabinet && localStorage.getItem('show_cabinets') !== 'false' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-tertiary text-text-muted font-medium">
                    {t('cabinet_short')} {liveStatus.lesson.cabinet}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted flex items-center justify-between">
                <span>
                  {liveStatus.lesson.start_time.slice(0, 5)} – {liveStatus.lesson.end_time.slice(0, 5)}
                </span>
                <span className="text-accent font-semibold">
                  #{liveStatus.lesson.lesson_order}
                </span>
              </div>
            </div>
          )}

          {liveStatus.type === 'break_now' && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <Coffee size={14} />
                <span>
                  {language === 'uk' ? 'Перерва' : 'Break time'}
                  {liveStatus.minutesLeft > 0 && ` (${liveStatus.minutesLeft} ${t('minutes_short')})`}
                </span>
              </div>
              <div className="text-[11px] text-text-muted truncate">
                {language === 'uk' ? 'Далі:' : 'Next:'} <span className="font-medium text-text-primary">{liveStatus.nextLesson.subject.name}</span> ({liveStatus.nextLesson.start_time.slice(0, 5)})
              </div>
            </div>
          )}

          {liveStatus.type === 'before_school' && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-text-muted font-medium">
                <Clock size={13} />
                <span>{language === 'uk' ? 'Перший урок о' : 'First lesson at'} {liveStatus.firstLesson.start_time.slice(0, 5)}</span>
              </div>
              <div className="font-semibold text-text-primary truncate pl-5">
                {liveStatus.firstLesson.subject.name}
              </div>
            </div>
          )}

          {liveStatus.type === 'finished' && (
            <div className="flex items-center gap-2 text-text-muted py-0.5">
              <CheckCircle size={15} className="text-success shrink-0" />
              <span>{language === 'uk' ? 'Усі уроки завершено' : 'Lessons ended for today'}</span>
            </div>
          )}

          {liveStatus.type === 'no_lessons' && (
            <div className="text-text-muted text-[11px] italic py-0.5">
              {language === 'uk' ? 'Сьогодні без уроків' : 'No lessons scheduled'}
            </div>
          )}
        </div>
      )}

      {/* Homework & Academic Events Pills */}
      {(config.showHomework || config.showEvents) && (
        <div className="flex flex-col gap-1.5">
          {config.showHomework && (
            <div className="flex items-center justify-between text-xs px-2 py-1 rounded-md bg-bg-secondary/70">
              <span className="flex items-center gap-1.5 text-text-muted text-[11px]">
                <BookOpen size={12} className="text-accent" />
                <span>{language === 'uk' ? 'Залишилось ДЗ:' : 'Pending HW:'}</span>
              </span>
              <span className={cn("font-bold text-xs", pendingHwCount > 0 ? "text-amber-500" : "text-success")}>
                {pendingHwCount > 0 ? pendingHwCount : '✓ 0'}
              </span>
            </div>
          )}

          {config.showEvents && upcomingEvents.length > 0 && (
            <div className="flex items-center justify-between text-xs px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20">
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[11px] font-medium truncate">
                <Flame size={12} className="shrink-0" />
                <span className="truncate">
                  {upcomingEvents.length === 1
                    ? (getEventTypeInfo(upcomingEvents[0].lesson.event_type, language)?.label || 'Подія')
                    : (language === 'uk' ? 'Заплановані події' : 'Upcoming events')}
                </span>
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 text-xs shrink-0 ml-1">
                {upcomingEvents.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
