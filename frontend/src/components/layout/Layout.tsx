import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { LiveScheduleWidget } from '../schedule/LiveScheduleWidget';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile Live Schedule & Status Bar */}
        <div className="md:hidden sticky top-0 z-30">
          <LiveScheduleWidget variant="mobile" />
        </div>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
