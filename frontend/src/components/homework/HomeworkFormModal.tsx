import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Calendar, BookOpen, Image as ImageIcon, FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { fetchSubjects } from '../../api/client';
import { useCreateHomework, useUpdateHomework } from '../../hooks/useHomework';
import { useFileUpload } from '../../hooks/useFileUpload';
import { AddLinkModal } from './AddLinkModal';
import { AttachmentChip } from './AttachmentChip';
import { useLanguage } from '../../i18n/LanguageContext';
import { compressImageFile } from '../../lib/utils';
import type { HomeworkEntry, Subject, Attachment } from '../../types';

interface HomeworkFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: HomeworkEntry | null;
  defaultDate?: string;
  defaultSubjectId?: string;
}

export function HomeworkFormModal({
  isOpen,
  onClose,
  initialData,
  defaultDate,
  defaultSubjectId,
}: HomeworkFormModalProps) {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const createMutation = useCreateHomework();
  const updateMutation = useUpdateHomework();
  const uploadMutation = useFileUpload();

  const [subjectId, setSubjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    return defaultDate || format(addDays(new Date(), 1), 'yyyy-MM-dd');
  });
  const [assignedDate, setAssignedDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [lessonOrder, setLessonOrder] = useState<number | ''>('');
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  /* Reset or prefill form fields when modal opens or initialData changes */
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setSubjectId(initialData.subject_id);
        setDueDate(initialData.due_date);
        setAssignedDate(initialData.assigned_date || format(new Date(), 'yyyy-MM-dd'));
        setLessonOrder(initialData.lesson_order ?? '');
        setText(initialData.text || '');
        setImages(initialData.images || []);
        setAttachments(initialData.attachments || []);
      } else {
        setSubjectId(defaultSubjectId || (subjects.length > 0 ? subjects[0].id : ''));
        setDueDate(defaultDate || format(addDays(new Date(), 1), 'yyyy-MM-dd'));
        setAssignedDate(format(new Date(), 'yyyy-MM-dd'));
        setLessonOrder('');
        setText('');
        setImages([]);
        setAttachments([]);
      }
    }
  }, [isOpen, initialData, defaultDate, defaultSubjectId, subjects]);

  if (!isOpen) return null;

  /* Quick date shortcut handlers */
  const setQuickDate = (daysToAdd: number) => {
    setDueDate(format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd'));
  };

  /* Set due date to next Monday */
  const setNextMonday = () => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday
    const daysUntilMonday = ((8 - day) % 7) || 7;
    setDueDate(format(addDays(today, daysUntilMonday), 'yyyy-MM-dd'));
  };

  /* File upload handling for PDF, PPT, and images */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();
        const isPresentation = (
          lowerName.endsWith('.pptx') ||
          lowerName.endsWith('.ppt') ||
          file.type.includes('presentation') ||
          file.type.includes('powerpoint')
        );

        if (file.type === 'application/pdf' || isPresentation) {
          const uploaded = await uploadMutation.mutateAsync(file);
          setAttachments((prev) => [
            ...prev,
            {
              id: uploaded.id,
              name: uploaded.filename,
              type: isPresentation ? 'presentation' : 'pdf',
              url: uploaded.url,
              size: uploaded.size,
            },
          ]);
        } else if (file.type.startsWith('image/')) {
          const compressed = await compressImageFile(file);
          setImages((prev) => [...prev, compressed]);
        }
      }
    } catch (err) {
      console.error('Failed to upload/compress attachment:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /* Intercept Ctrl+V clipboard paste to directly attach screenshots */
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setIsUploading(true);
          try {
            const compressed = await compressImageFile(file);
            setImages((prev) => [...prev, compressed]);
          } catch (err) {
            console.error('Failed to compress pasted image:', err);
          } finally {
            setIsUploading(false);
          }
        }
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddLink = (newAttachment: Attachment) => {
    setAttachments((prev) => [...prev, newAttachment]);
    setIsLinkModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !dueDate || !text.trim()) return;

    const payload = {
      subject_id: subjectId,
      due_date: dueDate,
      assigned_date: assignedDate || undefined,
      lesson_order: typeof lessonOrder === 'number' ? lessonOrder : null,
      text: text.trim(),
      images,
      attachments,
    };

    if (initialData) {
      updateMutation.mutate(
        { id: initialData.id, data: payload },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || isUploading;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onPaste={handlePaste}
    >
      <div className="bg-bg-primary border border-border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-secondary/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-light text-accent flex items-center justify-center shadow-xs">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary leading-tight">
                {initialData ? t('hw_edit_title') : t('hw_create_title')}
              </h2>
              <p className="text-xs text-text-muted">
                {language === 'uk' ? 'Дедлайн, предмети та файли' : 'Due date, subject & attached materials'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Subject & Lesson Order Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <span>{t('hw_subject')}</span>
                <span className="text-danger">*</span>
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
              >
                <option value="" disabled>
                  {t('hw_subject_select')}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.default_cabinet ? `(${t('cabinet_short')}. ${s.default_cabinet})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                {t('hw_lesson_order_optional')}
              </label>
              <select
                value={lessonOrder}
                onChange={(e) => setLessonOrder(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((order) => (
                  <option key={order} value={order}>
                    {order} {language === 'uk' ? 'урок' : 'lesson'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <Calendar size={13} className="text-accent" />
                <span>{t('hw_due_date')}</span>
                <span className="text-danger">*</span>
              </label>
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-bg-tertiary hover:bg-accent-light hover:text-accent text-text-muted transition-colors"
                >
                  {t('hw_quick_today')}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-bg-tertiary hover:bg-accent-light hover:text-accent text-text-muted transition-colors"
                >
                  {t('hw_quick_tomorrow')}
                </button>
                <button
                  type="button"
                  onClick={setNextMonday}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-bg-tertiary hover:bg-accent-light hover:text-accent text-text-muted transition-colors"
                >
                  {t('hw_quick_next_week')}
                </button>
              </div>
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          {/* Task Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
              <span>{t('hw_text')}</span>
              <span className="text-[11px] text-text-muted font-normal">
                {language === 'uk' ? 'Можна вставити скриншот (Ctrl+V)' : 'Paste screenshot with Ctrl+V'}
              </span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('hw_text_placeholder')}
              rows={4}
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-bg-secondary text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <FileText size={13} className="text-accent" />
                <span>{t('hw_attachments')}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border"
                >
                  <ImageIcon size={13} className="text-accent" />
                  <span>{t('hw_add_photo')} / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border"
                >
                  <LinkIcon size={13} className="text-accent" />
                  <span>{t('hw_add_link')}</span>
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.pptx,.ppt"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Uploading indicator */}
            {isUploading && (
              <div className="flex items-center gap-2 py-2 px-3 text-xs text-accent bg-accent-light/50 rounded-xl">
                <Loader2 size={14} className="animate-spin" />
                <span>{language === 'uk' ? 'Обробка та завантаження файлів...' : 'Uploading & processing files...'}</span>
              </div>
            )}

            {/* Images Preview Grid */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-border shadow-2xs">
                    <img src={img} alt={`Attached ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-danger text-white rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Documents and Links Preview Chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((att, idx) => (
                  <AttachmentChip
                    key={idx}
                    attachment={att}
                    onRemove={() => handleRemoveAttachment(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-bg-secondary/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!subjectId || !dueDate || !text.trim() || isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-accent hover:bg-accent/90 text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('saving')}</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{initialData ? t('save') : t('hw_add_new')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Link Sub-modal */}
      <AddLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onAdd={handleAddLink}
      />
    </div>,
    document.body
  );
}
