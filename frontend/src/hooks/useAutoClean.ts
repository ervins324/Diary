import { useEffect } from 'react';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { cleanSystemData } from '../api/client';

export interface AutoCleanConfig {
  enabled: boolean;
  retention: '2_weeks' | '1_month' | '3_months' | '6_months' | '1_year';
  cleanHomework: boolean;
  cleanCompletedHomeworkOnly: boolean;
  cleanScheduleOverrides: boolean;
  cleanOrphanedFiles: boolean;
  lastCleanedDate?: string; // YYYY-MM-DD
}

const STORAGE_KEY = 'school_diary_auto_clean_config';

export const DEFAULT_AUTO_CLEAN_CONFIG: AutoCleanConfig = {
  enabled: false,
  retention: '3_months',
  cleanHomework: true,
  cleanCompletedHomeworkOnly: false,
  cleanScheduleOverrides: true,
  cleanOrphanedFiles: true,
};

export function getAutoCleanConfig(): AutoCleanConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUTO_CLEAN_CONFIG;
    return { ...DEFAULT_AUTO_CLEAN_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AUTO_CLEAN_CONFIG;
  }
}

export function saveAutoCleanConfig(config: AutoCleanConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function computeCutoffDate(retention: AutoCleanConfig['retention'], fromDate: Date = new Date()): string {
  let cutoff: Date;
  switch (retention) {
    case '2_weeks':
      cutoff = subDays(fromDate, 14);
      break;
    case '1_month':
      cutoff = subMonths(fromDate, 1);
      break;
    case '3_months':
      cutoff = subMonths(fromDate, 3);
      break;
    case '6_months':
      cutoff = subMonths(fromDate, 6);
      break;
    case '1_year':
      cutoff = subYears(fromDate, 1);
      break;
    default:
      cutoff = subMonths(fromDate, 3);
  }
  return format(cutoff, 'yyyy-MM-dd');
}

/**
 * Runs automatic cleaning on application mount once per day if enabled by user.
 */
export function useAutoCleanRunner() {
  useEffect(() => {
    const config = getAutoCleanConfig();
    if (!config.enabled) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    // Run at most once per day
    if (config.lastCleanedDate === todayStr) return;

    const cutoffStr = computeCutoffDate(config.retention);

    cleanSystemData({
      before_date: cutoffStr,
      clean_homework: config.cleanHomework,
      clean_completed_homework_only: config.cleanCompletedHomeworkOnly,
      clean_schedule_overrides: config.cleanScheduleOverrides,
      clean_orphaned_files: config.cleanOrphanedFiles,
    })
      .then((res) => {
        saveAutoCleanConfig({ ...config, lastCleanedDate: todayStr });
        const { homework, schedule_overrides, stored_files } = res.deleted;
        if (homework > 0 || schedule_overrides > 0 || stored_files > 0) {
          console.info(`[Auto-Clean] Pruned ${homework} homeworks, ${schedule_overrides} overrides, ${stored_files} orphaned files.`);
        }
      })
      .catch((err) => {
        console.error('[Auto-Clean] Execution failed:', err);
      });
  }, []);
}
