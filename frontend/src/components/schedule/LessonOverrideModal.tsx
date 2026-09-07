import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Check, ArrowLeftRight, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { fetchSubjects } from '../../api/client';
import { useSetScheduleOverride, useDeleteScheduleOverride } from '../../hooks/useScheduleOverrides';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDate } from '../../lib/utils';
import type { LessonSlot, Subject } from '../../types';

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
                {language === 'uk' ? 'Заміна уроку на дату' : 'Lesson Substitution for Date'}
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
          {/* Original lesson banner */}
          <div className="p-3 bg-bg-secondary rounded-lg border border-border flex items-start gap-2.5">
            <AlertCircle size={18} className="text-accent shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-text-primary">
                {language === 'uk' ? 'Регулярний урок за розкладом:' : 'Regular scheduled lesson:'}
              </span>{' '}
              <span className="font-bold text-text-primary">{originalSubject?.name}</span>
              {originalSubject?.default_cabinet && (
                <span className="text-text-muted"> ({t('cabinet_short')} {originalSubject.default_cabinet})</span>
              )}
              <p className="text-text-muted mt-0.5">
                {language === 'uk'
                  ? 'Зміна застосується тільки для цього конкретного тижня. Інші тижні не зміняться.'
                  : 'This change only affects this specific date. Other weeks remain unchanged.'}
              </p>
            </div>
          </div>

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
            <>
              {/* Substitute Subject selector */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  {language === 'uk' ? 'Урок на заміну (новий предмет)' : 'Substitute Subject (New Class)'}
                </label>
                {isLoadingSubjects ? (
                  <div className="flex items-center gap-2 text-text-muted py-2">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    <span>{language === 'uk' ? 'Завантаження...' : 'Loading...'}</span>
                  </div>
                ) : (
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.default_cabinet ? `(${t('cabinet_short')} ${s.default_cabinet})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Cabinet input */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  {language === 'uk' ? 'Кабінет / Аудиторія' : 'Cabinet / Classroom'}
                </label>
                <input
                  type="text"
                  value={cabinet}
                  onChange={(e) => setCabinet(e.target.value)}
                  placeholder={language === 'uk' ? 'Наприклад, 204' : 'e.g. 204'}
                  className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </>
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
              placeholder={language === 'uk' ? 'Наприклад, Заміна вчителя або чергування' : 'e.g. Teacher substitution'}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Preview of display string */}
          <div className="p-3 bg-bg-tertiary rounded-lg text-xs space-y-1">
            <span className="font-semibold text-text-secondary">
              {language === 'uk' ? 'Відображення у щоденнику:' : 'Appearance in diary:'}
            </span>
            <div className="font-bold text-text-primary text-sm">
              {isCancelled ? (
                <span className="text-danger line-through">
                  {language === 'uk' ? 'Скасовано' : 'Cancelled'} ({originalSubject?.name})
                </span>
              ) : (
                <span>
                  {subjects.find((s) => s.id === selectedSubjectId)?.name || '...'} ({originalSubject?.name})
                </span>
              )}
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
