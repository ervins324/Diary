import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Calendar,
  Play,
  Pause,
  Edit2,
  Trash2,
  XCircle,
  BookOpen,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isBefore, startOfDay } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import { useUpdateHomework, useDeleteHomework } from '../../hooks/useHomework';
import { AttachmentChip } from './AttachmentChip';
import { useLanguage } from '../../i18n/LanguageContext';
import { cn } from '../../lib/utils';
import type { HomeworkEntry } from '../../types';

interface HomeworkCardProps {
  homework: HomeworkEntry;
  onEdit: (homework: HomeworkEntry) => void;
  onOpenImage: (images: string[], initialIndex: number) => void;
}

export function HomeworkCard({
  homework,
  onEdit,
  onOpenImage,
}: HomeworkCardProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const updateMutation = useUpdateHomework();
  const deleteMutation = useDeleteHomework();

  const [isDeleting, setIsDeleting] = useState(false);

  /* Stopwatch timer state persisted in localStorage */
  const [timerRunning, setTimerRunning] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(`hw_timer_${homework.id}`);
      return Boolean(stored);
    } catch {
      return false;
    }
  });

  const [secondsSpent, setSecondsSpent] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`hw_timer_${homework.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.startTime) {
          const elapsed = Math.floor((Date.now() - parsed.startTime) / 1000);
          return Math.max(0, (parsed.baseSeconds || 0) + elapsed);
        }
      }
    } catch {}
    return homework.time_spent_seconds || 0;
  });

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = window.setInterval(() => {
        setSecondsSpent((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const toggleTimer = () => {
    if (timerRunning) {
      // Pause timer and save accumulated seconds to backend
      setTimerRunning(false);
      try {
        localStorage.removeItem(`hw_timer_${homework.id}`);
      } catch {}
      updateMutation.mutate({
        id: homework.id,
        data: { time_spent_seconds: secondsSpent },
      });
    } else {
      // Start timer
      setTimerRunning(true);
      try {
        localStorage.setItem(
          `hw_timer_${homework.id}`,
          JSON.stringify({ startTime: Date.now(), baseSeconds: secondsSpent })
        );
      } catch {}
    }
  };

  /* Toggle completion */
  const handleToggleCompleted = () => {
    updateMutation.mutate({
      id: homework.id,
      data: { is_completed: !homework.is_completed },
    });
  };

  /* Toggle failed status */
  const handleToggleFailed = () => {
    updateMutation.mutate({
      id: homework.id,
      data: { is_failed: !homework.is_failed },
    });
  };

  /* Delete handler */
  const handleDelete = () => {
    if (window.confirm(t('hw_delete_confirm'))) {
      setIsDeleting(true);
      deleteMutation.mutate(homework.id, {
        onSettled: () => setIsDeleting(false),
      });
    }
  };

  /* Relative due date styling & text */
  const getDueDateInfo = () => {
    try {
      const date = parseISO(homework.due_date);
      const today = startOfDay(new Date());
      const dueStart = startOfDay(date);
      const isPastDue = isBefore(dueStart, today) && !homework.is_completed;
      const dateLocale = language === 'uk' ? uk : enUS;

      if (homework.is_completed) {
        return {
          label: format(date, 'd MMM', { locale: dateLocale }),
          colorClass: 'text-text-muted bg-bg-tertiary border-border/80',
          isOverdue: false,
        };
      }

      if (isPastDue) {
        return {
          label: `${t('hw_overdue')} (${format(date, 'd MMM', { locale: dateLocale })})`,
          colorClass: 'text-danger bg-danger/10 border-danger/30 font-semibold',
          isOverdue: true,
        };
      }

      if (isToday(date)) {
        return {
          label: t('hw_due_today'),
          colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/30 font-semibold',
          isOverdue: false,
        };
      }

      if (isTomorrow(date)) {
        return {
          label: t('hw_due_tomorrow'),
          colorClass: 'text-accent bg-accent/10 border-accent/30 font-semibold',
          isOverdue: false,
        };
      }

      return {
        label: format(date, 'EEE, d MMM', { locale: dateLocale }),
        colorClass: 'text-text-secondary bg-bg-tertiary border-border/80',
        isOverdue: false,
      };
    } catch {
      return {
        label: homework.due_date,
        colorClass: 'text-text-secondary bg-bg-tertiary border-border/80',
        isOverdue: false,
      };
    }
  };

  const dueInfo = getDueDateInfo();
  const subjectColor = homework.subject?.color_hex || '#4F46E5';
  const minutes = Math.floor(secondsSpent / 60);
  const seconds = secondsSpent % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const allImages = homework.images || [];
  const attachments = homework.attachments || [];

  return (
    <div
      className={cn(
        'group relative bg-bg-secondary border rounded-2xl p-4 md:p-5 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between gap-3.5',
        homework.is_completed
          ? 'border-border/60 bg-bg-secondary/60 opacity-85'
          : dueInfo.isOverdue
          ? 'border-danger/40 bg-danger/5'
          : 'border-border hover:border-border/90'
      )}
    >
      {/* Top Header: Subject Badge, Due Date, and Status */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {/* Subject indicator circle */}
          <div
            className="w-3 h-3 rounded-full shrink-0 shadow-xs"
            style={{ backgroundColor: subjectColor }}
          />
          <span className="font-bold text-sm text-text-primary truncate">
            {homework.subject?.name || t('subject')}
          </span>
          {homework.subject?.default_cabinet && (
            <span className="text-[11px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-md border border-border/60">
              {t('cabinet_short')}. {homework.subject.default_cabinet}
            </span>
          )}
          {homework.lesson_order && (
            <span className="text-[11px] text-text-muted font-medium">
              • {homework.lesson_order} {language === 'uk' ? 'ур.' : 'les.'}
            </span>
          )}
        </div>

        {/* Badges: Due Date & Failed Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          {homework.is_failed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-danger/15 text-danger border border-danger/30">
              <XCircle size={12} />
              <span>{t('hw_filter_failed')}</span>
            </span>
          )}

          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg border transition-colors',
              dueInfo.colorClass
            )}
          >
            <Calendar size={12} />
            <span>{dueInfo.label}</span>
          </span>
        </div>
      </div>

      {/* Middle Body: Completion Checkbox & Task Text */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleToggleCompleted}
          aria-label={homework.is_completed ? t('hw_mark_pending') : t('hw_mark_completed')}
          className={cn(
            'w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 mt-0.5 cursor-pointer active:scale-95',
            homework.is_completed
              ? 'bg-success border-success text-white'
              : 'border-border hover:border-accent text-transparent hover:text-accent/30'
          )}
        >
          <Check size={14} strokeWidth={3} className={homework.is_completed ? 'opacity-100' : 'opacity-0'} />
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap break-words transition-all',
              homework.is_completed
                ? 'line-through text-text-muted'
                : 'text-text-primary'
            )}
          >
            {homework.text}
          </p>
        </div>
      </div>

      {/* Attachments Section: Photos and Documents */}
      {(allImages.length > 0 || attachments.length > 0) && (
        <div className="space-y-2 pt-1">
          {/* Images Thumbnails */}
          {allImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onOpenImage(allImages, idx)}
                  className="w-14 h-14 rounded-xl overflow-hidden border border-border/80 shadow-2xs hover:scale-105 transition-transform cursor-pointer relative group"
                >
                  <img src={img} alt="Homework Attachment" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold bg-black/60 px-1 py-0.5 rounded">
                      Zoom
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Files & Links */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((att, idx) => (
                <AttachmentChip
                  key={idx}
                  attachment={att}
                  onClickImage={(url) => onOpenImage([url], 0)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Footer: Study Timer & Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
        {/* Study Timer Stopwatch */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTimer}
            title={timerRunning ? 'Pause timer' : 'Start study timer'}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer border',
              timerRunning
                ? 'bg-accent text-white border-accent animate-pulse'
                : secondsSpent > 0
                ? 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-accent border-border/80'
                : 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-muted border-border/80'
            )}
          >
            {timerRunning ? <Pause size={12} /> : <Play size={12} />}
            <span className="font-mono text-[11px] font-semibold">{timeFormatted}</span>
          </button>

          {secondsSpent > 0 && !timerRunning && (
            <span className="text-[10px] text-text-muted">
              {minutes > 0 ? `${minutes} ${t('minutes_short')}` : `${seconds}s`}
            </span>
          )}
        </div>

        {/* Actions: Failed toggle, Navigate to Diary, Edit, Delete */}
        <div className="flex items-center gap-1">
          {/* Toggle Failed status */}
          <button
            type="button"
            onClick={handleToggleFailed}
            title={homework.is_failed ? t('hw_unmark_failed') : t('hw_mark_failed')}
            className={cn(
              'p-1.5 rounded-lg transition-colors cursor-pointer',
              homework.is_failed
                ? 'text-danger bg-danger/10 hover:bg-danger/20'
                : 'text-text-muted hover:text-danger hover:bg-bg-tertiary'
            )}
          >
            <XCircle size={15} />
          </button>

          {/* Jump to Diary Page for this lesson */}
          <button
            type="button"
            onClick={() => navigate(`/diary?date=${homework.due_date}`)}
            title={t('hw_go_to_diary')}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <BookOpen size={15} />
          </button>

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(homework)}
            title={t('edit')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <Edit2 size={15} />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title={t('delete')}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
