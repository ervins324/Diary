import { NavLink } from 'react-router-dom';
import { Calendar, BookOpen, BookCheck, Bell, BarChart3, Settings, StickyNote } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';

export function BottomNav() {
  const { t } = useLanguage();

  const navItems = [
    { to: '/', icon: Calendar, label: t('nav_daily') },
    { to: '/diary', icon: BookOpen, label: t('nav_diary') },
    { to: '/homework', icon: BookCheck, label: t('nav_homework') },
    { to: '/notes', icon: StickyNote, label: t('nav_notes') },
    { to: '/bells', icon: Bell, label: t('nav_bells') },
    { to: '/stats', icon: BarChart3, label: t('nav_stats') },
    { to: '/settings', icon: Settings, label: t('nav_settings') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-secondary border-t border-border flex items-center justify-around z-50 pb-safe px-0.5">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center min-w-0 flex-1 h-full space-y-0.5 transition-colors px-0.5',
              isActive
                ? 'text-accent'
                : 'text-text-secondary hover:text-text-primary'
            )
          }
        >
          <item.icon size={17} className="shrink-0" />
          <span className="text-[8.5px] font-medium leading-tight truncate max-w-[46px] text-center">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
