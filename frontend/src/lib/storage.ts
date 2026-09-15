/**
 * Storage Cache Layer (Vercel React Best Practices - js-cache-storage)
 *
 * Synchronous localStorage calls trigger synchronous disk I/O and main-thread stalls.
 * This module provides an in-memory Map cache for frequent reads (e.g. during lesson rendering,
 * widget ticking, and modal scrolling), with automatic cache invalidation on external storage events
 * and visibility changes.
 */

const storageCache = new Map<string, string | null>();

/**
 * Reads a value from localStorage with memory caching.
 */
export function getCachedLocalStorage(key: string, defaultValue: string | null = null): string | null {
  if (typeof window === 'undefined') return defaultValue;

  if (!storageCache.has(key)) {
    try {
      const val = localStorage.getItem(key);
      storageCache.set(key, val);
    } catch {
      return defaultValue;
    }
  }

  const cached = storageCache.get(key);
  return cached !== undefined ? cached : defaultValue;
}

/**
 * Writes a value to localStorage and updates the in-memory cache synchronously.
 */
export function setCachedLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, value);
    storageCache.set(key, value);
  } catch {
    // Graceful fallback if storage quota exceeded or disabled
  }
}

/**
 * Removes a key from localStorage and clears its cache entry.
 */
export function removeCachedLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
    storageCache.delete(key);
  } catch {
    // Graceful fallback
  }
}

/**
 * Invalidates a specific cache entry or clears the entire cache.
 */
export function invalidateStorageCache(key?: string): void {
  if (key) {
    storageCache.delete(key);
  } else {
    storageCache.clear();
  }
}

// Invalidate cache when storage is modified in another tab
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key) {
      storageCache.delete(e.key);
    } else {
      storageCache.clear();
    }
  });

  // Clear stale cached items when tab regains visibility
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      storageCache.clear();
    }
  });
}

// ==========================================
// High-Frequency Convenience Accessors
// ==========================================

const SHOW_CABINETS_KEY = 'show_cabinets';
const SKIP_WEEKENDS_KEY = 'skip_weekends_to_monday';
const LIVE_WIDGET_KEY = 'live_widget_enabled';

/**
 * Checks whether classroom numbers are displayed (defaults to true).
 * Called frequently across all lesson cards during diary and timetable rendering.
 */
export function isShowCabinetsEnabled(): boolean {
  return getCachedLocalStorage(SHOW_CABINETS_KEY) !== 'false';
}

/**
 * Sets show_cabinets preference and updates cache.
 */
export function setShowCabinetsEnabled(enabled: boolean): void {
  setCachedLocalStorage(SHOW_CABINETS_KEY, enabled ? 'true' : 'false');
}

/**
 * Checks whether weekends auto-advance to Monday (defaults to true).
 */
export function isSkipWeekendsEnabled(): boolean {
  return getCachedLocalStorage(SKIP_WEEKENDS_KEY) !== 'false';
}

/**
 * Sets skip_weekends preference and updates cache.
 */
export function setSkipWeekendsEnabled(enabled: boolean): void {
  setCachedLocalStorage(SKIP_WEEKENDS_KEY, enabled ? 'true' : 'false');
}

/**
 * Checks whether the live schedule status widget is enabled (defaults to true).
 */
export function isLiveWidgetEnabled(): boolean {
  return getCachedLocalStorage(LIVE_WIDGET_KEY) !== 'false';
}

const DAY_SHIFT_AFTER_KEY = 'day_shift_after_hour';

/**
 * Gets the cutoff hour after which the schedule auto-advances to the next school day.
 * Returns null if disabled, or a number 0-23 (e.g. 16 = 4 PM).
 */
export function getDayShiftAfterHour(): number | null {
  const val = getCachedLocalStorage(DAY_SHIFT_AFTER_KEY);
  if (val === null || val === 'off') return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

/**
 * Sets the cutoff hour for day-shift, or null/'off' to disable.
 */
export function setDayShiftAfterHour(hour: number | null): void {
  setCachedLocalStorage(DAY_SHIFT_AFTER_KEY, hour === null ? 'off' : String(hour));
}
