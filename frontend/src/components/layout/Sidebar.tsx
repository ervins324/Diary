import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, BookOpen, Bell, BarChart3, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { SettingsContents } from '../settings/SettingsContents';
import { LiveScheduleWidget } from '../schedule/LiveScheduleWidget';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';

export function Sidebar() {
  const { t } = useLanguage();
  const location = useLocation();
  const isSettingsTab = location.pathname.startsWith('/settings');

  const navItems = [
    { to: '/', icon: Calendar, label: t('nav_daily') },
    { to: '/diary', icon: BookOpen, label: t('nav_diary') },
    { to: '/bells', icon: Bell, label: t('nav_bells') },
    { to: '/stats', icon: BarChart3, label: t('nav_stats') },
    { to: '/settings', icon: Settings, label: t('nav_settings') },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-bg-secondary sticky top-0 overflow-y-auto">
      <div className="p-6 flex items-center gap-3 shrink-0">
        <img src="/favicon.svg" alt="School Diary Logo" className="w-8 h-8 rounded-lg shadow-xs shrink-0" />
        <h1 className="text-xl font-bold text-text-primary tracking-tight">{t('app_title')}</h1>
      </div>
      
      <nav className="px-4 space-y-1 shrink-0">
        {navItems.map((item) => (
          <div key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-light text-accent'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>

            {/* Wikipedia-style table of contents inside sidebar navigation when on Settings tab */}
            {item.to === '/settings' && isSettingsTab && (
              <div className="mt-2 mb-2 pl-1 pr-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <SettingsContents
                  isSidebar
                  className="w-full bg-bg-primary/70 border border-border/80 p-2.5 rounded-lg shadow-2xs"
                />
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Live Schedule & Homework Status Widget in Sidebar */}
      <div className="mt-4 mb-2 shrink-0">
        <LiveScheduleWidget variant="sidebar" />
      </div>

      <div className="mt-auto p-4 border-t border-border flex justify-between items-center shrink-0">
        <span className="text-sm text-text-muted">{t('theme')}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
