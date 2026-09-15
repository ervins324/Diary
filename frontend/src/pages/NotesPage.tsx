import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  StickyNote,
  Search,
  Plus,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  X,
  Image as ImageIcon,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { fetchSubjects } from '../api/client';
import {
  useAllLessonNotes,
  useCreateLessonNote,
  useUpdateLessonNote,
  useDeleteLessonNote,
} from '../hooks/useLessonNotes';
import { useFileUpload } from '../hooks/useFileUpload';
import { AttachmentChip } from '../components/homework/AttachmentChip';
import { LightboxGallery } from '../components/homework/LightboxGallery';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate, compressImageFile, cn } from '../lib/utils';
import type { LessonNote, Subject, Attachment } from '../types';

export function NotesPage() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'subject' | 'timeline'>('subject');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // Add note modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newLessonOrder, setNewLessonOrder] = useState<number>(1);
  const [newText, setNewText] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);

  // Edit note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const { data: notes = [], isLoading } = useAllLessonNotes();
  const createMutation = useCreateLessonNote();
  const updateMutation = useUpdateLessonNote();
  const deleteMutation = useDeleteLessonNote();
  const uploadMutation = useFileUpload();

  // Create quick subject lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const s of subjects) {
      map.set(s.id, s);
    }
    return map;
  }, [subjects]);

  // Filter notes by search query and subject filter
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedSubjectFilter !== 'all' && n.subject_id !== selectedSubjectFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const subject = subjectMap.get(n.subject_id);
      const subjectName = subject?.name?.toLowerCase() || '';
      const text = n.text?.toLowerCase() || '';
      const date = n.date || '';

      return text.includes(q) || subjectName.includes(q) || date.includes(q);
    });
  }, [notes, searchQuery, selectedSubjectFilter, subjectMap]);

  // Group notes by subject
  const notesBySubject = useMemo(() => {
    const grouped = new Map<string, LessonNote[]>();

    for (const note of filteredNotes) {
      const existing = grouped.get(note.subject_id) || [];
      existing.push(note);
      grouped.set(note.subject_id, existing);
    }

    // Sort notes within each subject chronologically descending (newest first)
    for (const [, nList] of grouped.entries()) {
      nList.sort((a, b) => b.date.localeCompare(a.date) || b.lesson_order - a.lesson_order);
    }

    return grouped;
  }, [filteredNotes]);

  // Chronological timeline grouping (by date)
  const notesByDate = useMemo(() => {
    const grouped = new Map<string, LessonNote[]>();
    const sorted = [...filteredNotes].sort(
      (a, b) => b.date.localeCompare(a.date) || a.lesson_order - b.lesson_order
    );

    for (const note of sorted) {
      const existing = grouped.get(note.date) || [];
      existing.push(note);
      grouped.set(note.date, existing);
    }

    return grouped;
  }, [filteredNotes]);

  const toggleSubjectExpand = (subjectId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: prev[subjectId] === undefined ? false : !prev[subjectId],
    }));
  };

  const handleOpenAddForSubject = (subjectId: string) => {
    setNewSubjectId(subjectId);
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewLessonOrder(1);
    setNewText('');
    setNewImages([]);
    setNewAttachments([]);
    setIsAddModalOpen(true);
  };

  const handleCreateNote = async () => {
    if (!newSubjectId || !newText.trim()) return;
    try {
      await createMutation.mutateAsync({
        subject_id: newSubjectId,
        date: newDate,
        lesson_order: newLessonOrder,
        text: newText.trim(),
        images: newImages,
        attachments: newAttachments,
      });
      setIsAddModalOpen(false);
      setNewText('');
      setNewImages([]);
      setNewAttachments([]);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleStartEdit = (note: LessonNote) => {
    setEditingNoteId(note.id);
    setEditText(note.text);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editText.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: noteId,
        data: { text: editText.trim() },
      });
      setEditingNoteId(null);
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleDelete = (noteId: string) => {
    if (confirm(language === 'uk' ? 'Видалити цю нотатку?' : 'Delete this note?')) {
      deleteMutation.mutate(noteId);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
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
          setNewAttachments((prev) => [
            ...prev,
            {
              id: uploaded.id,
              name: uploaded.filename,
              type: isPresentation ? 'presentation' : 'pdf',
              url: uploaded.url,
              size: uploaded.size,
            },
          ]);
        } catch (err) {
          console.error('Failed to upload file:', err);
        }
      } else if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImageFile(file);
          setNewImages((prev) => [...prev, compressed]);
        } catch (err) {
          console.error('Failed to compress image:', err);
        }
      }
    }
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 space-y-5 pb-20 md:pb-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
            <StickyNote className="text-accent" size={26} />
            <span>{t('notes_page_title')}</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">{t('notes_page_desc')}</p>
        </div>

        {/* New Note Button */}
        <button
          type="button"
          onClick={() => {
            setNewSubjectId(subjects[0]?.id || '');
            setNewDate(new Date().toISOString().split('T')[0]);
            setNewLessonOrder(1);
            setNewText('');
            setNewImages([]);
            setNewAttachments([]);
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-xl text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-xs shrink-0 active:scale-95"
        >
          <Plus size={15} />
          <span>{t('add_note')}</span>
        </button>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-bg-secondary p-3 rounded-2xl border border-border">
        {/* Tabs: By Subject / Chronological */}
        <div className="flex items-center gap-1 bg-bg-tertiary p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('subject')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
              activeTab === 'subject'
                ? 'bg-bg-primary text-accent shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {t('notes_tab_by_subject')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
              activeTab === 'timeline'
                ? 'bg-bg-primary text-accent shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {t('notes_tab_chronological')}
          </button>
        </div>

        {/* Search & Subject Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={t('search_notes_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 bg-bg-primary border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="bg-bg-primary border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent cursor-pointer max-w-[150px] shrink-0"
          >
            <option value="all">{t('all_subjects')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 bg-bg-secondary rounded-2xl border border-border p-6">
          <StickyNote size={36} className="mx-auto text-text-muted opacity-40 mb-2" />
          <p className="text-sm font-medium text-text-muted">{t('no_notes_found')}</p>
          <p className="text-xs text-text-secondary mt-1">{t('no_notes_tip')}</p>
        </div>
      ) : activeTab === 'subject' ? (
        /* ── TAB 1: GROUPED BY SUBJECT ─────────────────────────────────── */
        <div className="space-y-4">
          {Array.from(notesBySubject.entries()).map(([subjectId, subjectNotes]) => {
            const subject = subjectMap.get(subjectId);
            const isExpanded = expandedSubjects[subjectId] !== false; // expanded by default

            return (
              <div
                key={subjectId}
                className="bg-bg-secondary rounded-2xl border border-border overflow-hidden transition-all shadow-xs"
              >
                {/* Subject Header */}
                <div
                  onClick={() => toggleSubjectExpand(subjectId)}
                  className="flex items-center justify-between p-4 bg-bg-secondary hover:bg-bg-tertiary/60 transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: subject?.color_hex || 'var(--color-accent)' }}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-bold text-text-primary text-base truncate">
                        {subject?.name || t('unknown_subject')}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-bg-tertiary text-text-muted shrink-0 border border-border/60">
                        {subjectNotes.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddForSubject(subjectId);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-bg-primary transition cursor-pointer"
                      title={t('add_note')}
                    >
                      <Plus size={16} />
                    </button>
                    {isExpanded ? <ChevronDown size={18} className="text-text-muted" /> : <ChevronRight size={18} className="text-text-muted" />}
                  </div>
                </div>

                {/* Notes List under Subject */}
                {isExpanded && (
                  <div className="p-3 pt-0 space-y-2.5 border-t border-border/40">
                    {subjectNotes.map((note) => {
                      const isEditing = editingNoteId === note.id;

                      return (
                        <div
                          key={note.id}
                          className="p-3.5 bg-bg-primary rounded-xl border border-border/80 text-xs space-y-2 hover:border-accent/40 transition shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-text-muted text-[11px]">
                              <span className="flex items-center gap-1 font-medium text-text-secondary">
                                <Calendar size={12} />
                                <span>{formatDate(note.date)}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                <span>
                                  {note.lesson_order} {t('lesson_order_short')}
                                </span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(note)}
                                className="p-1 text-text-muted hover:text-accent rounded transition cursor-pointer"
                                title={t('edit')}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(note.id)}
                                className="p-1 text-text-muted hover:text-danger rounded transition cursor-pointer"
                                title={t('delete')}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Note Text */}
                          {isEditing ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={3}
                                className="w-full p-2 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary cursor-pointer"
                                >
                                  {t('cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(note.id)}
                                  className="px-3 py-1 text-xs bg-accent text-white font-medium rounded-md hover:opacity-90 cursor-pointer"
                                >
                                  {t('save')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-text-primary text-xs leading-relaxed whitespace-pre-wrap">
                              {note.text}
                            </p>
                          )}

                          {/* Images */}
                          {note.images && note.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {note.images.map((img, idx) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt="Note attachment"
                                  onClick={() => {
                                    setLightboxImages(note.images || []);
                                    setLightboxIndex(idx);
                                  }}
                                  className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-85 transition"
                                />
                              ))}
                            </div>
                          )}

                          {/* Attachments */}
                          {note.attachments && note.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {note.attachments.map((att, idx) => (
                                <AttachmentChip key={idx} attachment={att} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TAB 2: CHRONOLOGICAL TIMELINE ────────────────────────────── */
        <div className="space-y-4">
          {Array.from(notesByDate.entries()).map(([dateStr, dateNotes]) => (
            <div key={dateStr} className="space-y-2">
              <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-xs py-1 flex items-center gap-2">
                <span className="font-bold text-sm text-text-primary">{formatDate(dateStr)}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-2 pl-2 border-l-2 border-accent/30 ml-2">
                {dateNotes.map((note) => {
                  const subject = subjectMap.get(note.subject_id);

                  return (
                    <div
                      key={note.id}
                      className="p-3 bg-bg-secondary rounded-xl border border-border text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: subject?.color_hex || 'var(--color-accent)' }}
                          />
                          <span className="font-bold text-text-primary truncate">
                            {subject?.name || t('unknown_subject')}
                          </span>
                          <span className="text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-tertiary">
                            {note.lesson_order} {t('lesson_order_short')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            className="p-1 text-text-muted hover:text-danger rounded transition cursor-pointer"
                            title={t('delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-text-primary whitespace-pre-wrap">{note.text}</p>

                      {/* Images */}
                      {note.images && note.images.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {note.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt="Note attachment"
                              onClick={() => {
                                setLightboxImages(note.images || []);
                                setLightboxIndex(idx);
                              }}
                              className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-85 transition"
                            />
                          ))}
                        </div>
                      )}

                      {/* Attachments */}
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {note.attachments.map((att, idx) => (
                            <AttachmentChip key={idx} attachment={att} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-bg-primary border border-border rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <StickyNote size={18} className="text-accent" />
                <span>{t('add_note')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  {t('subject')}
                </label>
                <select
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent cursor-pointer"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Lesson Order */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1">
                    {t('date')}
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1">
                    {t('lesson_order_label')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newLessonOrder}
                    onChange={(e) => setNewLessonOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Note Text */}
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  {t('note_text_label')}
                </label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={4}
                  placeholder={t('note_placeholder')}
                  className="w-full bg-bg-secondary border border-border rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              {/* Attachments preview and upload */}
              <div className="space-y-2">
                <label className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer">
                  <ImageIcon size={14} />
                  <span>{t('attach_files')}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.ppt,.pptx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {newImages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt="preview"
                          className="w-12 h-12 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => setNewImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white rounded-full flex items-center justify-center cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {newAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newAttachments.map((att, idx) => (
                      <div key={idx} className="relative group">
                        <AttachmentChip attachment={att} />
                        <button
                          type="button"
                          onClick={() => setNewAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white rounded-full flex items-center justify-center cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs text-text-secondary hover:bg-bg-tertiary cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={!newText.trim() || createMutation.isPending}
                onClick={handleCreateNote}
                className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                <span>{t('save')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Gallery */}
      {lightboxIndex !== null && (
        <LightboxGallery
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
