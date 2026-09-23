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
  Clock,
  Archive,
  ArrowDownAZ,
  ArrowUpZA,
  Search,
  Palette,
  Brush,
  Sparkles,
  HardDrive,
  Database,
  RefreshCw,
  Layers,
  Info,
  FileText,
  PieChart,
  Wand2,
  Radio,
  BellRing,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import {
  fetchSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  exportFullBackup,
  importFullBackup,
  randomizeSubjectColors,
  cleanSystemData,
  CleanDataParams,
  fetchStorageStats,
  type StorageStatsResponse,
} from '../api/client';
import { formatFileSize } from '../components/homework/AttachmentChip';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { useLanguage } from '../i18n/LanguageContext';
import { useDeleteAllSchedule, useClearAllAppData } from '../hooks/useSchedule';
import { ScheduleEditorModal } from '../components/schedule/ScheduleEditorModal';
import { AiImportModal } from '../components/ai-import/AiImportModal';
import { HolidayEditor } from '../components/settings/HolidayEditor';
import { useAirAlerts } from '../hooks/useAirAlerts';
import { getAutoCleanConfig, saveAutoCleanConfig, type AutoCleanConfig } from '../hooks/useAutoClean';
import { cn } from '../lib/utils';
import { SettingsContents } from '../components/settings/SettingsContents';
import {
  isShowCabinetsEnabled,
  setShowCabinetsEnabled,
  isSkipWeekendsEnabled,
  setSkipWeekendsEnabled,
  getDayShiftAfterHour,
  setDayShiftAfterHour,
  getCachedLocalStorage,
  setCachedLocalStorage,
  getHwIconSize,
  setHwIconSize,
} from '../lib/storage';
import {
  getAllEventTypes,
  getCustomEventTypes,
  saveCustomEventTypes,
  getAllLessonTypes,
  getCustomLessonTypes,
  saveCustomLessonTypes,
  type CustomEventType,
  type CustomLessonType,
} from '../lib/customTypes';
import type { Subject } from '../types';

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [isAiImportModalOpen, setIsAiImportModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [confirmPromptText, setConfirmPromptText] = useState('');
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  /* Cabinets toggle state (defaults to true) */
  const [showCabinets, setShowCabinets] = useState(isShowCabinetsEnabled);

  /* Air Alerts Hook */
  const {
    alertsEnabled,
    setAlertsEnabled,
    selectedRegion,
    setSelectedRegion,
    autoCancelEnabled,
    setAutoCancelEnabled,
    isAlertActive,
    regions,
  } = useAirAlerts();

  const handleToggleCabinets = () => {
    const nextVal = !showCabinets;
    setShowCabinets(nextVal);
    setShowCabinetsEnabled(nextVal);
  };

  /* Weekend auto-advance toggle state (defaults to true) */
  const [skipWeekends, setSkipWeekends] = useState(isSkipWeekendsEnabled);

  /* Day-shift after cutoff hour state (defaults to null/off) */
  const [dayShiftHour, setDayShiftHourState] = useState<number | null>(getDayShiftAfterHour);

  /* Live Status Widget Settings */
  const [liveWidgetEnabled, setLiveWidgetEnabled] = useState(() => getCachedLocalStorage('live_widget_enabled') !== 'false');
  const [liveWidgetLesson, setLiveWidgetLesson] = useState(() => getCachedLocalStorage('live_widget_show_lesson') !== 'false');
  const [liveWidgetHw, setLiveWidgetHw] = useState(() => getCachedLocalStorage('live_widget_show_homework') !== 'false');
  const [liveWidgetEvents, setLiveWidgetEvents] = useState(() => getCachedLocalStorage('live_widget_show_events') !== 'false');

  const updateLiveWidgetSetting = (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val);
    setCachedLocalStorage(key, val ? 'true' : 'false');
    window.dispatchEvent(new Event('live_widget_settings_changed'));
  };

  /* Homework icon size setting */
  const [hwIconSize, setHwIconSizeState] = useState<'small' | 'medium' | 'large'>(() => getHwIconSize());
  const handleHwIconSizeChange = (size: 'small' | 'medium' | 'large') => {
    setHwIconSizeState(size);
    setHwIconSize(size);
  };

  /* Custom Event & Lesson Types State */

  const [customEvents, setCustomEvents] = useState<CustomEventType[]>(getAllEventTypes);
  const [customLessons, setCustomLessons] = useState<CustomLessonType[]>(getAllLessonTypes);

  // Form states for adding custom event
  const [newEventNameUk, setNewEventNameUk] = useState('');
  const [newEventNameEn, setNewEventNameEn] = useState('');
  const [newEventIcon, setNewEventIcon] = useState('🏆');
  const [newEventColor, setNewEventColor] = useState('#f59e0b');

  // Form states for adding custom lesson type
  const [newLessonNameUk, setNewLessonNameUk] = useState('');
  const [newLessonNameEn, setNewLessonNameEn] = useState('');
  const [newLessonIcon, setNewLessonIcon] = useState('🎓');
  const [newLessonColor, setNewLessonColor] = useState('#6366f1');

  const handleAddCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventNameUk.trim()) return;
    const slug = newEventNameUk.toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]/gi, '_');
    const existing = getCustomEventTypes();
    const newEntry: CustomEventType = {
      id: slug || `custom_event_${Date.now()}`,
      nameUk: newEventNameUk.trim(),
      nameEn: newEventNameEn.trim() || newEventNameUk.trim(),
      icon: newEventIcon.trim() || '📌',
      color: newEventColor || '#3b82f6',
      isCustom: true,
    };
    const updated = [...existing, newEntry];
    saveCustomEventTypes(updated);
    setCustomEvents(getAllEventTypes());
    setNewEventNameUk('');
    setNewEventNameEn('');
  };

  const handleDeleteCustomEvent = (id: string) => {
    const existing = getCustomEventTypes();
    const updated = existing.filter((e) => e.id !== id);
    saveCustomEventTypes(updated);
    setCustomEvents(getAllEventTypes());
  };

  const handleAddCustomLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonNameUk.trim()) return;
    const slug = newLessonNameUk.toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]/gi, '_');
    const existing = getCustomLessonTypes();
    const newEntry: CustomLessonType = {
      id: slug || `custom_lesson_${Date.now()}`,
      nameUk: newLessonNameUk.trim(),
      nameEn: newLessonNameEn.trim() || newLessonNameUk.trim(),
      icon: newLessonIcon.trim() || '📚',
      color: newLessonColor || '#6366f1',
      isCustom: true,
    };
    const updated = [...existing, newEntry];
    saveCustomLessonTypes(updated);
    setCustomLessons(getAllLessonTypes());
    setNewLessonNameUk('');
    setNewLessonNameEn('');
  };

  const handleDeleteCustomLesson = (id: string) => {
    const existing = getCustomLessonTypes();
    const updated = existing.filter((l) => l.id !== id);
    saveCustomLessonTypes(updated);
    setCustomLessons(getAllLessonTypes());
  };

  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  /* Cleaning Section State */
  const [autoClean, setAutoClean] = useState<AutoCleanConfig>(getAutoCleanConfig);
  const [manualMode, setManualMode] = useState<'before' | 'range'>('before');
  const [manualCutoffDate, setManualCutoffDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [manualStartDate, setManualStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [manualEndDate, setManualEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualCleanHw, setManualCleanHw] = useState(true);
  const [manualCleanCompletedOnly, setManualCleanCompletedOnly] = useState(false);
  const [manualCleanOverrides, setManualCleanOverrides] = useState(true);
  const [manualCleanOrphans, setManualCleanOrphans] = useState(true);
  const [isExecutingCleanup, setIsExecutingCleanup] = useState(false);
  const [cleanupResultMsg, setCleanupResultMsg] = useState<string | null>(null);

  /* Update auto-clean config */
  const handleUpdateAutoClean = (updates: Partial<AutoCleanConfig>) => {
    const next = { ...autoClean, ...updates };
    setAutoClean(next);
    saveAutoCleanConfig(next);
  };

  /* Storage stats query */
  const {
    data: storageData,
    isLoading: isLoadingStorage,
    isFetching: isFetchingStorage,
    refetch: refetchStorage,
  } = useQuery<StorageStatsResponse>({
    queryKey: ['storage-stats'],
    queryFn: fetchStorageStats,
  });

  /* Execute manual time-step cleanup */
  const handleExecuteManualCleanup = async () => {
    if (!window.confirm(t('cleanup_confirm_prompt'))) {
      return;
    }

    try {
      setIsExecutingCleanup(true);
      setCleanupResultMsg(null);

      const params: CleanDataParams = {
        clean_homework: manualCleanHw,
        clean_completed_homework_only: manualCleanCompletedOnly,
        clean_schedule_overrides: manualCleanOverrides,
        clean_orphaned_files: manualCleanOrphans,
      };

      if (manualMode === 'before') {
        params.before_date = manualCutoffDate;
      } else {
        params.start_date = manualStartDate;
        params.end_date = manualEndDate;
      }

      const res = await cleanSystemData(params);
      const { homework, schedule_overrides, stored_files } = res.deleted;
      const msg = `${t('cleanup_success')} (${homework} HW, ${schedule_overrides} overrides, ${stored_files} files)`;
      setCleanupResultMsg(msg);
      setTimeout(() => setCleanupResultMsg(null), 5000);

      // Invalidate relevant queries to refresh timetable and homework
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    } catch (err: any) {
      console.error('Manual cleanup failed:', err);
      alert(`Cleanup failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsExecutingCleanup(false);
    }
  };

  /* Toggle weekend auto-advance behavior and persist to localStorage */
  const handleToggleWeekendSkip = () => {
    const nextVal = !skipWeekends;
    setSkipWeekends(nextVal);
    setSkipWeekendsEnabled(nextVal);
  };

  /* Change day-shift-after cutoff hour and persist to localStorage */
  const handleDayShiftChange = (value: string) => {
    const hour = value === 'off' ? null : parseInt(value, 10);
    setDayShiftHourState(hour);
    setDayShiftAfterHour(hour);
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
    } catch (err: any) {
      console.error('Failed to export full backup:', err);
      const detail = err.response?.data?.detail || err.message || '';
      alert(`${t('export_backup_failed')}${detail ? `: ${detail}` : ''}`);
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
      const detail = err.response?.data?.detail || err.message || '';
      alert(`${t('import_backup_failed')}${detail ? `: ${detail}` : ''}`);
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

  /* Randomize all subject colors with unique palette */
  const randomizeColorsMutation = useMutation({
    mutationFn: randomizeSubjectColors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
      alert(t('delete_schedule_success'));
    }
  };

  // Delete all application data
  const handleConfirmClearAll = async () => {
    if (confirmPromptText.trim().toUpperCase() !== 'DELETE') return;
    await clearAllMutation.mutateAsync();
    queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    setIsClearingAll(false);
    setConfirmPromptText('');
    alert(t('delete_all_success'));
  };

  /* Calculate storage metrics */
  const totalStorageBytes = storageData?.total_bytes ?? 0;
  const filesCategory = storageData?.categories.find((c) => c.is_file_storage || c.id === 'files');
  const filesStorageBytes = filesCategory?.bytes ?? 0;
  const dbStorageBytes = Math.max(0, totalStorageBytes - filesStorageBytes);

  const filesPercentage = totalStorageBytes > 0
    ? Math.round((filesStorageBytes / totalStorageBytes) * 1000) / 10
    : 0;
  const dbPercentage = totalStorageBytes > 0
    ? Math.round((dbStorageBytes / totalStorageBytes) * 1000) / 10
    : 0;

  const categoryColorMap: Record<string, string> = {
    files: '#6366F1', // Accent / Indigo
    homework: '#0EA5E9', // Sky
    schedule_rules: '#10B981', // Emerald
    overrides: '#F59E0B', // Amber
    bells: '#8B5CF6', // Violet
    subjects: '#EC4899', // Pink
  };

  const getCategoryLabel = (id: string, fallback: string) => {
    switch (id) {
      case 'files': return t('storage_category_files');
      case 'homework': return t('storage_category_homework');
      case 'schedule_rules': return t('storage_category_schedule_rules');
      case 'overrides': return t('storage_category_overrides');
      case 'bells': return t('storage_category_bells');
      case 'subjects': return t('storage_category_subjects');
      default: return fallback;
    }
  };

  const storageChartData = useMemo(() => {
    if (!storageData?.categories) return [];
    return storageData.categories.map((cat) => {
      const pct = totalStorageBytes > 0 ? Math.round((cat.bytes / totalStorageBytes) * 1000) / 10 : 0;
      return {
        id: cat.id,
        name: getCategoryLabel(cat.id, cat.label),
        bytes: cat.bytes,
        count: cat.count,
        percentage: pct,
        formattedSize: formatFileSize(cat.bytes) || '0 B',
        color: categoryColorMap[cat.id] || '#6366F1',
        is_file_storage: cat.is_file_storage,
      };
    });
  }, [storageData, totalStorageBytes, language]);

  const CustomStorageTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-bg-primary p-2.5 rounded-lg border border-border shadow-xl text-xs space-y-1 z-50">
          <p className="font-semibold text-text-primary flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </p>
          <div className="flex items-center justify-between gap-4 text-text-secondary">
            <span>{t('storage_total')}:</span>
            <span className="font-semibold text-accent">{data.formattedSize}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-text-secondary">
            <span>{t('clean_target_types')}:</span>
            <span className="font-medium text-text-primary">{data.percentage}%</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-text-muted text-[11px]">
            <span>{t('items_deleted')}:</span>
            <span>{data.count}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="settings-scroll-container" className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">{t('settings')}</h1>

      {/* Mobile / Tablet Inline Wikipedia Contents (Hidden on desktop where it is in the sidebar) */}
      <div className="md:hidden mb-6">
        <SettingsContents />
      </div>

      <div className="space-y-8">
            {/* Appearance & Language */}
            <section id="appearance" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4 scroll-mt-6">
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

              {/* Homework Icon Size on Mobile */}
              <div className="pt-3 border-t border-border-light flex items-center justify-between">
                <div className="pr-4">
                  <p className="font-medium text-text-primary flex items-center gap-1.5">
                    <Brush size={16} className="text-accent" />
                    <span>{t('hw_icon_size')}</span>
                  </p>
                  <p className="text-sm text-text-muted">{t('hw_icon_size_desc')}</p>
                </div>
                <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleHwIconSizeChange(size)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        hwIconSize === size
                          ? 'bg-accent text-white shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t(`hw_icon_size_${size}` as any)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Preferences & Automation */}
            <section id="preferences" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4 scroll-mt-6">
              <h2 className="text-lg font-semibold text-text-primary border-b border-border-light pb-2">{t('section_preferences')}</h2>

              {/* Weekend Auto-Advance Toggle */}
              <div className="flex items-center justify-between">
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

              {/* Day-Shift After Cutoff Hour */}
              <div className="pt-3 border-t border-border-light flex items-center justify-between">
                <div className="pr-4">
                  <p className="font-medium text-text-primary flex items-center gap-1.5">
                    <Clock size={16} className="text-accent" />
                    <span>{t('day_shift_title')}</span>
                  </p>
                  <p className="text-sm text-text-muted">{t('day_shift_desc')}</p>
                </div>
                <select
                  value={dayShiftHour === null ? 'off' : String(dayShiftHour)}
                  onChange={(e) => handleDayShiftChange(e.target.value)}
                  className="bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer min-w-[90px]"
                >
                  <option value="off">{t('day_shift_off')}</option>
                  <option value="14">14:00</option>
                  <option value="15">15:00</option>
                  <option value="16">16:00</option>
                  <option value="17">17:00</option>
                  <option value="18">18:00</option>
                  <option value="19">19:00</option>
                  <option value="20">20:00</option>
                </select>
              </div>

              {/* Classroom Cabinets Toggle */}
              <div className="pt-3 border-t border-border-light flex items-center justify-between">
                <div className="pr-4">
                  <p className="font-medium text-text-primary flex items-center gap-1.5">
                    {showCabinets ? <Eye size={16} className="text-accent" /> : <EyeOff size={16} className="text-text-muted" />}
                    <span>{t('hide_cabinets_title')}</span>
                  </p>
                  <p className="text-sm text-text-muted">{t('hide_cabinets_desc')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showCabinets}
                  onClick={handleToggleCabinets}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent",
                    showCabinets ? "bg-accent" : "bg-bg-tertiary border border-border"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                      showCabinets ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Live Schedule Status Widget Toggles */}
              <div className="pt-3 border-t border-border-light space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <p className="font-medium text-text-primary flex items-center gap-1.5">
                      <Sparkles size={16} className="text-accent" />
                      <span>{t('live_widget_title')}</span>
                    </p>
                    <p className="text-sm text-text-muted">{t('live_widget_desc')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={liveWidgetEnabled}
                    onClick={() => updateLiveWidgetSetting('live_widget_enabled', !liveWidgetEnabled, setLiveWidgetEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent",
                      liveWidgetEnabled ? "bg-accent" : "bg-bg-tertiary border border-border"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                        liveWidgetEnabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {liveWidgetEnabled && (
                  <div className="pl-4 space-y-2 border-l-2 border-accent/30 py-1">
                    <label className="flex items-center justify-between text-xs text-text-secondary cursor-pointer">
                      <span>{t('live_widget_show_lesson_label')}</span>
                      <input
                        type="checkbox"
                        checked={liveWidgetLesson}
                        onChange={(e) => updateLiveWidgetSetting('live_widget_show_lesson', e.target.checked, setLiveWidgetLesson)}
                        className="rounded text-accent focus:ring-accent"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs text-text-secondary cursor-pointer">
                      <span>{t('live_widget_show_hw_label')}</span>
                      <input
                        type="checkbox"
                        checked={liveWidgetHw}
                        onChange={(e) => updateLiveWidgetSetting('live_widget_show_homework', e.target.checked, setLiveWidgetHw)}
                        className="rounded text-accent focus:ring-accent"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs text-text-secondary cursor-pointer">
                      <span>{t('live_widget_show_events_label')}</span>
                      <input
                        type="checkbox"
                        checked={liveWidgetEvents}
                        onChange={(e) => updateLiveWidgetSetting('live_widget_show_events', e.target.checked, setLiveWidgetEvents)}
                        className="rounded text-accent focus:ring-accent"
                      />
                    </label>
                  </div>
                )}
              </div>
            </section>

            {/* Custom Event & Lesson Types */}
            <section id="custom-types" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-6 scroll-mt-6">
              <div className="border-b border-border-light pb-2">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Layers size={18} className="text-accent" />
                  <span>{t('section_custom_types')}</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {language === 'uk'
                    ? 'Створюйте власні типи контрольних, подій та занять з унікальними іконками та кольорами'
                    : 'Manage built-in templates and create custom event and lesson types with custom icons and colors'}
                </p>
              </div>

              {/* Subsection: Event Types (Assessments & Deadlines) */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <span>🔥</span>
                  <span>{language === 'uk' ? 'Типи подій та оцінювання (контрольні, тести)' : 'Event & Assessment Types'}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg bg-bg-tertiary/60 border border-border flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base shrink-0">{ev.icon}</span>
                        <div className="truncate">
                          <span className="font-semibold text-xs text-text-primary block truncate">
                            {language === 'uk' ? ev.nameUk : ev.nameEn}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {ev.isCustom ? (language === 'uk' ? 'Користувацький' : 'Custom') : (language === 'uk' ? 'Вбудований шаблон' : 'Built-in template')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                          style={{ backgroundColor: ev.color }}
                          title={ev.color}
                        />
                        {ev.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomEvent(ev.id)}
                            className="text-text-muted hover:text-danger p-1 rounded transition-colors"
                            title={language === 'uk' ? 'Видалити цей тип' : 'Delete this event type'}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new event type form */}
                <form
                  onSubmit={handleAddCustomEvent}
                  className="p-3 bg-bg-tertiary/30 rounded-lg border border-border/80 space-y-3"
                >
                  <span className="font-semibold text-xs text-text-secondary flex items-center gap-1">
                    <Plus size={13} className="text-accent" />
                    <span>{language === 'uk' ? 'Додати новий тип події' : 'Add New Event Type'}</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={language === 'uk' ? 'Назва українською (напр., Олімпіада)' : 'Name (e.g., Olympiad)'}
                      value={newEventNameUk}
                      onChange={(e) => setNewEventNameUk(e.target.value)}
                      required
                      className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder={language === 'uk' ? 'Назва англійською (необовʼязково)' : 'English name (optional)'}
                      value={newEventNameEn}
                      onChange={(e) => setNewEventNameEn(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-text-muted">{language === 'uk' ? 'Іконка:' : 'Icon:'}</label>
                      <input
                        type="text"
                        value={newEventIcon}
                        onChange={(e) => setNewEventIcon(e.target.value)}
                        className="w-10 text-center bg-bg-secondary border border-border rounded-lg py-1 text-sm focus:border-accent focus:outline-none"
                      />
                      <div className="flex items-center gap-1">
                        {['🏆', '🔬', '🎓', '💡', '📌', '🎯', '🧪'].map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setNewEventIcon(ic)}
                            className="p-1 text-xs hover:bg-bg-secondary rounded cursor-pointer"
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-text-muted">{language === 'uk' ? 'Колір:' : 'Color:'}</label>
                      <input
                        type="color"
                        value={newEventColor}
                        onChange={(e) => setNewEventColor(e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <button
                        type="submit"
                        disabled={!newEventNameUk.trim()}
                        className="px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>{language === 'uk' ? 'Додати' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Subsection: Lesson Types */}
              <div className="space-y-3 pt-3 border-t border-border-light">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <span>📖</span>
                  <span>{language === 'uk' ? 'Типи уроків (лекція, практика, семінар)' : 'Lesson Types'}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customLessons.map((les) => (
                    <div
                      key={les.id}
                      className="p-2.5 rounded-lg bg-bg-tertiary/60 border border-border flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base shrink-0">{les.icon}</span>
                        <div className="truncate">
                          <span className="font-semibold text-xs text-text-primary block truncate">
                            {language === 'uk' ? les.nameUk : les.nameEn}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {les.isCustom ? (language === 'uk' ? 'Користувацький' : 'Custom') : (language === 'uk' ? 'Вбудований' : 'Default')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                          style={{ backgroundColor: les.color }}
                          title={les.color}
                        />
                        {les.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomLesson(les.id)}
                            className="text-text-muted hover:text-danger p-1 rounded transition-colors"
                            title={language === 'uk' ? 'Видалити цей тип уроку' : 'Delete this lesson type'}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new lesson type form */}
                <form
                  onSubmit={handleAddCustomLesson}
                  className="p-3 bg-bg-tertiary/30 rounded-lg border border-border/80 space-y-3"
                >
                  <span className="font-semibold text-xs text-text-secondary flex items-center gap-1">
                    <Plus size={13} className="text-accent" />
                    <span>{language === 'uk' ? 'Додати новий тип уроку' : 'Add New Lesson Type'}</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={language === 'uk' ? 'Назва уроку (напр., Майстер-клас)' : 'Lesson type name'}
                      value={newLessonNameUk}
                      onChange={(e) => setNewLessonNameUk(e.target.value)}
                      required
                      className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder={language === 'uk' ? 'Англійська назва' : 'English name'}
                      value={newLessonNameEn}
                      onChange={(e) => setNewLessonNameEn(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-text-muted">{language === 'uk' ? 'Іконка:' : 'Icon:'}</label>
                      <input
                        type="text"
                        value={newLessonIcon}
                        onChange={(e) => setNewLessonIcon(e.target.value)}
                        className="w-10 text-center bg-bg-secondary border border-border rounded-lg py-1 text-sm focus:border-accent focus:outline-none"
                      />
                      <div className="flex items-center gap-1">
                        {['📖', '🛠️', '🔬', '💬', '💡', '⭐', '🎓', '🎨'].map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setNewLessonIcon(ic)}
                            className="p-1 text-xs hover:bg-bg-secondary rounded cursor-pointer"
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-text-muted">{language === 'uk' ? 'Колір:' : 'Color:'}</label>
                      <input
                        type="color"
                        value={newLessonColor}
                        onChange={(e) => setNewLessonColor(e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <button
                        type="submit"
                        disabled={!newLessonNameUk.trim()}
                        className="px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>{language === 'uk' ? 'Додати' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

        {/* Subjects */}
        <section id="subjects" className="bg-bg-secondary p-5 rounded-xl border border-border scroll-mt-6">
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

              {/* Randomize Subject Colors */}
              <button
                type="button"
                onClick={() => randomizeColorsMutation.mutate()}
                disabled={randomizeColorsMutation.isPending}
                className="px-2.5 py-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                title={t('randomize_colors')}
              >
                {randomizeColorsMutation.isPending ? <Loader2 size={15} className="animate-spin text-accent" /> : <Palette size={15} className="text-accent" />}
                <span className="hidden sm:inline">{t('colors')}</span>
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
        <section id="schedule-tools" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4 scroll-mt-6">
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

          {/* AI Timetable Importer Card */}
          <div className="pt-3 border-t border-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-text-primary flex items-center gap-2">
                <Wand2 size={18} className="text-accent" />
                <span>{t('ai_schedule_settings_title')}</span>
              </p>
              <p className="text-sm text-text-muted mt-0.5">{t('ai_schedule_settings_desc')}</p>
            </div>
            <button
              onClick={() => setIsAiImportModalOpen(true)}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-xs shrink-0"
            >
              <Wand2 size={16} />
              <span>{t('ai_schedule_open_import')}</span>
            </button>
          </div>

          {/* School Holidays & Vacations Editor */}
          <div className="pt-3 border-t border-border-light">
            <HolidayEditor />
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
        <section id="backup" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4 scroll-mt-6">
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

        {/* Data Cleaning & Storage Management */}
        <section id="storage" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-6 scroll-mt-6">
          <div className="border-b border-border-light pb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Brush size={18} className="text-accent" />
              <span>{t('cleaning_section')}</span>
            </h2>
            {cleanupResultMsg && (
              <span className="text-xs text-success font-semibold animate-in fade-in duration-200">
                ✓ {cleanupResultMsg}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">{t('cleaning_section_desc')}</p>

          {/* Subsection 0: Storage Space Breakdown & Diagram */}
          <div className="p-4 bg-bg-primary rounded-lg border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-light pb-3">
              <div>
                <p className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                  <HardDrive size={16} className="text-accent" />
                  <span>{t('storage_stats_title')}</span>
                </p>
                <p className="text-xs text-text-muted mt-0.5">{t('storage_stats_desc')}</p>
              </div>
              <button
                type="button"
                onClick={() => refetchStorage()}
                disabled={isFetchingStorage}
                className="self-start sm:self-auto px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-accent bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                title={t('storage_refresh')}
              >
                <RefreshCw size={12} className={cn(isFetchingStorage && "animate-spin text-accent")} />
                <span>{t('storage_refresh')}</span>
              </button>
            </div>

            {isLoadingStorage ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
                <Loader2 size={20} className="animate-spin text-accent" />
                <span>Loading storage breakdown...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 3 Overview Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total Storage Card */}
                  <div className="p-3 bg-bg-secondary rounded-lg border border-border flex flex-col justify-between">
                    <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
                      <Database size={13} className="text-accent" />
                      <span>{t('storage_total')}</span>
                    </span>
                    <div className="mt-2">
                      <p className="text-lg font-bold text-text-primary">
                        {formatFileSize(totalStorageBytes) || '0 B'}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {storageData?.categories.reduce((acc, c) => acc + c.count, 0) ?? 0} {t('storage_count_label').replace('{count}', '')}
                      </p>
                    </div>
                  </div>

                  {/* Files Total Card (Highlight) */}
                  <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-accent flex items-center gap-1.5">
                        <FileText size={13} />
                        <span>{t('storage_files_total')}</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent font-bold rounded-full">
                        {filesPercentage}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-bold text-accent">
                        {formatFileSize(filesStorageBytes) || '0 B'}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {filesCategory?.count ?? 0} files
                      </p>
                    </div>
                  </div>

                  {/* Relational DB Total Card */}
                  <div className="p-3 bg-bg-secondary rounded-lg border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
                        <Layers size={13} className="text-emerald-500" />
                        <span>{t('storage_db_total')}</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary text-text-secondary font-medium rounded-full">
                        {dbPercentage}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-bold text-text-primary">
                        {formatFileSize(dbStorageBytes) || '0 B'}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {storageData?.categories.filter(c => !c.is_file_storage).reduce((acc, c) => acc + c.count, 0) ?? 0} text records
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visual Ratio Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-primary flex items-center gap-1.5">
                      <PieChart size={13} className="text-accent" />
                      <span>{t('storage_chart_title')}</span>
                    </span>
                    <span className="text-[11px] font-medium text-accent">
                      {t('storage_files_share_note').replace('{percent}', String(filesPercentage))}
                    </span>
                  </div>

                  {/* Segmented Bar */}
                  <div className="h-3 w-full bg-bg-tertiary rounded-full overflow-hidden flex border border-border/50">
                    <div
                      style={{ width: `${Math.max(filesPercentage, filesStorageBytes > 0 ? 3 : 0)}%` }}
                      className="bg-accent transition-all duration-500"
                      title={`${t('storage_files_total')}: ${formatFileSize(filesStorageBytes)} (${filesPercentage}%)`}
                    />
                    <div
                      style={{ width: `${Math.max(dbPercentage, dbStorageBytes > 0 ? 3 : 0)}%` }}
                      className="bg-emerald-500/80 transition-all duration-500"
                      title={`${t('storage_db_total')}: ${formatFileSize(dbStorageBytes)} (${dbPercentage}%)`}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-text-muted gap-1 px-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-accent inline-block shrink-0" />
                      <span>{t('storage_files_total')}: <strong className="text-text-primary">{formatFileSize(filesStorageBytes) || '0 B'}</strong> ({filesPercentage}%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block shrink-0" />
                      <span>{t('storage_db_total')}: <strong className="text-text-primary">{formatFileSize(dbStorageBytes) || '0 B'}</strong> ({dbPercentage}%)</span>
                    </span>
                  </div>
                </div>

                {/* Visual Insight Alert Box */}
                <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 flex items-start gap-2.5 text-xs text-text-secondary leading-relaxed">
                  <Info size={16} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-text-primary mb-0.5">
                      {t('storage_chart_insight')}
                    </p>
                  </div>
                </div>

                {/* Recharts Bar Chart Diagram */}
                <div className="space-y-2 pt-1">
                  <div className="h-56 w-full bg-bg-secondary p-3 rounded-lg border border-border">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={storageChartData}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <XAxis
                          type="number"
                          tickFormatter={(v) => formatFileSize(v)}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--color-text-primary)', fontSize: 11 }}
                        />
                        <Tooltip content={<CustomStorageTooltip />} cursor={{ fill: 'var(--color-bg-tertiary)' }} />
                        <Bar dataKey="bytes" radius={[0, 4, 4, 0]} maxBarSize={18}>
                          {storageChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Subcategories Breakdown for Files (PDF, PPTX, Images) */}
                {filesCategory?.subcategories && filesCategory.bytes > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-text-secondary mb-2">
                      {t('storage_files_total')} Breakdown:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2 bg-bg-secondary rounded-lg border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-red-500">PDF</span>
                        <p className="text-xs font-bold text-text-primary mt-0.5">
                          {formatFileSize(filesCategory.subcategories.pdf?.bytes) || '0 B'}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {filesCategory.subcategories.pdf?.count || 0} files
                        </p>
                      </div>

                      <div className="p-2 bg-bg-secondary rounded-lg border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-500">PowerPoint</span>
                        <p className="text-xs font-bold text-text-primary mt-0.5">
                          {formatFileSize(filesCategory.subcategories.presentation?.bytes) || '0 B'}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {filesCategory.subcategories.presentation?.count || 0} files
                        </p>
                      </div>

                      <div className="p-2 bg-bg-secondary rounded-lg border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-emerald-500">Images</span>
                        <p className="text-xs font-bold text-text-primary mt-0.5">
                          {formatFileSize(filesCategory.subcategories.images?.bytes) || '0 B'}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {filesCategory.subcategories.images?.count || 0} files
                        </p>
                      </div>

                      <div className="p-2 bg-bg-secondary rounded-lg border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-text-secondary">Other</span>
                        <p className="text-xs font-bold text-text-primary mt-0.5">
                          {formatFileSize(filesCategory.subcategories.other?.bytes) || '0 B'}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {filesCategory.subcategories.other?.count || 0} files
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subsection 1: Automatic Background Cleaning */}
          <div className="p-4 bg-bg-primary rounded-lg border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-light pb-3">
              <div>
                <p className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                  <Sparkles size={16} className="text-accent" />
                  <span>{t('auto_cleaning_title')}</span>
                </p>
                <p className="text-xs text-text-muted mt-0.5">{t('auto_cleaning_desc')}</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoClean.enabled}
                  onChange={(e) => handleUpdateAutoClean({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-border"></div>
              </label>
            </div>

            {/* Retention schedule and types (active if enabled) */}
            <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 transition-opacity", !autoClean.enabled && "opacity-50 pointer-events-none")}>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  {t('retention_period')}
                </label>
                <select
                  value={autoClean.retention}
                  onChange={(e) => handleUpdateAutoClean({ retention: e.target.value as any })}
                  className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="2_weeks">{t('retention_2_weeks')}</option>
                  <option value="1_month">{t('retention_1_month')}</option>
                  <option value="3_months">{t('retention_3_months')}</option>
                  <option value="6_months">{t('retention_6_months')}</option>
                  <option value="1_year">{t('retention_1_year')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  {t('clean_target_types')}
                </label>
                <div className="space-y-1.5 pt-0.5">
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoClean.cleanHomework}
                      onChange={(e) => handleUpdateAutoClean({ cleanHomework: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>{t('clean_hw_label')}</span>
                  </label>

                  {autoClean.cleanHomework && (
                    <label className="flex items-center gap-2 text-xs text-text-muted pl-5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoClean.cleanCompletedHomeworkOnly}
                        onChange={(e) => handleUpdateAutoClean({ cleanCompletedHomeworkOnly: e.target.checked })}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <span>{t('clean_completed_only_label')}</span>
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoClean.cleanScheduleOverrides}
                      onChange={(e) => handleUpdateAutoClean({ cleanScheduleOverrides: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>{t('clean_overrides_label')}</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoClean.cleanOrphanedFiles}
                      onChange={(e) => handleUpdateAutoClean({ cleanOrphanedFiles: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>{t('clean_orphans_label')}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Subsection 2: Manual Time-Step Cleanup Button & Filters */}
          <div className="p-4 bg-bg-primary rounded-lg border border-border space-y-4">
            <div>
              <p className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                <CalendarClock size={16} className="text-accent" />
                <span>{t('manual_cleanup_title')}</span>
              </p>
              <p className="text-xs text-text-muted mt-0.5">{t('manual_cleanup_desc')}</p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Mode Selector */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setManualMode('before')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    manualMode === 'before'
                      ? "bg-accent/15 border-accent text-accent font-semibold"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary"
                  )}
                >
                  {t('mode_before_cutoff')}
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode('range')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    manualMode === 'range'
                      ? "bg-accent/15 border-accent text-accent font-semibold"
                      : "bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary"
                  )}
                >
                  {t('mode_date_range')}
                </button>
              </div>

              {/* Date pickers depending on mode */}
              {manualMode === 'before' ? (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {t('cutoff_date')} (delete everything prior to this date)
                  </label>
                  <input
                    type="date"
                    value={manualCutoffDate}
                    onChange={(e) => setManualCutoffDate(e.target.value)}
                    className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      {t('from_date')}
                    </label>
                    <input
                      type="date"
                      value={manualStartDate}
                      onChange={(e) => setManualStartDate(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      {t('to_date')}
                    </label>
                    <input
                      type="date"
                      value={manualEndDate}
                      onChange={(e) => setManualEndDate(e.target.value)}
                      className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              {/* Data types checkboxes for manual purge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border-light">
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualCleanHw}
                    onChange={(e) => setManualCleanHw(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span>{t('clean_hw_label')}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualCleanOverrides}
                    onChange={(e) => setManualCleanOverrides(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span>{t('clean_overrides_label')}</span>
                </label>

                {manualCleanHw && (
                  <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={manualCleanCompletedOnly}
                      onChange={(e) => setManualCleanCompletedOnly(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>{t('clean_completed_only_label')}</span>
                  </label>
                )}

                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={manualCleanOrphans}
                    onChange={(e) => setManualCleanOrphans(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span>{t('clean_orphans_label')}</span>
                </label>
              </div>

              {/* Manual Cleanup Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecuteManualCleanup}
                  disabled={isExecutingCleanup || (!manualCleanHw && !manualCleanOverrides && !manualCleanOrphans)}
                  className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  {isExecutingCleanup ? <Loader2 size={14} className="animate-spin" /> : <Brush size={14} />}
                  <span>{t('execute_cleanup')}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Air Raid Alerts Integration (Neptun API) */}
        <section id="air-alerts" className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <div className="flex items-center gap-2">
              <Radio size={20} className={isAlertActive ? "text-danger animate-pulse" : "text-accent"} />
              <h2 className="text-lg font-semibold text-text-primary">{t('air_alerts_title')}</h2>
            </div>
            {alertsEnabled && (
              <span className={cn(
                "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border shadow-xs",
                isAlertActive
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              )}>
                <BellRing size={12} />
                <span>{isAlertActive ? t('air_alerts_active_status') : t('air_alerts_safe_status')}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">{t('air_alerts_desc')}</p>

          <div className="space-y-4 pt-2">
            {/* Enable switch */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-text-primary text-sm">{t('air_alerts_enable')}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {language === 'uk'
                    ? 'Підключення до живого потоку тривог для вашої області'
                    : 'Connect to live air alarm updates for your chosen region'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={alertsEnabled}
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent",
                  alertsEnabled ? "bg-accent" : "bg-bg-tertiary border border-border"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    alertsEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {alertsEnabled && (
              <>
                {/* Region Selector */}
                <div className="pt-3 border-t border-border-light">
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    {t('air_alerts_region')}
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full sm:w-80 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                  >
                    {regions.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {language === 'uk' ? reg.nameUk : reg.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Cancel Lessons during active alert */}
                <div className="pt-3 border-t border-border-light flex items-center justify-between">
                  <div className="pr-4">
                    <p className="font-medium text-text-primary text-sm">{t('air_alerts_auto_cancel')}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {language === 'uk'
                        ? 'Якщо під час уроку діє тривога, він автоматично позначається скасованим. Ви зможете скасувати це вручну в один клік.'
                        : 'If an alarm is active during lesson hours, it is marked cancelled automatically. You can undo anytime.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoCancelEnabled}
                    onClick={() => setAutoCancelEnabled(!autoCancelEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent",
                      autoCancelEnabled ? "bg-accent" : "bg-bg-tertiary border border-border"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                        autoCancelEnabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </>
            )}

            {/* Mandatory Attribution Link */}
            <div className="pt-2 border-t border-border-light text-[11px] text-text-muted">
              <span>{t('air_alerts_attribution')}: </span>
              <a
                href="https://neptun.in.ua"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline hover:text-accent/80 font-medium"
              >
                neptun.in.ua
              </a>
            </div>
          </div>
        </section>

        {/* Danger Zone: Data Wipe Controls */}
        <section id="danger-zone" className="bg-danger/5 border border-danger/30 p-5 rounded-xl space-y-4 scroll-mt-6">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => {
              setIsClearingAll(false);
              setConfirmPromptText('');
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-bg-secondary border border-danger/50 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 transform-gpu">
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

      {/* AI Schedule Import Modal */}
      <AiImportModal
        isOpen={isAiImportModalOpen}
        onClose={() => setIsAiImportModalOpen(false)}
      />
    </div>
  );
}
