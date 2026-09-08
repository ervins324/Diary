import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Check, ArrowLeftRight, RotateCcw, Loader2, Search } from 'lucide-react';
import { fetchSubjects } from '../../api/client';
import { useSetScheduleOverride, useDeleteScheduleOverride } from '../../hooks/useScheduleOverrides';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDate, cn } from '../../lib/utils';
import { getAllEventTypes, getEventTypeInfo } from '../../lib/customTypes';
import type { LessonSlot, Subject, LessonEventType } from '../../types';

interface LessonOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: LessonSlot;
}

export function LessonOverrideModal({ isOpen, onClose, lesson }: LessonOverrideModalProps) {
  const { t, language } = useLanguage();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const setOverrideMutation = useSetScheduleOverride();
  const deleteOverrideMutation = useDeleteScheduleOverride();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    lesson.is_override && lesson.subject ? lesson.subject.id : lesson.subject.id
  );
  const [cabinet, setCabinet] = useState<string>(lesson.cabinet || '');
  const [isCancelled, setIsCancelled] = useState<boolean>(lesson.is_cancelled || false);
  const [note, setNote] = useState<string>(lesson.override_note || '');
  const [eventType, setEventType] = useState<LessonEventType>(lesson.event_type || null);
  const [subjectSearch, setSubjectSearch] = useState<string>('');

  // Alphabetically sorted & filtered subjects
  const filteredSortedSubjects = useMemo(() => {
    const list = [...subjects].sort((a, b) => a.name.localeCompare(b.name, language === 'uk' ? 'uk' : 'en'));
    if (!subjectSearch.trim()) return list;
    const q = subjectSearch.toLowerCase().trim();
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.short_name?.toLowerCase().includes(q));
  }, [subjects, subjectSearch, language]);

  if (!isOpen) return null;

  // Determine what the original lesson was
  const originalSubject = lesson.original_subject || lesson.subject;

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    const chosen = subjects.find((s) => s.id === subjectId);
    if (chosen?.default_cabinet) {
      setCabinet(chosen.default_cabinet);
    }
  };

  const handleSave = () => {
    setOverrideMutation.mutate(
      {
        date: lesson.date,
        lesson_order: lesson.lesson_order,
        subject_id: isCancelled ? null : selectedSubjectId,
        original_subject_id: originalSubject?.id || null,
        original_subject_name: originalSubject?.name || null,
        cabinet: isCancelled ? null : cabinet.trim() || null,
        is_cancelled: isCancelled,
        note: note.trim() || null,
        event_type: eventType,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleResetToRegular = () => {
    if (
      confirm(
        language === 'uk'
          ? 'Повернути регулярний розклад для цього уроку?'
          : 'Reset this lesson to the regular recurring schedule?'
      )
    ) {
      deleteOverrideMutation.mutate(
        { targetDate: lesson.date, lessonOrder: lesson.lesson_order },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    }
  };

  const isPending = setOverrideMutation.isPending || deleteOverrideMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-bg-primary border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <ArrowLeftRight size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">
                {t('lesson_override_modal_title')}
              </h2>
              <p className="text-xs text-text-muted">
                {formatDate(lesson.date)} • {t('lesson_label') || 'lesson'} #{lesson.lesson_order}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Lesson Event / Assessment Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {t('lesson_event_type')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEventType(null)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-2",
                  eventType === null
                    ? "bg-bg-tertiary border-accent text-accent shadow-xs"
                    : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary"
                )}
              >
                <span>🎓</span>
                <span>{t('event_none')}</span>
              </button>

              {getAllEventTypes().map((et) => {
                const isSelected = eventType === et.id;
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => setEventType(et.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-2 truncate",
                      isSelected
                        ? "shadow-xs font-bold ring-1 ring-current"
                        : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary"
                    )}
                    style={
                      isSelected
                        ? { backgroundColor: `${et.color}20`, color: et.color, borderColor: et.color }
                        : {}
                    }
                  >
                    <span>{et.icon}</span>
                    <span className="truncate">{language === 'uk' ? et.nameUk : et.nameEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Air Alert 1-Click Cancellation Button */}
          <button
            type="button"
            onClick={() => {
              const isAlertNote = note.toLowerCase().includes('тривог') || note.toLowerCase().includes('alert');
              if (isCancelled && isAlertNote) {
                setIsCancelled(false);
                setNote('');
              } else {
                setIsCancelled(true);
                setNote(language === 'uk' ? 'Повітряна тривога' : 'Air raid alert');
              }
            }}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer",
              isCancelled && (note.toLowerCase().includes('тривог') || note.toLowerCase().includes('alert'))
                ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-xs"
                : "bg-bg-secondary border-border text-text-primary hover:bg-rose-500/10 hover:border-rose-500/30"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base animate-pulse">🚨</span>
              <div>
                <span className="font-semibold text-xs block">
                  {language === 'uk' ? 'Повітряна тривога (скасувати)' : 'Air Alert (Cancel Lesson)'}
                </span>
                <span className="text-[11px] text-text-muted">
                  {language === 'uk'
                    ? 'Швидко позначити цей урок скасованим через повітряну тривогу'
                    : '1-click mark lesson as cancelled due to air raid alert'}
                </span>
              </div>
            </div>
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-md font-bold transition-colors",
                isCancelled && (note.toLowerCase().includes('тривог') || note.toLowerCase().includes('alert'))
                  ? "bg-rose-500 text-white"
                  : "bg-bg-tertiary text-text-muted hover:text-text-primary"
              )}
            >
              {isCancelled && (note.toLowerCase().includes('тривог') || note.toLowerCase().includes('alert'))
                ? (language === 'uk' ? 'Скасовано' : 'Cancelled')
                : (language === 'uk' ? 'Скасувати' : 'Cancel')}
            </span>
          </button>

          {/* Cancelled toggle */}
          <label className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border cursor-pointer hover:bg-bg-tertiary transition-colors">
            <input
              type="checkbox"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="w-4 h-4 rounded text-accent focus:ring-accent border-border"
            />
            <div className="flex flex-col">
              <span className="font-medium text-text-primary">
                {language === 'uk' ? 'Скасувати цей урок (вікно / немає уроку)' : 'Cancel lesson (no class today)'}
              </span>
              <span className="text-xs text-text-muted">
                {language === 'uk'
                  ? 'У щоденнику відображатиметься як скасований із закресленням'
                  : 'Displays with strikethrough indicating no lesson'}
              </span>
            </div>
          </label>

          {!isCancelled && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                {language === 'uk' ? 'Урок на заміну (новий предмет)' : 'Substitute Subject (New Class)'}
              </label>

              {/* Instant Search Bar */}
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder={t('search_subject_placeholder')}
                  className="w-full bg-bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              {isLoadingSubjects ? (
                <div className="flex items-center gap-2 text-text-muted py-2">
                  <Loader2 size={16} className="animate-spin text-accent" />
                  <span>{language === 'uk' ? 'Завантаження...' : 'Loading...'}</span>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-1 bg-bg-secondary">
                  {filteredSortedSubjects.length === 0 ? (
                    <div className="p-3 text-xs text-center text-text-muted">
                      {language === 'uk' ? 'Предметів не знайдено' : 'No subjects found'}
                    </div>
                  ) : (
                    filteredSortedSubjects.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSubjectChange(s.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded text-xs text-left transition-colors",
                          selectedSubjectId === s.id
                            ? "bg-accent text-white font-semibold"
                            : "hover:bg-bg-tertiary text-text-primary"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color_hex || '#3b82f6' }}
                          />
                          <span>{s.name}</span>
                        </div>
                        {selectedSubjectId === s.id && <Check size={14} />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Note / reason */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              {language === 'uk' ? 'Примітка (необовʼязково)' : 'Note / Reason (optional)'}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={language === 'uk' ? 'Наприклад, Заміна вчителя або тема тесту' : 'e.g. Teacher substitution or test topic'}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Preview of display string */}
          <div className="p-3 bg-bg-tertiary rounded-lg text-xs space-y-1">
            <span className="font-semibold text-text-secondary">
              {language === 'uk' ? 'Відображення у щоденнику:' : 'Appearance in diary:'}
            </span>
            <div className="font-bold text-text-primary text-sm flex items-center gap-2 flex-wrap">
              {isCancelled ? (
                <span className="text-danger line-through">
                  {language === 'uk' ? 'Скасовано' : 'Cancelled'} ({originalSubject?.name})
                </span>
              ) : (
                <span>
                  {subjects.find((s) => s.id === selectedSubjectId)?.name || '...'} ({originalSubject?.name})
                </span>
              )}

              {eventType && (() => {
                const info = getEventTypeInfo(eventType, language);
                if (!info) return null;
                return (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold border shadow-2xs"
                    style={{
                      backgroundColor: `${info.color}20`,
                      color: info.color,
                      borderColor: `${info.color}40`,
                    }}
                  >
                    <span>{info.icon}</span>
                    <span>{info.label}</span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg-secondary gap-2 flex-wrap">
          {lesson.is_override ? (
            <button
              type="button"
              onClick={handleResetToRegular}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw size={14} />
              <span>{language === 'uk' ? 'Повернути оригінал' : 'Reset to Regular'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-3 py-1.5 text-xs text-text-muted hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{t('save')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
