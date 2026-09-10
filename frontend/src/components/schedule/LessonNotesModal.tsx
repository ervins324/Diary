import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  StickyNote,
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Loader2,
  Calendar,
  Clock,
  Image as ImageIcon,
  Link as LinkIcon,
  Maximize2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  useLessonNotes,
  useCreateLessonNote,
  useUpdateLessonNote,
  useDeleteLessonNote,
} from '../../hooks/useLessonNotes';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDate, formatTime, compressImageFile } from '../../lib/utils';
import { AttachmentChip } from '../homework/AttachmentChip';
import { AddLinkModal } from '../homework/AddLinkModal';
import { LightboxGallery } from '../homework/LightboxGallery';
import type { LessonSlot, LessonNote, Attachment } from '../../types';

interface LessonNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: LessonSlot;
}

export function LessonNotesModal({ isOpen, onClose, lesson }: LessonNotesModalProps) {
  const { t, language } = useLanguage();

  // New note state
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteImages, setNewNoteImages] = useState<string[]>([]);
  const [newNoteAttachments, setNewNoteAttachments] = useState<Attachment[]>([]);
  const [isLinkModalOpenForNew, setIsLinkModalOpenForNew] = useState(false);
  const newNoteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Inline edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [editingAttachments, setEditingAttachments] = useState<Attachment[]>([]);
  const [isLinkModalOpenForEdit, setIsLinkModalOpenForEdit] = useState(false);

  // Lightbox viewer state
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const subjectId = lesson.subject?.id || lesson.original_subject?.id;
  const { data: notesData, isLoading } = useLessonNotes(
    lesson.date,
    lesson.lesson_order,
    subjectId
  );

  const createMutation = useCreateLessonNote();
  const updateMutation = useUpdateLessonNote();
  const deleteMutation = useDeleteLessonNote();
  const uploadMutation = useFileUpload();

  // Combine query data with slot notes fallback
  const notes: LessonNote[] = notesData || lesson.notes || [];

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setNewNoteText('');
      setNewNoteImages([]);
      setNewNoteAttachments([]);
      setEditingNoteId(null);
      setEditingText('');
      setEditingImages([]);
      setEditingAttachments([]);
      setLightboxImages(null);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss modal or cancel active editing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImages) {
          setLightboxImages(null);
        } else if (editingNoteId) {
          setEditingNoteId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingNoteId, lightboxImages]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  /* Helper to process selected files (PDF, PPT/PPTX, Images) */
  const processFiles = async (
    files: FileList | null,
    onAddImage: (imgUrl: string) => void,
    onAddAttachment: (att: Attachment) => void
  ) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      const isPresentation =
        lowerName.endsWith('.pptx') ||
        lowerName.endsWith('.ppt') ||
        file.type.includes('presentation') ||
        file.type.includes('powerpoint');

      if (file.type === 'application/pdf' || isPresentation) {
        try {
          const uploaded = await uploadMutation.mutateAsync(file);
          onAddAttachment({
            id: uploaded.id,
            name: uploaded.filename,
            type: isPresentation ? 'presentation' : 'pdf',
            url: uploaded.url,
            size: uploaded.size,
          });
        } catch (err) {
          console.error('Failed to upload file to note:', err);
        }
      } else if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImageFile(file);
          onAddImage(compressed);
        } catch (err) {
          console.error('Failed to compress image for note:', err);
        }
      }
    }
  };

  /* Helper to process pasted image from clipboard */
  const processPaste = async (
    e: React.ClipboardEvent,
    onAddImage: (imgUrl: string) => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImageFile(file);
            onAddImage(compressed);
          } catch (err) {
            console.error('Failed to compress pasted image for note:', err);
          }
        }
      }
    }
  };

  /* Handle adding a new note */
  const handleAddNote = () => {
    const hasText = Boolean(newNoteText.trim());
    const hasMedia = newNoteImages.length > 0 || newNoteAttachments.length > 0;
    if ((!hasText && !hasMedia) || !subjectId) return;

    createMutation.mutate(
      {
        date: lesson.date,
        lesson_order: lesson.lesson_order,
        subject_id: subjectId,
        text: newNoteText.trim(),
        images: newNoteImages,
        attachments: newNoteAttachments,
      },
      {
        onSuccess: () => {
          setNewNoteText('');
          setNewNoteImages([]);
          setNewNoteAttachments([]);
          newNoteTextareaRef.current?.focus();
        },
      }
    );
  };

  /* Start inline editing */
  const handleStartEdit = (note: LessonNote) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setEditingImages(note.images || []);
    setEditingAttachments(note.attachments || []);
  };

  /* Save inline edit */
  const handleSaveEdit = (noteId: string) => {
    const hasText = Boolean(editingText.trim());
    const hasMedia = editingImages.length > 0 || editingAttachments.length > 0;
    if (!hasText && !hasMedia) return;

    updateMutation.mutate(
      {
        id: noteId,
        data: {
          text: editingText.trim(),
          images: editingImages,
          attachments: editingAttachments,
        },
      },
      {
        onSuccess: () => {
          setEditingNoteId(null);
          setEditingText('');
          setEditingImages([]);
          setEditingAttachments([]);
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

  const subjectName =
    lesson.subject?.name || lesson.original_subject?.name || (language === 'uk' ? 'Урок' : 'Lesson');

  const canSubmitNew =
    Boolean(newNoteText.trim()) || newNoteImages.length > 0 || newNoteAttachments.length > 0;

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
              <p className="text-xs text-text-muted flex items-center gap-2 mt-0.5 flex-wrap">
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
              const isEdited =
                note.updated_at && note.created_at && note.updated_at !== note.created_at;

              let formattedDate = '';
              try {
                formattedDate = format(parseISO(note.created_at), 'dd.MM.yyyy HH:mm');
              } catch {
                formattedDate = note.created_at;
              }

              return (
                <div
                  key={note.id}
                  className="p-3.5 rounded-lg border border-border bg-bg-secondary hover:border-border/80 transition-all flex flex-col gap-2.5"
                  onPaste={(e) => {
                    if (isEditing) {
                      processPaste(e, (img) => setEditingImages((prev) => [...prev, img]));
                    }
                  }}
                >
                  {isEditing ? (
                    /* Inline Edit Form */
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
                        placeholder={t('add_lesson_note_placeholder')}
                        className="w-full bg-bg-primary border border-border rounded-lg p-2.5 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
                        autoFocus
                      />

                      {/* Editing attachments chips */}
                      {editingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {editingAttachments.map((att, idx) => (
                            <AttachmentChip
                              key={idx}
                              attachment={att}
                              onRemove={() =>
                                setEditingAttachments((prev) => prev.filter((_, i) => i !== idx))
                              }
                            />
                          ))}
                        </div>
                      )}

                      {/* Editing images previews */}
                      {editingImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {editingImages.map((img, idx) => (
                            <div
                              key={idx}
                              className="relative w-14 h-14 rounded-lg border border-border overflow-hidden group shadow-2xs"
                            >
                              <img src={img} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingImages((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="absolute top-0 right-0 bg-danger/80 text-white rounded-bl p-0.5 hover:bg-danger transition-colors"
                                title="Remove"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Editing action toolbar */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/60 flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                          {/* Attach file / image */}
                          <label
                            className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-tertiary cursor-pointer transition-colors"
                            title={
                              language === 'uk'
                                ? 'Прикріпити PDF, PPTX або фото'
                                : 'Attach PDF, PPTX or image'
                            }
                          >
                            <ImageIcon size={15} />
                            <input
                              type="file"
                              accept="image/*,application/pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                              multiple
                              onChange={(e) => {
                                processFiles(
                                  e.target.files,
                                  (img) => setEditingImages((prev) => [...prev, img]),
                                  (att) => setEditingAttachments((prev) => [...prev, att])
                                );
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>

                          {/* Attach link */}
                          <button
                            type="button"
                            onClick={() => setIsLinkModalOpenForEdit(true)}
                            className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-tertiary transition-colors"
                            title={
                              language === 'uk'
                                ? 'Додати посилання на презентацію чи PDF'
                                : 'Add link to presentation or PDF'
                            }
                          >
                            <LinkIcon size={15} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
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
                            disabled={
                              updateMutation.isPending ||
                              (!editingText.trim() &&
                                editingImages.length === 0 &&
                                editingAttachments.length === 0)
                            }
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
                    </div>
                  ) : (
                    /* Normal Note Display */
                    <>
                      {note.text && (
                        <div className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                          {note.text}
                        </div>
                      )}

                      {/* Display attached images in thumbnail grid */}
                      {note.images && note.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {note.images.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setLightboxImages(note.images || []);
                                setLightboxIndex(idx);
                              }}
                              className="relative w-16 h-16 rounded-lg border border-border overflow-hidden cursor-pointer group shadow-2xs hover:ring-2 hover:ring-accent/50 transition-all"
                            >
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                <Maximize2
                                  size={14}
                                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Display attached files (PDF, Presentation, Links) */}
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {note.attachments.map((att, idx) => (
                            <AttachmentChip key={idx} attachment={att} />
                          ))}
                        </div>
                      )}

                      {/* Footer: timestamp + actions */}
                      <div className="flex items-center justify-between text-xs text-text-muted pt-1.5 border-t border-border/50">
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
        <div
          className="p-4 border-t border-border bg-bg-secondary"
          onPaste={(e) => processPaste(e, (img) => setNewNoteImages((prev) => [...prev, img]))}
        >
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

            {/* Pending attachments for new note */}
            {newNoteAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                {newNoteAttachments.map((att, idx) => (
                  <AttachmentChip
                    key={idx}
                    attachment={att}
                    onRemove={() =>
                      setNewNoteAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ))}
              </div>
            )}

            {/* Pending images for new note */}
            {newNoteImages.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                {newNoteImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative w-12 h-12 rounded-lg border border-border overflow-hidden group shadow-2xs"
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setNewNoteImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-0 right-0 bg-danger/80 text-white rounded-bl p-0.5 hover:bg-danger transition-colors"
                      title="Remove"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                {/* File / photo attach button */}
                <label
                  className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-tertiary cursor-pointer transition-colors"
                  title={
                    language === 'uk'
                      ? 'Прикріпити PDF, PPTX або фото'
                      : 'Attach PDF, PPTX or image'
                  }
                >
                  <ImageIcon size={16} />
                  <input
                    type="file"
                    accept="image/*,application/pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    multiple
                    onChange={(e) => {
                      processFiles(
                        e.target.files,
                        (img) => setNewNoteImages((prev) => [...prev, img]),
                        (att) => setNewNoteAttachments((prev) => [...prev, att])
                      );
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>

                {/* Link attach button */}
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpenForNew(true)}
                  className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-tertiary transition-colors"
                  title={
                    language === 'uk'
                      ? 'Додати посилання на презентацію чи PDF'
                      : 'Add link to presentation or PDF'
                  }
                >
                  <LinkIcon size={16} />
                </button>

                <span className="text-[11px] text-text-muted hidden sm:inline ml-2">
                  Ctrl + Enter {language === 'uk' ? 'для збереження' : 'to save'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddNote}
                disabled={createMutation.isPending || !canSubmitNew}
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

      {/* Add Link modal for new note */}
      {isLinkModalOpenForNew && (
        <AddLinkModal
          isOpen={isLinkModalOpenForNew}
          onClose={() => setIsLinkModalOpenForNew(false)}
          onAdd={(att) => {
            setNewNoteAttachments((prev) => [...prev, att]);
            setIsLinkModalOpenForNew(false);
          }}
        />
      )}

      {/* Add Link modal for editing note */}
      {isLinkModalOpenForEdit && (
        <AddLinkModal
          isOpen={isLinkModalOpenForEdit}
          onClose={() => setIsLinkModalOpenForEdit(false)}
          onAdd={(att) => {
            setEditingAttachments((prev) => [...prev, att]);
            setIsLinkModalOpenForEdit(false);
          }}
        />
      )}

      {/* Full-screen Lightbox Gallery for note images */}
      {lightboxImages && lightboxImages.length > 0 && (
        <LightboxGallery
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onNavigate={(idx) => setLightboxIndex(idx)}
          onClose={() => setLightboxImages(null)}
        />
      )}
    </div>,
    document.body
  );
}
