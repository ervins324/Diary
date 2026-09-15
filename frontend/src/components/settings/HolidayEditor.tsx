import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, Sparkles, Calendar, Loader2 } from 'lucide-react';
import { useHolidays, useSaveHoliday, useDeleteHoliday } from '../../hooks/useHolidays';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDate } from '../../lib/utils';
import { AiHolidayImportModal } from '../ai-import/AiHolidayImportModal';
import type { Holiday } from '../../types';

export function HolidayEditor() {
  const { t, language } = useLanguage();
  const { data: holidays = [], isLoading } = useHolidays();
  const saveMutation = useSaveHoliday();
  const deleteMutation = useDeleteHoliday();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New holiday form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  // Inline edit state
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const handleStartAdd = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setNewName('');
    setNewStartDate(todayStr);
    setNewEndDate(todayStr);
    setIsAdding(true);
  };

  const handleSaveNew = async () => {
    if (!newName.trim() || !newStartDate || !newEndDate) return;
    try {
      await saveMutation.mutateAsync({
        name: newName.trim(),
        start_date: newStartDate,
        end_date: newEndDate,
      });
      setIsAdding(false);
      setNewName('');
    } catch (err) {
      console.error('Failed to create holiday:', err);
    }
  };

  const handleStartEdit = (holiday: Holiday) => {
    setEditingId(holiday.id);
    setEditName(holiday.name);
    setEditStartDate(holiday.start_date);
    setEditEndDate(holiday.end_date);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editStartDate || !editEndDate) return;
    try {
      await saveMutation.mutateAsync({
        id,
        name: editName.trim(),
        start_date: editStartDate,
        end_date: editEndDate,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update holiday:', err);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(language === 'uk' ? `Видалити "${name}"?` : `Delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-light pb-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span className="text-lg">🏖️</span>
            <span>{t('holidays_manager_title')}</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{t('holidays_manager_desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <Sparkles size={13} />
            <span>{t('holiday_ai_import_btn')}</span>
          </button>
          <button
            type="button"
            onClick={handleStartAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>{t('add_holiday')}</span>
          </button>
        </div>
      </div>

      {/* Add New Holiday Form */}
      {isAdding && (
        <div className="p-3 bg-bg-primary rounded-xl border border-accent/40 space-y-3 animate-in fade-in duration-150">
          <span className="text-xs font-bold text-text-primary">{t('new_holiday_title')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder={t('holiday_name_placeholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              autoFocus
            />
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 text-xs border border-border rounded-lg text-text-secondary hover:bg-bg-tertiary cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending || !newName.trim()}
              onClick={handleSaveNew}
              className="px-3 py-1 text-xs bg-accent text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              <span>{t('save')}</span>
            </button>
          </div>
        </div>
      )}

      {/* List of Holidays */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-6 text-xs text-text-muted italic">
          {t('no_holidays_configured')}
        </div>
      ) : (
        <div className="space-y-2">
          {holidays.map((holiday) => {
            const isEditing = editingId === holiday.id;

            if (isEditing) {
              return (
                <div key={holiday.id} className="p-3 bg-bg-primary rounded-lg border border-accent/40 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(holiday.id)}
                      disabled={saveMutation.isPending}
                      className="px-3 py-1 text-xs bg-accent text-white font-medium rounded-md hover:opacity-90 cursor-pointer"
                    >
                      {t('save')}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-3 bg-bg-primary/60 rounded-lg border border-border text-xs hover:border-accent/40 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base">🏖️</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{holiday.name}</p>
                    <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                      <Calendar size={11} />
                      <span>
                        {formatDate(holiday.start_date)} — {formatDate(holiday.end_date)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(holiday)}
                    className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-bg-tertiary transition cursor-pointer"
                    title={t('edit')}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(holiday.id, holiday.name)}
                    className="p-1.5 text-text-muted hover:text-danger rounded-md hover:bg-danger/10 transition cursor-pointer"
                    title={t('delete')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Import Modal */}
      <AiHolidayImportModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}
