import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { useTheme } from './hooks/useTheme';
import { LanguageProvider } from './i18n/LanguageContext';
import { Loader2 } from 'lucide-react';

// Code-split page components for instant initial bundle loading
const DailyPage = lazy(() => import('./pages/DailyPage').then(m => ({ default: m.DailyPage })));
const DiaryPage = lazy(() => import('./pages/DiaryPage').then(m => ({ default: m.DiaryPage })));
const BellsPage = lazy(() => import('./pages/BellsPage').then(m => ({ default: m.BellsPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Optimized QueryClient with aggressive in-memory caching for instant tab transitions
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh: tab switching is instant with 0 network latency
      gcTime: 1000 * 60 * 30,    // 30 minutes in memory cache retention
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <Loader2 className="animate-spin text-accent" size={32} />
    </div>
  );
}

function App() {
  // Initialize theme
  useTheme();

  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<DailyPage />} />
                <Route path="/diary" element={<DiaryPage />} />
                <Route path="/bells" element={<BellsPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </Router>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
