import { useState } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchWeeklyStats } from '../api/client';
import { getWeekDates } from '../lib/utils';
import type { WeeklyStat } from '../types';

export function StatsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { start, end } = getWeekDates(currentDate);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', start],
    queryFn: () => fetchWeeklyStats(start),
  });

  const handlePrevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));

  // Prepare data for Recharts (convert minutes to hours)
  const chartData = stats?.map(stat => ({
    ...stat,
    hours: stat.total_minutes / 60,
  })) || [];

  const totalMinutes = stats?.reduce((acc, curr) => acc + curr.total_minutes, 0) || 0;
  const busiestSubject = stats?.reduce((prev, current) => 
    (prev.total_minutes > current.total_minutes) ? prev : current
  , { subject_name: '-', total_minutes: 0 } as WeeklyStat);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as WeeklyStat;
      const hours = Math.floor(data.total_minutes / 60);
      const mins = data.total_minutes % 60;
      return (
        <div className="bg-bg-secondary border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-text-primary mb-1">{data.subject_name}</p>
          <p className="text-sm text-text-secondary">
            Duration: <span className="font-medium text-text-primary">{hours}h {mins}m</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <button onClick={handlePrevWeek} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
          <ChevronLeft size={24} className="text-text-secondary" />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <h1 className="text-xl font-bold text-text-primary">Weekly Statistics</h1>
          <span className="text-sm text-text-muted">
            {format(parseISO(start), 'MMM d')} - {format(parseISO(end), 'MMM d, yyyy')}
          </span>
        </div>
        
        <button onClick={handleNextWeek} className="p-2 rounded-full hover:bg-bg-tertiary transition-colors">
          <ChevronRight size={24} className="text-text-secondary" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-6">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-text-muted text-lg mb-2">No data for this week</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="bg-bg-secondary p-4 md:p-6 rounded-xl border border-border h-80 shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="short_name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg-tertiary)' }} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color_hex || 'var(--color-accent)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <span className="text-sm text-text-secondary mb-1">Total Hours</span>
                <span className="text-2xl font-bold text-text-primary">
                  {Math.floor(totalMinutes / 60)}<span className="text-lg text-text-muted font-normal">h</span> {totalMinutes % 60}<span className="text-lg text-text-muted font-normal">m</span>
                </span>
              </div>
              <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
                <span className="text-sm text-text-secondary mb-1">Busiest Subject</span>
                <span className="text-xl font-bold text-text-primary truncate w-full" style={{ color: busiestSubject?.color_hex || 'inherit' }}>
                  {busiestSubject?.subject_name}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
