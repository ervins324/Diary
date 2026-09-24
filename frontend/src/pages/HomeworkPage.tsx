import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  BookCheck,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { parseISO, isToday, isBefore, startOfDay, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { fetchSubjects } from '../api/client';
import { useHomework } from '../hooks/useHomework';
import { HomeworkCard } from '../components/homework/HomeworkCard';
import { HomeworkFormModal } from '../components/homework/HomeworkFormModal';
import { LightboxGallery } from '../components/homework/LightboxGallery';
import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '../lib/utils';
import type { HomeworkEntry, Subject } from '../types';

type FilterStatus = 'pending' | 'completed' | 'failed' | 'all';
type FilterTimeframe = 'all' | 'today' | 'this_week' | 'next_week' | 'overdue';
type SortOption = 'due_asc' | 'due_desc' | 'created_desc';

export function HomeworkPage() {
  const { t, language } = useLanguage();

  const [activeStatus, setActiveStatus] = useState<FilterStatus>('pending');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<FilterTimeframe>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('due_asc');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkEntry | null>(null);

  // Lightbox modal state
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const { data: homeworkList = [], isLoading } = useHomework();

  // Create subject lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const s of subjects) {
      map.set(s.id, s);
    }
    return map;
  }, [subjects]);

  // Aggregate high-level statistics across all homework
  const stats = useMemo(() => {
    const total = homeworkList.length;
    let pending = 0;
    let completed = 0;
    let failed = 0;
    let totalSeconds = 0;

    for (const h of homeworkList) {
      if (h.is_completed) completed++;
      else if (h.is_failed) failed++;
      else pending++;

      totalSeconds += h.time_spent_seconds || 0;
    }

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;
    const studyHours = Math.floor(totalSeconds / 3600);
    const studyMins = Math.round((totalSeconds % 3600) / 60);

    return {
      total,
      pending,
      completed,
      failed,
      completionRate,
      studyHours,
      studyMins,
    };
  }, [homeworkList]);

  // Filter and sort homework list
  const filteredHomework = useMemo(() => {
    return homeworkList
      .filter((h) => {
        // Status filter
        if (activeStatus === 'pending' && (h.is_completed || h.is_failed)) return false;
        if (activeStatus === 'completed' && !h.is_completed) return false;
        if (activeStatus === 'failed' && !h.is_failed) return false;

        // Subject filter
        if (selectedSubject !== 'all' && h.subject_id !== selectedSubject) return false;

        // Timeframe filter
        if (selectedTimeframe !== 'all') {
          try {
            const today = startOfDay(new Date());
            const due = startOfDay(parseISO(h.due_date));

            if (selectedTimeframe === 'today' && !isToday(due)) return false;
            if (selectedTimeframe === 'overdue' && !(isBefore(due, today) && !h.is_completed)) return false;
            if (selectedTimeframe === 'this_week') {
              const weekStart = startOfWeek(today, { weekStartsOn: 1 });
              const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
              if (due < weekStart || due > weekEnd) return false;
            }
            if (selectedTimeframe === 'next_week') {
              const nextWeek = addDays(today, 7);
              const nextStart = startOfWeek(nextWeek, { weekStartsOn: 1 });
              const nextEnd = endOfWeek(nextWeek, { weekStartsOn: 1 });
              if (due < nextStart || due > nextEnd) return false;
            }
          } catch {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const subject = subjectMap.get(h.subject_id);
          const subjectName = subject?.name?.toLowerCase() || '';
          const text = h.text?.toLowerCase() || '';
          const dueDate = h.due_date || '';

          if (!subjectName.includes(q) && !text.includes(q) && !dueDate.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'due_asc') {
          return a.due_date.localeCompare(b.due_date) || (a.lesson_order ?? 99) - (b.lesson_order ?? 99);
        }
        if (sortOption === 'due_desc') {
          return b.due_date.localeCompare(a.due_date) || (b.lesson_order ?? 99) - (a.lesson_order ?? 99);
        }
        // Recently added
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [homeworkList, activeStatus, selectedSubject, selectedTimeframe, searchQuery, sortOption, subjectMap]);

  // Open edit modal for an assignment
  const handleEdit = (hw: HomeworkEntry) => {
    setEditingHomework(hw);
    setIsModalOpen(true);
  };

  // Open create modal
  const handleCreate = () => {
    setEditingHomework(null);
    setIsModalOpen(true);
  };

  // Open image lightbox
  const handleOpenImage = (images: string[], initialIndex: number) => {
    setLightboxImages(images);
    setLightboxIndex(initialIndex);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-5 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-light text-accent flex items-center justify-center shadow-xs">
              <BookCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                {t('homework_title')}
              </h1>
              <p className="text-xs text-text-muted hidden sm:block">
                {t('homework_subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Add Homework */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-accent hover:bg-accent/90 text-white shadow-xs transition-all cursor-pointer active:scale-98"
          >
            <Plus size={18} />
            <span>{t('hw_add_new')}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Statistics Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tasks */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-2xs flex flex-col justify-between">
          <span className="text-xs text-text-muted font-medium">{t('hw_total_tasks')}</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-text-primary">{stats.total}</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">{t('hw_pending_tasks')}</span>
            <Hourglass size={14} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-amber-500">{stats.pending}</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">{t('hw_completed_tasks')}</span>
            <CheckCircle2 size={14} className="text-success" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-success">{stats.completed}</span>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">{t('hw_failed_tasks')}</span>
            <XCircle size={14} className={stats.failed > 0 ? 'text-danger' : 'text-text-muted'} />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={cn('text-2xl font-bold', stats.failed > 0 ? 'text-danger' : 'text-text-muted')}>
              {stats.failed}
            </span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-2xs flex flex-col justify-between">
          <span className="text-xs text-text-muted font-medium">{t('hw_completion_rate')}</span>
          <div className="space-y-1.5 mt-1">
            <span className="text-2xl font-bold text-text-primary">{stats.completionRate}%</span>
            <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Study Time */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">{t('hw_study_time')}</span>
            <Clock size={14} className="text-accent" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-accent">
              {stats.studyHours > 0 ? `${stats.studyHours}h ` : ''}
              {stats.studyMins}m
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar: Status Tabs, Subject Dropdown, Search Input, and Sort */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-3 md:p-4 shadow-2xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveStatus('pending')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
              activeStatus === 'pending'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary'
            )}
          >
            <span>{t('hw_filter_pending')}</span>
            <span className={cn('px-1.5 py-0.2 rounded-full text-[10px]', activeStatus === 'pending' ? 'bg-white/20' : 'bg-bg-secondary')}>
              {stats.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatus('completed')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
              activeStatus === 'completed'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary'
            )}
          >
            <span>{t('hw_filter_completed')}</span>
            <span className={cn('px-1.5 py-0.2 rounded-full text-[10px]', activeStatus === 'completed' ? 'bg-white/20' : 'bg-bg-secondary')}>
              {stats.completed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatus('failed')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
              activeStatus === 'failed'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary'
            )}
          >
            <span>{t('hw_filter_failed')}</span>
            <span className={cn('px-1.5 py-0.2 rounded-full text-[10px]', activeStatus === 'failed' ? 'bg-white/20' : 'bg-bg-secondary')}>
              {stats.failed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatus('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
              activeStatus === 'all'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary hover:text-text-primary'
            )}
          >
            <span>{t('hw_filter_all')}</span>
            <span className={cn('px-1.5 py-0.2 rounded-full text-[10px]', activeStatus === 'all' ? 'bg-white/20' : 'bg-bg-secondary')}>
              {stats.total}
            </span>
          </button>
        </div>

        {/* Secondary Filter Controls: Subject Dropdown, Search, Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('hw_search_placeholder')}
              className="w-full pl-9 pr-8 py-2 text-xs md:text-sm rounded-xl border border-border bg-bg-primary text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-primary rounded-md"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Subject Filter Dropdown */}
          <div className="sm:w-48">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-border bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
            >
              <option value="all">{t('hw_all_subjects')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter Dropdown */}
          <div className="sm:w-40">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as FilterTimeframe)}
              className="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-border bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
            >
              <option value="all">{t('hw_timeframe_all')}</option>
              <option value="today">{t('hw_timeframe_today')}</option>
              <option value="this_week">{t('hw_timeframe_this_week')}</option>
              <option value="next_week">{t('hw_timeframe_next_week')}</option>
              <option value="overdue">{t('hw_timeframe_overdue')}</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="sm:w-52">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-border bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
            >
              <option value="due_asc">{t('hw_sort_due_asc')}</option>
              <option value="due_desc">{t('hw_sort_due_desc')}</option>
              <option value="created_desc">{t('hw_sort_created')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Homework Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <Loader2 size={32} className="animate-spin text-accent" />
          <span className="text-sm text-text-muted">{language === 'uk' ? 'Завантаження завдань...' : 'Loading homework...'}</span>
        </div>
      ) : filteredHomework.length === 0 ? (
        /* Empty States */
        <div className="bg-bg-secondary/60 border border-border border-dashed rounded-3xl p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[35vh]">
          <div className="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-muted mb-3.5 shadow-2xs">
            {activeStatus === 'pending' ? (
              <Sparkles size={28} className="text-accent" />
            ) : activeStatus === 'completed' ? (
              <CheckCircle2 size={28} className="text-success" />
            ) : activeStatus === 'failed' ? (
              <CheckSquare size={28} className="text-accent" />
            ) : (
              <BookCheck size={28} className="text-text-muted" />
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">
            {activeStatus === 'pending'
              ? t('hw_empty_pending')
              : activeStatus === 'completed'
              ? t('hw_empty_completed')
              : activeStatus === 'failed'
              ? t('hw_empty_failed')
              : searchQuery || selectedSubject !== 'all'
              ? t('hw_empty_filtered')
              : t('hw_empty_all')}
          </h3>
          <p className="text-xs text-text-muted max-w-sm mb-4">
            {activeStatus === 'pending'
              ? (language === 'uk' ? 'Можна додати нове завдання або переглянути розклад.' : 'You can add a new assignment or review your schedule.')
              : (language === 'uk' ? 'Спробуйте змінити фільтри або додати нове завдання.' : 'Try changing your search filters or create a new assignment.')}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-accent text-white hover:bg-accent/90 shadow-xs transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('hw_add_new')}</span>
          </button>
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4">
          {filteredHomework.map((hw) => (
            <HomeworkCard
              key={hw.id}
              homework={hw}
              onEdit={handleEdit}
              onOpenImage={handleOpenImage}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button for Mobile screens */}
      <button
        type="button"
        onClick={handleCreate}
        className="md:hidden fixed bottom-20 right-4 z-40 w-13 h-13 rounded-2xl bg-accent hover:bg-accent/90 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
        aria-label={t('hw_add_new')}
      >
        <Plus size={26} />
      </button>

      {/* Homework Creation & Editing Modal */}
      <HomeworkFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingHomework}
      />

      {/* Lightbox Modal for Fullscreen Image Zoom */}
      {lightboxIndex !== null && (
        <LightboxGallery
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(index) => setLightboxIndex(index)}
        />
      )}
    </div>
  );
}
