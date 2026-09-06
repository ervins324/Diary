import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Globe,
  Calendar,
  Download,
  Upload,
  AlertTriangle,
  FileSpreadsheet,
  CalendarClock,
  Archive,
  ArrowDownAZ,
  ArrowUpZA,
  Search,
} from 'lucide-react';
import {
  fetchSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  exportFullBackup,
  importFullBackup,
} from '../api/client';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { useLanguage } from '../i18n/LanguageContext';
import { useDeleteAllSchedule, useClearAllAppData } from '../hooks/useSchedule';
import { ScheduleEditorModal } from '../components/schedule/ScheduleEditorModal';
import { cn } from '../lib/utils';
import type { Subject } from '../types';

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [confirmPromptText, setConfirmPromptText] = useState('');
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  /* Weekend auto-advance toggle state (defaults to true) */
  const [skipWeekends, setSkipWeekends] = useState(() => localStorage.getItem('skip_weekends_to_monday') !== 'false');
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  /* Toggle weekend auto-advance behavior and persist to localStorage */
  const handleToggleWeekendSkip = () => {
    const nextVal = !skipWeekends;
    setSkipWeekends(nextVal);
    localStorage.setItem('skip_weekends_to_monday', nextVal ? 'true' : 'false');
  };

  /* Export complete JSON snapshot of all subjects, bells, rules, and homework */
  const handleExportFullBackup = async () => {
    try {
      setIsExportingBackup(true);
      const backupData = await exportFullBackup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school-diary-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export full backup:', err);
      alert('Failed to export backup.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  /* Restore complete database state from an uploaded JSON backup file */
  const handleImportFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!window.confirm(t('import_backup_confirm'))) {
      return;
    }

    try {
      setIsImportingBackup(true);
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importFullBackup(parsed);
      alert(`${t('import_backup_success')} (${result.imported.subjects} subjects, ${result.imported.bell_schedules} bells, ${result.imported.schedule_rules} lessons, ${result.imported.homeworks} homework)`);
      queryClient.invalidateQueries();
    } catch (err: any) {
      console.error('Failed to import backup:', err);
      alert(`${t('import_backup_failed')}${err.response?.data?.detail ? `: ${err.response.data.detail}` : ''}`);
    } finally {
      setIsImportingBackup(false);
    }
  };

  const deleteScheduleMutation = useDeleteAllSchedule();
  const clearAllMutation = useClearAllAppData();

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const createMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subject> }) => updateSubject(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Subject>>({});
  
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<Partial<Subject>>({
    name: '', short_name: '', color_hex: '#6366F1', default_cabinet: ''
  });

  /* Subject alphabetical sorting (asc = А-Я, desc = Я-А) and quick search */
  const [subjectSortOrder, setSubjectSortOrder] = useState<'asc' | 'desc'>('asc');
  const [subjectSearch, setSubjectSearch] = useState('');

  /* Memoized list sorted alphabetically and filtered by search query */
  const sortedAndFilteredSubjects = useMemo(() => {
    if (!subjects) return [];
    return [...subjects]
      .filter((s) => {
        if (!subjectSearch.trim()) return true;
        const q = subjectSearch.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.short_name && s.short_name.toLowerCase().includes(q)) ||
          (s.default_cabinet && s.default_cabinet.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, language === 'uk' ? 'uk' : 'en', { sensitivity: 'base' });
        return subjectSortOrder === 'asc' ? cmp : -cmp;
      });
  }, [subjects, subjectSortOrder, subjectSearch, language]);

  const handleEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setEditForm({ ...subject });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.name) {
      updateMutation.mutate({ id: editingId, data: editForm });
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('delete_subject_confirm'))) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    if (addForm.name) {
      createMutation.mutate(addForm, {
        onSuccess: () => {
          setIsAdding(false);
          setAddForm({ name: '', short_name: '', color_hex: '#6366F1', default_cabinet: '' });
        }
      });
    }
  };

  // Export subjects as a downloadable JSON file
  const handleExportSubjects = () => {
    if (!subjects || subjects.length === 0) return;
    const cleanSubjects = subjects.map(s => ({
      name: s.name,
      short_name: s.short_name,
      color_hex: s.color_hex,
      default_cabinet: s.default_cabinet,
    }));

    const blob = new Blob([JSON.stringify(cleanSubjects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subjects-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportNotification(t('exported_subjects_success'));
    setTimeout(() => setExportNotification(null), 3000);
  };

  // Delete only schedule rules
  const handleDeleteScheduleOnly = async () => {
    if (window.confirm(t('delete_schedule_confirm'))) {
      await deleteScheduleMutation.mutateAsync(undefined);
      alert(t('delete_schedule_success'));
    }
  };

  // Delete all application data
  const handleConfirmClearAll = async () => {
    if (confirmPromptText.trim().toUpperCase() !== 'DELETE') return;
    await clearAllMutation.mutateAsync();
    setIsClearingAll(false);
    setConfirmPromptText('');
    alert(t('delete_all_success'));
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-8">{t('settings')}</h1>

      <div className="space-y-8">
        {/* Appearance & Language */}
        <section className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4">
          <h2 className="text-lg font-semibold text-text-primary border-b border-border-light pb-2">{t('appearance')}</h2>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">{t('theme')}</p>
              <p className="text-sm text-text-muted">{t('theme_desc')}</p>
            </div>
            <div className="bg-bg-tertiary rounded-lg">
              <ThemeToggle />
            </div>
          </div>

          <div className="pt-3 border-t border-border-light flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary flex items-center gap-1.5">
                <Globe size={16} className="text-accent" />
                <span>{t('language')}</span>
              </p>
              <p className="text-sm text-text-muted">{t('language_desc')}</p>
            </div>
            <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border">
              <button
                onClick={() => setLanguage('uk')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  language === 'uk'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Українська
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Weekend Auto-Advance Toggle */}
          <div className="pt-3 border-t border-border-light flex items-center justify-between">
            <div className="pr-4">
              <p className="font-medium text-text-primary flex items-center gap-1.5">
                <CalendarClock size={16} className="text-accent" />
                <span>{t('skip_weekends_title')}</span>
              </p>
              <p className="text-sm text-text-muted">{t('skip_weekends_desc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={skipWeekends}
              onClick={handleToggleWeekendSkip}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent",
                skipWeekends ? "bg-accent" : "bg-bg-tertiary border border-border"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  skipWeekends ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </section>

        {/* Subjects */}
        <section className="bg-bg-secondary p-5 rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-border-light pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">{t('manage_subjects')}</h2>
              {subjects && (
                <span className="text-xs bg-bg-tertiary text-text-muted px-2 py-0.5 rounded-full font-medium">
                  {subjects.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Search */}
              <div className="relative flex-1 sm:w-48">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder={t('search_subjects')}
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full bg-bg-primary border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                {subjectSearch && (
                  <button
                    onClick={() => setSubjectSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Alphabetical Sort Toggle (A-Z / Z-A) */}
              <button
                type="button"
                onClick={() => setSubjectSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2.5 py-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors shrink-0"
                title={t('sort_alphabet')}
              >
                {subjectSortOrder === 'asc' ? <ArrowDownAZ size={15} className="text-accent" /> : <ArrowUpZA size={15} className="text-accent" />}
                <span>{subjectSortOrder === 'asc' ? 'А-Я' : 'Я-А'}</span>
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-accent" size={24} />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-text-secondary px-2 pb-1 hidden sm:grid">
                <div className="col-span-1">{t('color')}</div>
                <div 
                  className="col-span-4 cursor-pointer hover:text-accent flex items-center gap-1 transition-colors select-none"
                  onClick={() => setSubjectSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  title={t('sort_alphabet')}
                >
                  <span>{t('name')}</span>
                  {subjectSortOrder === 'asc' ? <ArrowDownAZ size={13} className="text-accent" /> : <ArrowUpZA size={13} className="text-accent" />}
                </div>
                <div className="col-span-3">{t('short_name')}</div>
                <div className="col-span-2">{t('cabinet')}</div>
                <div className="col-span-2 text-right">{t('actions')}</div>
              </div>

              {/* List */}
              {sortedAndFilteredSubjects.length === 0 && subjectSearch && (
                <div className="py-6 text-center text-xs text-text-muted italic">
                  {language === 'uk' ? 'Предметів не знайдено' : 'No subjects found'}
                </div>
              )}
              {sortedAndFilteredSubjects.map((subject) => (
                <div key={subject.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-bg-primary p-2 rounded border border-border-light text-sm">
                  {editingId === subject.id ? (
                    <>
                      <div className="col-span-1 sm:col-span-1 flex justify-center">
                        <input 
                          type="color" 
                          value={editForm.color_hex || '#000'} 
                          onChange={e => setEditForm({...editForm, color_hex: e.target.value})}
                          className="w-6 h-6 rounded cursor-pointer"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-4">
                        <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('subject_name_placeholder')} />
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <input type="text" value={editForm.short_name || ''} onChange={e => setEditForm({...editForm, short_name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('short_name_placeholder')} />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <input type="text" value={editForm.default_cabinet || ''} onChange={e => setEditForm({...editForm, default_cabinet: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('cabinet_placeholder')} />
                      </div>
                      <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
                        <button onClick={handleSaveEdit} className="text-success hover:bg-success/10 p-1 rounded"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="text-text-muted hover:bg-bg-tertiary p-1 rounded"><X size={16} /></button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-1 sm:col-span-1 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full sm:mx-auto" style={{ backgroundColor: subject.color_hex }} />
                        <span className="sm:hidden font-medium text-text-primary">{subject.name}</span>
                      </div>
                      <div className="col-span-1 sm:col-span-4 hidden sm:block truncate text-text-primary font-medium">{subject.name}</div>
                      <div className="col-span-1 sm:col-span-3 text-text-secondary truncate"><span className="sm:hidden text-xs mr-2">{t('short_name')}:</span>{subject.short_name}</div>
                      <div className="col-span-1 sm:col-span-2 text-text-secondary truncate"><span className="sm:hidden text-xs mr-2">{t('cabinet')}:</span>{subject.default_cabinet || '-'}</div>
                      <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 mt-2 sm:mt-0">
                        <button onClick={() => handleEdit(subject)} className="text-text-muted hover:text-accent p-1"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(subject.id)} className="text-text-muted hover:text-danger p-1"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add New */}
              {isAdding ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-accent-light/50 p-2 rounded border border-accent border-dashed text-sm mt-4">
                  <div className="col-span-1 flex justify-center">
                    <input type="color" value={addForm.color_hex} onChange={e => setAddForm({...addForm, color_hex: e.target.value})} className="w-6 h-6 rounded cursor-pointer" />
                  </div>
                  <div className="col-span-1 sm:col-span-4">
                    <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('subject_name_placeholder')} autoFocus />
                  </div>
                  <div className="col-span-1 sm:col-span-3">
                    <input type="text" value={addForm.short_name} onChange={e => setAddForm({...addForm, short_name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('short_name_placeholder')} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <input type="text" value={addForm.default_cabinet ?? ''} onChange={e => setAddForm({...addForm, default_cabinet: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('cabinet_placeholder')} />
                  </div>
                  <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
                    <button onClick={handleAdd} className="text-accent hover:bg-accent/10 p-1 rounded font-medium text-xs px-2">{t('save')}</button>
                    <button onClick={() => setIsAdding(false)} className="text-text-muted hover:bg-bg-tertiary p-1 rounded"><X size={16} /></button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="mt-4 w-full py-2 border-2 border-dashed border-border hover:border-accent hover:text-accent text-text-secondary rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                >
                  <Plus size={16} /> {t('add_subject')}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Schedule & Data Tools */}
        <section className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4">
          <h2 className="text-lg font-semibold text-text-primary border-b border-border-light pb-2">{t('schedule_editor')}</h2>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-text-primary flex items-center gap-2">
                <Calendar size={18} className="text-accent" />
                <span>{t('schedule_editor')}</span>
              </p>
              <p className="text-sm text-text-muted mt-0.5">{t('schedule_editor_desc')}</p>
            </div>
            <button
              onClick={() => setIsScheduleEditorOpen(true)}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-xs shrink-0"
            >
              <FileSpreadsheet size={16} />
              <span>{t('open_schedule_editor')}</span>
            </button>
          </div>

          <div className="pt-3 border-t border-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-text-primary flex items-center gap-2">
                <Download size={18} className="text-accent" />
                <span>{t('export_subjects')}</span>
              </p>
              <p className="text-sm text-text-muted mt-0.5">{t('export_subjects_desc')}</p>
              {exportNotification && (
                <p className="text-xs text-success font-medium mt-1 animate-in fade-in duration-200">
                  ✓ {exportNotification}
                </p>
              )}
            </div>
            <button
              onClick={handleExportSubjects}
              disabled={!subjects || subjects.length === 0}
              className="px-4 py-2 bg-bg-tertiary hover:bg-border text-text-primary rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-border shrink-0 disabled:opacity-50"
            >
              <Download size={16} />
              <span>{t('export_subjects')}</span>
            </button>
          </div>
        </section>

        {/* Backup & Restore (Full JSON) */}
        <section className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4">
          <h2 className="text-lg font-semibold text-text-primary border-b border-border-light pb-2 flex items-center gap-2">
            <Archive size={18} className="text-accent" />
            <span>{t('backup_restore')}</span>
          </h2>
          <p className="text-sm text-text-muted">{t('backup_restore_desc')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Export Full Backup */}
            <div className="p-4 bg-bg-primary rounded-lg border border-border flex flex-col justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                  <Download size={16} className="text-accent" />
                  <span>{t('export_full_backup')}</span>
                </p>
                <p className="text-xs text-text-muted mt-1">{t('export_full_backup_desc')}</p>
              </div>
              <button
                onClick={handleExportFullBackup}
                disabled={isExportingBackup}
                className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isExportingBackup ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>{t('export_full_backup')}</span>
              </button>
            </div>

            {/* Restore Full Backup */}
            <div className="p-4 bg-bg-primary rounded-lg border border-border flex flex-col justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                  <Upload size={16} className="text-accent" />
                  <span>{t('import_full_backup')}</span>
                </p>
                <p className="text-xs text-text-muted mt-1">{t('import_full_backup_desc')}</p>
              </div>
              <label className="w-full py-2 bg-bg-tertiary hover:bg-border text-text-primary rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-border cursor-pointer text-center">
                {isImportingBackup ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{t('import_full_backup')}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFullBackup}
                  disabled={isImportingBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Danger Zone: Data Wipe Controls */}
        <section className="bg-danger/5 border border-danger/30 p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2.5 text-danger border-b border-danger/20 pb-2">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold">{t('danger_zone')}</h2>
          </div>
          <p className="text-xs text-text-muted">{t('danger_zone_desc')}</p>

          {/* Delete Schedule Only */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-bg-secondary rounded-lg border border-border">
            <div>
              <p className="font-semibold text-text-primary text-sm">{t('delete_schedule_only')}</p>
              <p className="text-xs text-text-muted mt-0.5">{t('delete_schedule_only_desc')}</p>
            </div>
            <button
              onClick={handleDeleteScheduleOnly}
              disabled={deleteScheduleMutation.isPending}
              className="px-4 py-2 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-lg text-xs font-semibold transition-colors border border-danger/30 flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {deleteScheduleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>{t('delete_schedule_only')}</span>
            </button>
          </div>

          {/* Delete All Data */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-bg-secondary rounded-lg border border-danger/40">
            <div>
              <p className="font-semibold text-danger text-sm">{t('delete_all_data')}</p>
              <p className="text-xs text-text-muted mt-0.5">{t('delete_all_data_desc')}</p>
            </div>
            <button
              onClick={() => setIsClearingAll(true)}
              className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
            >
              <Trash2 size={14} />
              <span>{t('delete_all_data')}</span>
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation Modal for Complete Data Wipe */}
      {isClearingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-bg-secondary border border-danger/50 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{t('delete_all_data')}</h3>
                <p className="text-xs text-text-muted">{t('danger_zone')}</p>
              </div>
            </div>

            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium leading-relaxed">
              {t('delete_all_data_warning')}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary block">
                {t('delete_all_data_confirm_prompt')}
              </label>
              <input
                type="text"
                placeholder="DELETE"
                value={confirmPromptText}
                onChange={(e) => setConfirmPromptText(e.target.value)}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:border-danger focus:outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  setIsClearingAll(false);
                  setConfirmPromptText('');
                }}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmClearAll}
                disabled={confirmPromptText.trim().toUpperCase() !== 'DELETE' || clearAllMutation.isPending}
                className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {clearAllMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                <span>{t('delete_all_data')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Editor Modal */}
      <ScheduleEditorModal
        isOpen={isScheduleEditorOpen}
        onClose={() => setIsScheduleEditorOpen(false)}
      />
    </div>
  );
}
