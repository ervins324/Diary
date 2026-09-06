import { NavLink } from 'react-router-dom';
import { Calendar, BookOpen, Bell, BarChart3, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';

export function Sidebar() {
  const { t } = useLanguage();

  const navItems = [
    { to: '/', icon: Calendar, label: t('nav_daily') },
    { to: '/diary', icon: BookOpen, label: t('nav_diary') },
    { to: '/bells', icon: Bell, label: t('nav_bells') },
    { to: '/stats', icon: BarChart3, label: t('nav_stats') },
    { to: '/settings', icon: Settings, label: t('nav_settings') },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen border-r border-border bg-bg-secondary sticky top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">{t('app_title')}</h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
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
        ))}
      </nav>
      <div className="p-4 border-t border-border flex justify-between items-center">
        <span className="text-sm text-text-muted">{t('theme')}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
