import { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { cn } from '../../lib/utils';
import { ArrowUp, List } from 'lucide-react';

export interface TocSection {
  id: string;
  labelKey: string;
}

const SECTIONS: TocSection[] = [
  { id: 'appearance', labelKey: 'section_appearance' },
  { id: 'preferences', labelKey: 'section_preferences' },
  { id: 'custom-types', labelKey: 'section_custom_types' },
  { id: 'subjects', labelKey: 'section_subjects' },
  { id: 'schedule-tools', labelKey: 'section_schedule_tools' },
  { id: 'backup', labelKey: 'section_backup' },
  { id: 'storage', labelKey: 'section_storage' },
  { id: 'air-alerts', labelKey: 'section_air_alerts' },
  { id: 'danger-zone', labelKey: 'section_danger_zone' },
];

interface SettingsContentsProps {
  className?: string;
  isSidebar?: boolean;
}

export function SettingsContents({ className, isSidebar = false }: SettingsContentsProps) {
  const { t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('settings_toc_hidden') === 'true');
  const [activeId, setActiveId] = useState<string>('top');

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('settings_toc_hidden', next ? 'true' : 'false');
      return next;
    });
  };

  const handleJump = (id: string) => {
    if (id === 'top') {
      const container = document.getElementById('settings-scroll-container');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setActiveId('top');
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.getElementById('settings-scroll-container');
      const containerTop = scrollContainer ? scrollContainer.getBoundingClientRect().top : 0;

      let currentActive = 'top';
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top - containerTop <= 160) {
            currentActive = s.id;
          }
        }
      }
      setActiveId(currentActive);
    };

    const container = document.getElementById('settings-scroll-container');
    const target = container || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      aria-label="Settings Contents"
      className={cn(
        "bg-bg-secondary border border-border rounded-xl p-4 shadow-xs transition-all duration-200",
        isSidebar ? "w-64" : "w-full",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border-light">
        <div className="flex items-center gap-2">
          <List size={16} className="text-accent" />
          <span className="font-bold text-text-primary text-sm tracking-tight">{t('settings_contents')}</span>
        </div>
        <button
          type="button"
          onClick={toggleCollapse}
          className="text-xs px-2 py-0.5 rounded bg-bg-tertiary hover:bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          {isCollapsed ? t('settings_contents_show') : t('settings_contents_hide')}
        </button>
      </div>

      {!isCollapsed && (
        <div className="pt-2.5 space-y-1 text-xs">
          <button
            type="button"
            onClick={() => handleJump('top')}
            className={cn(
              "w-full text-left font-semibold py-1 px-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer",
              activeId === 'top'
                ? "text-accent bg-accent/10"
                : "text-text-primary hover:bg-bg-tertiary"
            )}
          >
            <ArrowUp size={12} />
            <span>{t('settings_contents_top')}</span>
          </button>

          {SECTIONS.map((sec, idx) => {
            const isActive = activeId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleJump(sec.id)}
                className={cn(
                  "w-full text-left py-1 px-2 rounded transition-colors block truncate cursor-pointer",
                  isActive
                    ? "font-semibold text-accent bg-accent/10"
                    : "text-[#2563EB] dark:text-[#60A5FA] hover:underline hover:bg-bg-tertiary/50"
                )}
              >
                <span className="text-text-muted mr-1.5 font-normal">{idx + 1}</span>
                <span>{t(sec.labelKey as any)}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
