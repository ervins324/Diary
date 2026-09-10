import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StickyNote, X, Plus, Trash2, Edit3, Check, Loader2, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLessonNotes, useCreateLessonNote, useUpdateLessonNote, useDeleteLessonNote } from '../../hooks/useLessonNotes';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDate, formatTime } from '../../lib/utils';
import type { LessonSlot, LessonNote } from '../../types';

interface LessonNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: LessonSlot;
}

export function LessonNotesModal({ isOpen, onClose, lesson }: LessonNotesModalProps) {
  const { t, language } = useLanguage();
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const newNoteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const subjectId = lesson.subject?.id || lesson.original_subject?.id;
  const { data: notesData, isLoading } = useLessonNotes(
    lesson.date,
    lesson.lesson_order,
    subjectId
  );

  const createMutation = useCreateLessonNote();
  const updateMutation = useUpdateLessonNote();
  const deleteMutation = useDeleteLessonNote();

  // Combine query data with slot notes fallback
  const notes: LessonNote[] = notesData || lesson.notes || [];

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setNewNoteText('');
      setEditingNoteId(null);
      setEditingText('');
    }
  }, [isOpen]);

  // Handle ESC key to dismiss modal or cancel active editing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingNoteId) {
          setEditingNoteId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingNoteId]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  /* Handle adding a new note */
  const handleAddNote = () => {
    if (!newNoteText.trim() || !subjectId) return;

    createMutation.mutate(
      {
        date: lesson.date,
        lesson_order: lesson.lesson_order,
        subject_id: subjectId,
        text: newNoteText.trim(),
      },
      {
        onSuccess: () => {
          setNewNoteText('');
          newNoteTextareaRef.current?.focus();
        },
      }
    );
  };

  /* Start inline editing */
  const handleStartEdit = (note: LessonNote) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
  };

  /* Save inline edit */
  const handleSaveEdit = (noteId: string) => {
    if (!editingText.trim()) return;

    updateMutation.mutate(
      { id: noteId, text: editingText.trim() },
      {
        onSuccess: () => {
          setEditingNoteId(null);
          setEditingText('');
        },
      }
    );
  };

  /* Delete note with confirmation */
  const handleDeleteNote = (noteId: string) => {
    if (confirm(t('delete_lesson_note_confirm') || 'Delete this note?')) {
      deleteMutation.mutate(noteId);
    }
  };

  const subjectName = lesson.subject?.name || lesson.original_subject?.name || (language === 'uk' ? 'Урок' : 'Lesson');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Decoupled static backdrop overlay for optimal GPU compositing */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 bg-bg-primary border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] transform-gpu">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <StickyNote size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-text-primary">
                  {t('lesson_notes_title')}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {notes.length} {notes.length === 1 ? t('note_singular') : t('notes_plural')}
                </span>
              </div>
              <p className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                <span className="font-medium text-text-primary">{subjectName}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(lesson.date)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
            title={t('cancel')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable notes list */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3 overscroll-contain">
          {isLoading && notes.length === 0 ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="animate-spin text-accent" size={24} />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center text-text-muted mb-3">
                <StickyNote size={24} />
              </div>
              <p className="text-sm font-medium text-text-secondary">
                {t('lesson_notes_empty')}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {t('lesson_notes_desc')}
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const isEdited = note.updated_at && note.created_at && note.updated_at !== note.created_at;

              let formattedDate = '';
              try {
                formattedDate = format(parseISO(note.created_at), 'dd.MM.yyyy HH:mm');
              } catch {
                formattedDate = note.created_at;
              }

              return (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border border-border bg-bg-secondary hover:border-border/80 transition-all flex flex-col gap-2"
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleSaveEdit(note.id);
                          }
                          if (e.key === 'Escape') {
                            setEditingNoteId(null);
                          }
                        }}
                        rows={3}
                        className="w-full bg-bg-primary border border-border rounded-lg p-2.5 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="px-2.5 py-1 text-xs text-text-muted hover:bg-bg-tertiary rounded-md transition-colors"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(note.id)}
                          disabled={updateMutation.isPending || !editingText.trim()}
                          className="flex items-center gap-1 px-3 py-1 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          <span>{t('save')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                        {note.text}
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border/50">
                        <span className="flex items-center gap-1 text-[11px]">
                          <span>{formattedDate}</span>
                          {isEdited && (
                            <span className="italic opacity-70">
                              ({language === 'uk' ? 'змінено' : 'edited'})
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(note)}
                            className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-tertiary transition-colors"
                            title={t('edit_lesson_note') || 'Edit note'}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Create new note */}
        <div className="p-4 border-t border-border bg-bg-secondary">
          <div className="flex flex-col gap-2">
            <textarea
              ref={newNoteTextareaRef}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder={t('add_lesson_note_placeholder')}
              rows={2}
              className="w-full bg-bg-primary border border-border rounded-lg p-2.5 text-sm text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted resize-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted hidden sm:inline">
                Ctrl + Enter {language === 'uk' ? 'для швидкого збереження' : 'to quickly save'}
              </span>
              <button
                type="button"
                onClick={handleAddNote}
                disabled={createMutation.isPending || !newNoteText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 active:scale-95 transition-all shadow-xs disabled:opacity-50 ml-auto"
              >
                {createMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                <span>{t('add_lesson_note')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
