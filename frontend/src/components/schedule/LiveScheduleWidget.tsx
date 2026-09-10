import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, BookOpen, Coffee, CheckCircle, Flame, Sparkles, AlertTriangle, Search } from 'lucide-react';
import { useSchedule } from '../../hooks/useSchedule';
import { useAirAlerts } from '../../hooks/useAirAlerts';
import { getWeekDates, isLessonNow, cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';
import { getEventTypeInfo } from '../../lib/customTypes';
import { isShowCabinetsEnabled } from '../../lib/storage';
import type { LessonSlot } from '../../types';

interface LiveScheduleWidgetProps {
  variant?: 'sidebar' | 'mobile';
  className?: string;
}

export function LiveScheduleWidget({ variant = 'sidebar', className }: LiveScheduleWidgetProps) {
  const { t, language } = useLanguage();
  const { isAlertActive, alertsEnabled } = useAirAlerts();

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
    }, 10000);
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

  // Calculate lesson progress percentage and time remaining
  const lessonProgress = useMemo(() => {
    if (liveStatus.type !== 'lesson_now') return null;
    const lesson = liveStatus.lesson;
    const parseTime = (t: string) => {
      const p = t.split(':');
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    };
    const startMins = parseTime(lesson.start_time);
    const endMins = parseTime(lesson.end_time);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const totalDuration = endMins - startMins;
    const elapsed = currentMins - startMins;
    const percent = totalDuration > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100))) : 0;
    const remaining = Math.max(0, endMins - currentMins);
    return { percent, remaining, totalDuration };
  }, [liveStatus, now]);

  // Next upcoming lesson (after current one)
  const nextLesson = useMemo(() => {
    if (!todayLessons.length) return null;
    // If we're in a lesson, find the one after it
    if (liveStatus.type === 'lesson_now') {
      const currentOrder = liveStatus.lesson.lesson_order;
      return todayLessons.find(l => !l.is_cancelled && l.lesson_order > currentOrder) || null;
    }
    // If we're on break, the next lesson is already in liveStatus
    if (liveStatus.type === 'break_now') return liveStatus.nextLesson;
    if (liveStatus.type === 'before_school') return liveStatus.firstLesson;
    return null;
  }, [todayLessons, liveStatus]);

  // Remaining lessons count for today
  const remainingLessonsCount = useMemo(() => {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const parseTime = (t: string) => {
      const p = t.split(':');
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    };
    return todayLessons.filter(l => !l.is_cancelled && parseTime(l.start_time) > currentMins).length;
  }, [todayLessons, now]);

  // Pending homework count
  const pendingHwCount = useMemo(() => {
    if (!weekSchedule) return 0;
    let count = 0;
    for (const day of weekSchedule) {
      for (const lesson of day.lessons) {
        for (const hw of lesson.homework || []) {
          if (!hw.is_completed && !hw.is_failed) {
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

  // Mobile Dynamic Island-style compact banner
  if (variant === 'mobile') {
    return (
      <div className={cn("px-3 py-2 bg-bg-secondary/90 backdrop-blur-xs border-b border-border text-xs flex items-center justify-between gap-2 overflow-x-auto", className)}>
        {/* Air Alert Warning Pill */}
        {alertsEnabled && isAlertActive && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            <AlertTriangle size={11} />
            <span>{language === 'uk' ? 'Тривога' : 'Alert'}</span>
          </span>
        )}

        {/* Lesson / Break Status */}
        {config.showLesson && (
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            {liveStatus.type === 'lesson_now' && lessonProgress && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-accent min-w-0">
                <span className="relative w-5 h-5 shrink-0">
                  {/* Circular progress ring */}
                  <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeDasharray={`${lessonProgress.percent * 0.5} 50`}
                      strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold">{liveStatus.lesson.lesson_order}</span>
                </span>
                <span className="truncate">{liveStatus.lesson.subject.name}</span>
                <span className="text-[10px] text-text-muted font-normal shrink-0">{lessonProgress.remaining}{t('minutes_short')}</span>
              </span>
            )}
            {liveStatus.type === 'break_now' && (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <Coffee size={13} />
                <span>{liveStatus.minutesLeft}{t('minutes_short')}</span>
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

        {/* Homework & Event Quick Counters & Quick Runner */}
        <div className="flex items-center gap-1.5 shrink-0">
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
          {/* Quick Runner / Command Palette Trigger */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            aria-label={t('command_palette_search_btn')}
            className="p-1 rounded-full text-text-muted hover:text-text-primary bg-bg-tertiary/60 border border-border/60 shrink-0 cursor-pointer active:scale-95 transition-transform"
          >
            <Search size={12} className="text-accent" />
          </button>
        </div>
      </div>
    );
  }

  // Sidebar Desktop Dynamic Island Card
  return (
    <div className={cn("p-3 mx-3 rounded-2xl border border-border/80 bg-bg-secondary/60 dark:bg-bg-secondary/40 backdrop-blur-md flex flex-col gap-2.5 shadow-sm transition-all", className)}>
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

      {/* Air Alert Warning Banner when active in region */}
      {alertsEnabled && isAlertActive && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <AlertTriangle size={13} className="shrink-0 text-rose-500" />
          <span className="truncate">{language === 'uk' ? 'Повітряна тривога в регіоні!' : 'Air alert in your region!'}</span>
        </div>
      )}

      {/* Lesson / Break Status Card */}
      {config.showLesson && (
        <div className="p-2.5 rounded-xl bg-bg-primary/70 border border-border/60 text-xs shadow-2xs">
          {liveStatus.type === 'lesson_now' && lessonProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: liveStatus.lesson.subject.color_hex || 'var(--color-accent)' }}
                  />
                  <span className="font-bold text-text-primary text-sm truncate">
                    {liveStatus.lesson.subject.name}
                  </span>
                </div>
                {liveStatus.lesson.cabinet && isShowCabinetsEnabled() && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-tertiary text-text-muted font-medium shrink-0">
                    {t('cabinet_short')} {liveStatus.lesson.cabinet}
                  </span>
                )}
              </div>
              {/* Progress bar showing lesson completion */}
              <div className="space-y-1">
                <div className="w-full h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-1000 ease-linear"
                    style={{ width: `${lessonProgress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span>{liveStatus.lesson.start_time.slice(0, 5)} – {liveStatus.lesson.end_time.slice(0, 5)}</span>
                  <span className="font-semibold text-accent">
                    {lessonProgress.remaining > 0
                      ? `${lessonProgress.remaining} ${t('minutes_short')} ${language === 'uk' ? 'лишилось' : 'left'}`
                      : (language === 'uk' ? 'Завершується' : 'Ending')}
                  </span>
                </div>
              </div>
              {/* Next lesson preview */}
              {nextLesson && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 text-[11px] text-text-muted">
                  <span>{language === 'uk' ? 'Далі:' : 'Next:'}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: nextLesson.subject.color_hex || 'var(--color-accent)' }}
                  />
                  <span className="font-medium text-text-primary truncate">{nextLesson.subject.name}</span>
                  <span className="shrink-0">({nextLesson.start_time.slice(0, 5)})</span>
                </div>
              )}
            </div>
          )}

          {liveStatus.type === 'break_now' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <Coffee size={14} />
                <span>
                  {language === 'uk' ? 'Перерва' : 'Break time'}
                  {liveStatus.minutesLeft > 0 && ` (${liveStatus.minutesLeft} ${t('minutes_short')})`}
                </span>
              </div>
              {/* Break countdown bar */}
              {liveStatus.minutesLeft > 0 && (
                <div className="w-full h-1 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500/60 transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.max(5, Math.min(100, (1 - liveStatus.minutesLeft / 15) * 100))}%` }}
                  />
                </div>
              )}
              <div className="text-[11px] text-text-muted flex items-center gap-1 truncate">
                <span>{language === 'uk' ? 'Далі:' : 'Next:'}</span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: liveStatus.nextLesson.subject.color_hex || 'var(--color-accent)' }}
                />
                <span className="font-medium text-text-primary truncate">{liveStatus.nextLesson.subject.name}</span>
                <span className="shrink-0">({liveStatus.nextLesson.start_time.slice(0, 5)})</span>
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

          {/* Remaining lessons counter */}
          {remainingLessonsCount > 0 && liveStatus.type !== 'finished' && liveStatus.type !== 'no_lessons' && (
            <div className="text-[10px] text-text-muted/70 text-center">
              {language === 'uk'
                ? `Ще ${remainingLessonsCount} ${remainingLessonsCount === 1 ? 'урок' : remainingLessonsCount < 5 ? 'уроки' : 'уроків'}`
                : `${remainingLessonsCount} lesson${remainingLessonsCount !== 1 ? 's' : ''} remaining`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
