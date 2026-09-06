import { useState } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  Clock,
  Flame,
  Coffee,
  CheckCircle2,
  Calendar,
  BarChart2,
  CalendarDays,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchWeeklyStats } from '../api/client';
import { getWeekDates, cn } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import type { WeeklyStat, WeeklyStatsResponse, DayStat } from '../types';

export function StatsPage() {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'subjects' | 'days'>('subjects');
  const { start, end } = getWeekDates(currentDate);

  const { data: statsResponse, isLoading } = useQuery<WeeklyStatsResponse>({
    queryKey: ['stats', start],
    queryFn: () => fetchWeeklyStats(start),
  });

  const handlePrevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));

  /* Handle both rich response and legacy array fallback, sorted alphabetically for stable order across numerator/denominator */
  const rawSubjects: WeeklyStat[] = statsResponse?.subjects || (Array.isArray(statsResponse) ? statsResponse : []);
  const subjectsList: WeeklyStat[] = [...rawSubjects].sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  // Prepare data for Recharts (convert minutes to hours)
  const chartData = subjectsList.map(stat => ({
    ...stat,
    hours: Math.round((stat.total_minutes / 60) * 10) / 10,
  }));

  // Daily statistics data for day view
  const daysData: DayStat[] = statsResponse?.days || [];
  // Keep Monday through Friday, plus Saturday if it has lessons
  const displayDays = daysData.filter(d => d.day_of_week <= 5 || d.lessons_count > 0);
  const dayChartData = displayDays.map(d => ({
    ...d,
    label: t(d.day_key as any),
    hours: Math.round((d.total_minutes / 60) * 10) / 10,
  }));

  const totalMinutes = subjectsList.reduce((acc, curr) => acc + curr.total_minutes, 0);
  const busiestSubject = subjectsList.reduce((prev, current) => 
    (prev.total_minutes > current.total_minutes) ? prev : current
  , { subject_name: '-', total_minutes: 0 } as WeeklyStat);

  const totalSubjects = statsResponse?.total_subjects ?? subjectsList.length;
  const totalLessons = statsResponse?.total_lessons ?? 0;
  const avgLessons = statsResponse?.avg_lessons_per_day ?? 0;
  const breakMinutes = statsResponse?.total_break_minutes ?? 0;
  const hwStats = statsResponse?.homework_stats ?? { total: 0, completed: 0, completion_rate: 100 };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as WeeklyStat;
      const hours = Math.floor(data.total_minutes / 60);
      const mins = Math.round(data.total_minutes % 60);
      return (
        <div className="bg-bg-secondary border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-text-primary mb-1">{data.subject_name}</p>
          <p className="text-sm text-text-secondary">
            {t('duration')}: <span className="font-medium text-text-primary">{hours}{t('hours_short')} {mins}{t('minutes_short')}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomDayTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as any;
      const hours = Math.floor(data.total_minutes / 60);
      const mins = Math.round(data.total_minutes % 60);
      return (
        <div className="bg-bg-secondary border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-text-primary mb-1">{data.label} ({format(parseISO(data.date), 'dd.MM')})</p>
          <p className="text-sm text-text-secondary">
            {t('stats_lessons_count')}: <span className="font-medium text-text-primary">{data.lessons_count} {t('day_lessons')}</span>
          </p>
          <p className="text-sm text-text-secondary">
            {t('duration')}: <span className="font-medium text-text-primary">{hours}{t('hours_short')} {mins}{t('minutes_short')}</span>
          </p>
          {data.break_minutes > 0 && (
            <p className="text-sm text-emerald-500">
              {t('break_time')}: <span className="font-medium">{data.break_minutes}{t('minutes_short')}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <button onClick={handlePrevWeek} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
          <ChevronLeft size={24} className="text-text-secondary" />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <h1 className="text-xl font-bold text-text-primary">{t('weekly_stats')}</h1>
          <span className="text-sm text-text-muted">
            {format(parseISO(start), 'MMM d')} - {format(parseISO(end), 'MMM d, yyyy')}
          </span>
        </div>
        
        <button onClick={handleNextWeek} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
          <ChevronRight size={24} className="text-text-secondary" />
        </button>
      </header>

      {/* View Mode Segmented Switcher */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setViewMode('subjects')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              viewMode === 'subjects' ? "bg-accent text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <BarChart2 size={15} />
            <span>{t('by_subjects')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('days')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              viewMode === 'days' ? "bg-accent text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <CalendarDays size={15} />
            <span>{t('by_days')}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-6 pb-6">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="text-text-muted text-lg mb-2">{t('no_data_week')}</p>
          </div>
        ) : (
          <>
            {/* View Mode: By Subjects */}
            {viewMode === 'subjects' && (
              <div className="bg-bg-secondary p-4 md:p-6 rounded-xl border border-border h-80 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="short_name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg-tertiary)' }} />
                    <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color_hex || 'var(--color-accent)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* View Mode: By Days */}
            {viewMode === 'days' && (
              <div className="flex flex-col gap-6">
                {/* Daily Study Hours Chart */}
                <div className="bg-bg-secondary p-4 md:p-6 rounded-xl border border-border h-80 shadow-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                      />
                      <Tooltip content={<CustomDayTooltip />} cursor={{ fill: 'var(--color-bg-tertiary)' }} />
                      <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={48} fill="var(--color-accent)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Day-by-Day Breakdown Cards Grid */}
                <div>
                  <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                    <CalendarDays size={18} className="text-accent" />
                    <span>{t('daily_breakdown')}</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {displayDays.map((day) => {
                      const hours = Math.floor(day.total_minutes / 60);
                      const mins = Math.round(day.total_minutes % 60);
                      const isDayActive = day.lessons_count > 0;
                      return (
                        <div
                          key={day.day_of_week}
                          className={cn(
                            "bg-bg-secondary p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-xs",
                            isDayActive ? "border-border" : "border-border/50 opacity-75"
                          )}
                        >
                          <div className="flex items-center justify-between border-b border-border-light pb-2">
                            <div>
                              <span className="font-semibold text-text-primary text-sm">{t(day.day_key as any)}</span>
                              <span className="text-xs text-text-muted ml-2">{format(parseISO(day.date), 'dd.MM')}</span>
                            </div>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              isDayActive ? "bg-accent/10 text-accent" : "bg-bg-tertiary text-text-muted"
                            )}>
                              {day.lessons_count} {t('day_lessons')}
                            </span>
                          </div>

                          {isDayActive ? (
                            <>
                              <div className="flex items-center justify-between text-xs text-text-secondary">
                                <div className="flex items-center gap-1" title={t('study_time')}>
                                  <Clock size={13} className="text-accent" />
                                  <span>{hours}{t('hours_short')} {mins}{t('minutes_short')}</span>
                                </div>
                                {day.break_minutes > 0 && (
                                  <div className="flex items-center gap-1 text-emerald-500" title={t('break_time')}>
                                    <Coffee size={13} />
                                    <span>{day.break_minutes}{t('minutes_short')}</span>
                                  </div>
                                )}
                                {day.homework_count > 0 && (
                                  <div className="flex items-center gap-1 text-text-muted" title={t('stats_homework_rate')}>
                                    <CheckCircle2 size={13} className={day.homework_completed === day.homework_count ? "text-success" : "text-amber-500"} />
                                    <span>{day.homework_completed}/{day.homework_count}</span>
                                  </div>
                                )}
                              </div>

                              {/* Ordered lesson subject chips for that day */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {day.subjects.map((subj, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="text-[11px] px-2 py-0.5 rounded font-medium truncate max-w-[140px]"
                                    style={{
                                      backgroundColor: `${subj.color_hex}15`,
                                      color: subj.color_hex,
                                      border: `1px solid ${subj.color_hex}35`,
                                    }}
                                    title={`${subj.lesson_order}. ${subj.name}${subj.cabinet ? ` (${t('cabinet_short')} ${subj.cabinet})` : ''}`}
                                  >
                                    {subj.short_name || subj.name}
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-text-muted italic py-2">{t('day_no_lessons')}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Enriched Summary Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {/* Total Study Time */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Clock size={14} className="text-accent" />
                  <span>{t('total_hours')}</span>
                </div>
                <span className="text-xl md:text-2xl font-bold text-text-primary">
                  {Math.floor(totalMinutes / 60)}<span className="text-sm text-text-muted font-normal">{t('hours_short')}</span> {Math.round(totalMinutes % 60)}<span className="text-sm text-text-muted font-normal">{t('minutes_short')}</span>
                </span>
              </div>

              {/* Busiest Subject */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Flame size={14} className="text-amber-500" />
                  <span>{t('busiest_subject')}</span>
                </div>
                <span className="text-base md:text-lg font-bold text-text-primary truncate w-full" style={{ color: busiestSubject?.color_hex || 'inherit' }}>
                  {busiestSubject?.subject_name}
                </span>
              </div>

              {/* Total Subjects Count */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <BookOpen size={14} className="text-indigo-500" />
                  <span>{t('stats_subjects_count')}</span>
                </div>
                <span className="text-xl md:text-2xl font-bold text-text-primary">
                  {totalSubjects}
                </span>
              </div>

              {/* Total Lessons & Daily Average */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Calendar size={14} className="text-blue-500" />
                  <span>{t('stats_lessons_count')}</span>
                </div>
                <span className="text-xl md:text-2xl font-bold text-text-primary">
                  {totalLessons}
                </span>
                <span className="text-xs text-text-muted mt-0.5">
                  ~{avgLessons} {t('stats_per_day')}
                </span>
              </div>

              {/* Total Break Time */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <Coffee size={14} className="text-emerald-500" />
                  <span>{t('stats_breaks_duration')}</span>
                </div>
                <span className="text-xl md:text-2xl font-bold text-text-primary">
                  {Math.floor(breakMinutes / 60)}<span className="text-sm text-text-muted font-normal">{t('hours_short')}</span> {Math.round(breakMinutes % 60)}<span className="text-sm text-text-muted font-normal">{t('minutes_short')}</span>
                </span>
              </div>

              {/* Homework Completion Rate */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span>{t('stats_homework_rate')}</span>
                </div>
                <span className="text-xl md:text-2xl font-bold text-text-primary">
                  {hwStats.completion_rate}%
                </span>
                <div className="w-full bg-bg-tertiary h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-success h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, hwStats.completion_rate))}%` }}
                  />
                </div>
                <span className="text-[11px] text-text-muted mt-1">
                  {hwStats.completed} / {hwStats.total} {t('stats_completed')}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
