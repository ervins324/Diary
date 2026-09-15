import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Calendar,
  BookOpen,
  Bell,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Globe,
  Download,
  Trash2,
  Clock,
  Sparkles,
  Calculator,
  Check,
  CornerDownLeft,
  X,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  StickyNote,
} from 'lucide-react';
import { fetchSubjects } from '../../api/client';
import type { Subject } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../i18n/LanguageContext';
import { evaluateMathExpression } from '../../lib/mathEvaluator';
import { cn } from '../../lib/utils';

export interface CommandItem {
  id: string;
  category: 'recent' | 'pages' | 'subjects' | 'actions' | 'calc';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  badge?: string;
  color?: string;
  onSelect: () => void;
  keywords?: string[];
}

const PAGE_DEFINITIONS = [
  { path: '/', translationKey: 'nav_daily', icon: Calendar, num: '1' },
  { path: '/diary', translationKey: 'nav_diary', icon: BookOpen, num: '2' },
  { path: '/notes', translationKey: 'nav_notes', icon: StickyNote, num: '3' },
  { path: '/bells', translationKey: 'nav_bells', icon: Bell, num: '4' },
  { path: '/stats', translationKey: 'nav_stats', icon: BarChart3, num: '5' },
  { path: '/settings', translationKey: 'nav_settings', icon: Settings, num: '6' },
] as const;

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch subjects for search suggestions
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  // Keep track of visited paths for Alt-Tab quick switcher history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('diary_recent_pages');
      const recents: string[] = stored ? JSON.parse(stored) : [];
      const updated = [location.pathname, ...recents.filter((p) => p !== location.pathname)].slice(0, 5);
      localStorage.setItem('diary_recent_pages', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }, [location.pathname]);

  // Global hotkeys listener: Ctrl+K / Cmd+K / Alt+Space / Alt+Q / Alt+Tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // 2. Alt+Space (Spotlight / Flow Launcher style)
      if (e.altKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // 3. Alt+Q (Reliable Alt-Tab web equivalent)
      if (e.altKey && e.code === 'KeyQ') {
        e.preventDefault();
        setIsOpen(true);
        // Pre-highlight next recent item
        setSelectedIndex(1);
        return;
      }

      // 4. Custom event from buttons
      // Handled separately below
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  // Reset query and focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Safe Math calculation check
  const mathResult = useMemo(() => {
    return evaluateMathExpression(query);
  }, [query]);

  // Build command list based on state
  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // 1. Math Calculator Result (if query evaluates to valid arithmetic)
    if (mathResult) {
      items.push({
        id: 'calc-result',
        category: 'calc',
        title: `= ${mathResult.formatted}`,
        subtitle: `${mathResult.expression} • ${t('action_calc_copy')}`,
        icon: <Calculator className="w-5 h-5 text-accent" />,
        shortcut: '↵',
        badge: t('command_palette_cat_calc'),
        onSelect: () => {
          navigator.clipboard.writeText(String(mathResult.result));
          setCopiedText(mathResult.formatted);
          setTimeout(() => {
            setCopiedText(null);
            setIsOpen(false);
          }, 800);
        },
      });
    }

    // 2. Alt-Tab Recent Pages (when query is empty)
    if (!query.trim()) {
      try {
        const stored = localStorage.getItem('diary_recent_pages');
        const recents: string[] = stored ? JSON.parse(stored) : [];
        const recentPages = recents.length > 0 ? recents : PAGE_DEFINITIONS.map((p) => p.path);

        recentPages.forEach((path, idx) => {
          const def = PAGE_DEFINITIONS.find((p) => p.path === path);
          if (def) {
            const isCurrent = location.pathname === path;
            const Icon = def.icon;
            items.push({
              id: `recent-${path}`,
              category: 'recent',
              title: t(def.translationKey),
              subtitle: isCurrent ? (language === 'uk' ? 'Поточна вкладка' : 'Current page') : path,
              icon: <Icon className={cn('w-5 h-5', isCurrent ? 'text-accent' : 'text-text-muted')} />,
              shortcut: String(idx + 1),
              badge: isCurrent ? 'Active' : undefined,
              onSelect: () => {
                navigate(path);
                setIsOpen(false);
              },
            });
          }
        });
      } catch {
        // Ignore fallback
      }
    }

    // 3. Pages & Views
    PAGE_DEFINITIONS.forEach((def) => {
      const Icon = def.icon;
      items.push({
        id: `page-${def.path}`,
        category: 'pages',
        title: t(def.translationKey),
        subtitle: def.path,
        icon: <Icon className="w-5 h-5 text-accent" />,
        shortcut: `Alt+${def.num}`,
        onSelect: () => {
          navigate(def.path);
          setIsOpen(false);
        },
        keywords: [def.path, def.translationKey, 'розклад', 'день', 'щоденник', 'дзвінки', 'статистика', 'налаштування'],
      });
    });

    // 4. Subjects
    subjects.forEach((sub) => {
      items.push({
        id: `sub-${sub.id}`,
        category: 'subjects',
        title: sub.name,
        subtitle: `${sub.short_name ? `[${sub.short_name}] ` : ''}${t('subject_action_view')}`,
        icon: (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs shrink-0"
            style={{ backgroundColor: sub.color_hex || '#3b82f6' }}
          >
            {sub.name.charAt(0).toUpperCase()}
          </span>
        ),
        badge: sub.short_name,
        color: sub.color_hex,
        onSelect: () => {
          navigate('/diary');
          setIsOpen(false);
        },
        keywords: [sub.name, sub.short_name || '', 'предмет', 'урок', 'lesson', 'subject'],
      });
    });

    // 5. Quick Actions
    items.push(
      {
        id: 'action-theme',
        category: 'actions',
        title: t('action_toggle_theme'),
        subtitle: theme === 'dark' ? (language === 'uk' ? 'Світла тема' : 'Light Mode') : (language === 'uk' ? 'Темна тема' : 'Dark Mode'),
        icon: theme === 'dark' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />,
        shortcut: 'T',
        onSelect: () => {
          toggleTheme();
          setIsOpen(false);
        },
        keywords: ['тема', 'колір', 'світла', 'темна', 'dark', 'light', 'theme'],
      },
      {
        id: 'action-language',
        category: 'actions',
        title: t('action_toggle_language'),
        subtitle: language === 'uk' ? 'English' : 'Українська',
        icon: <Globe className="w-5 h-5 text-blue-500" />,
        shortcut: 'L',
        onSelect: () => {
          setLanguage(language === 'uk' ? 'en' : 'uk');
          setIsOpen(false);
        },
        keywords: ['мова', 'англійська', 'українська', 'language', 'lang', 'english', 'ukrainian'],
      },
      {
        id: 'action-today',
        category: 'actions',
        title: t('action_jump_today'),
        subtitle: language === 'uk' ? 'Сьогоднішній розклад' : "Today's Schedule",
        icon: <Calendar className="w-5 h-5 text-emerald-500" />,
        shortcut: 'T',
        onSelect: () => {
          navigate('/');
          setIsOpen(false);
        },
        keywords: ['сьогодні', 'today', 'день', 'уроки'],
      },
      {
        id: 'action-tomorrow',
        category: 'actions',
        title: t('action_jump_tomorrow'),
        subtitle: language === 'uk' ? 'Завтрашній розклад' : "Tomorrow's Schedule",
        icon: <ArrowRight className="w-5 h-5 text-emerald-400" />,
        onSelect: () => {
          navigate('/diary');
          setIsOpen(false);
        },
        keywords: ['завтра', 'tomorrow', 'наступний день'],
      },
      {
        id: 'action-yesterday',
        category: 'actions',
        title: t('action_jump_yesterday'),
        subtitle: language === 'uk' ? 'Вчорашній розклад' : "Yesterday's Schedule",
        icon: <ArrowLeft className="w-5 h-5 text-text-muted" />,
        onSelect: () => {
          navigate('/diary');
          setIsOpen(false);
        },
        keywords: ['вчора', 'yesterday', 'учора'],
      },
      {
        id: 'action-bells',
        category: 'actions',
        title: t('action_bell_schedule'),
        subtitle: language === 'uk' ? 'Розклад дзвінків та перерв' : 'Lesson start and break intervals',
        icon: <Clock className="w-5 h-5 text-amber-500" />,
        onSelect: () => {
          navigate('/bells');
          setIsOpen(false);
        },
        keywords: ['дзвінки', 'перерва', 'bells', 'schedule', 'break'],
      },
      {
        id: 'action-ai-import',
        category: 'actions',
        title: t('action_ai_import'),
        subtitle: language === 'uk' ? 'Імпорт розкладу з JSON через AI' : 'AI schedule JSON importer',
        icon: <Sparkles className="w-5 h-5 text-accent" />,
        onSelect: () => {
          navigate('/settings');
          setIsOpen(false);
        },
        keywords: ['штучний інтелект', 'імпорт', 'ai', 'import', 'json', 'розклад'],
      },
      {
        id: 'action-subjects',
        category: 'actions',
        title: t('action_manage_subjects'),
        subtitle: language === 'uk' ? 'Додати або редагувати предмети' : 'Manage subjects and cabinet colors',
        icon: <GraduationCap className="w-5 h-5 text-purple-500" />,
        onSelect: () => {
          navigate('/settings');
          setIsOpen(false);
        },
        keywords: ['предмети', 'вчитель', 'кабінет', 'колір', 'subjects'],
      },
      {
        id: 'action-backup',
        category: 'actions',
        title: t('action_export_backup'),
        subtitle: language === 'uk' ? 'Експорт резервної копії JSON' : 'Full system backup JSON export',
        icon: <Download className="w-5 h-5 text-blue-400" />,
        onSelect: () => {
          navigate('/settings');
          setIsOpen(false);
        },
        keywords: ['бекап', 'резервна копія', 'backup', 'export', 'синхронізація'],
      },
      {
        id: 'action-clean',
        category: 'actions',
        title: t('action_clean_data'),
        subtitle: language === 'uk' ? 'Очищення застарілих даних' : 'Prune past homework and overrides',
        icon: <Trash2 className="w-5 h-5 text-rose-400" />,
        onSelect: () => {
          navigate('/settings');
          setIsOpen(false);
        },
        keywords: ['очистити', 'видалити', 'clean', 'delete', 'prune'],
      }
    );

    return items;
  }, [mathResult, query, subjects, theme, toggleTheme, language, setLanguage, t, location.pathname, navigate]);

  // Filter items according to search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query: show Recent Tabs and Quick Actions
      return allItems.filter((item) => item.category === 'recent' || item.category === 'actions');
    }

    if (mathResult) {
      // If math expression is detected, show the Calculator result first, followed by any keyword matches
      const otherMatches = allItems.filter((item) => {
        if (item.category === 'calc') return false;
        const textToSearch = `${item.title} ${item.subtitle || ''} ${(item.keywords || []).join(' ')}`.toLowerCase();
        return textToSearch.includes(q);
      });
      return [allItems[0], ...otherMatches];
    }

    return allItems.filter((item) => {
      const textToSearch = `${item.title} ${item.subtitle || ''} ${(item.keywords || []).join(' ')}`.toLowerCase();
      return textToSearch.includes(q);
    });
  }, [allItems, query, mathResult]);

  // Reset or clamp selectedIndex when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeElement = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Key navigation inside dialog
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredItems.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        item.onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Group items by category for visual section dividers
  const getCategoryLabel = (category: CommandItem['category']): string => {
    switch (category) {
      case 'calc':
        return t('command_palette_cat_calc');
      case 'recent':
        return t('command_palette_cat_recent');
      case 'pages':
        return t('command_palette_cat_pages');
      case 'subjects':
        return t('command_palette_cat_subjects');
      case 'actions':
        return t('command_palette_cat_actions');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-3 pb-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={t('command_palette_title')}
    >
      {/* Decoupled backdrop overlay: prevents nested backdrop-filter repaints */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-xl bg-bg-secondary rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150 transform-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3.5 sm:p-4 border-b border-border flex items-center gap-3 bg-bg-primary/40 shrink-0">
          <Search className="w-5 h-5 text-accent shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleDialogKeyDown}
            placeholder={t('command_palette_placeholder')}
            className="flex-1 bg-transparent border-0 text-text-primary placeholder:text-text-muted text-sm sm:text-base focus:outline-none focus:ring-0 min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono text-text-muted bg-bg-tertiary border border-border rounded-md shadow-2xs shrink-0">
            ESC
          </kbd>
        </div>

        {/* Copied notification toast */}
        {copiedText && (
          <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
            <Check size={14} />
            <span>{t('command_copied')}: {copiedText}</span>
          </div>
        )}

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 flex-1 min-h-0">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>{t('command_palette_no_results')}</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isFirstInCategory =
                index === 0 || filteredItems[index - 1].category !== item.category;

              return (
                <React.Fragment key={item.id}>
                  {isFirstInCategory && (
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/70">
                      {getCategoryLabel(item.category)}
                    </div>
                  )}
                  <div
                    onClick={() => item.onSelect()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all select-none',
                      isSelected
                        ? 'bg-accent/15 text-accent border border-accent/30 font-medium'
                        : 'text-text-primary hover:bg-bg-tertiary/60 border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-bg-tertiary text-text-muted font-mono shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <span className="text-xs text-text-muted truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-bg-tertiary border border-border/80 rounded shadow-2xs">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <CornerDownLeft size={14} className="text-accent shrink-0" />
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Tips */}
        <div className="p-2.5 px-4 border-t border-border bg-bg-primary/50 text-[11px] text-text-muted flex items-center justify-between shrink-0">
          <span className="truncate">{t('command_palette_tip')}</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-text-muted/60 shrink-0">
            <span>Alt+Space</span>
            <span>•</span>
            <span>⌘K</span>
            <span>•</span>
            <span>Alt+Q</span>
          </span>
        </div>
      </div>
    </div>
  );
}
