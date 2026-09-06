import { NavLink } from 'react-router-dom';
import { Calendar, BookOpen, Bell, BarChart3, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../i18n/LanguageContext';

export function BottomNav() {
  const { t } = useLanguage();

  const navItems = [
    { to: '/', icon: Calendar, label: t('nav_daily') },
    { to: '/diary', icon: BookOpen, label: t('nav_diary') },
    { to: '/bells', icon: Bell, label: t('nav_bells') },
    { to: '/stats', icon: BarChart3, label: t('nav_stats') },
    { to: '/settings', icon: Settings, label: t('nav_settings') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-secondary border-t border-border flex items-center justify-around z-50 pb-safe">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
              isActive
                ? 'text-accent'
                : 'text-text-secondary hover:text-text-primary'
            )
          }
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
