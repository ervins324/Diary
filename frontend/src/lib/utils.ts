import { clsx, type ClassValue } from 'clsx';
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return timeStr;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch (e) {
    return dateStr;
  }
}

export function getDayName(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'EEEE');
  } catch (e) {
    return '';
  }
}

export function getWeekDates(date: Date): { start: string; end: string } {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

/**
 * Returns today's date, or advances to next week's Monday if today is Saturday or Sunday
 * (when the 'skip_weekends_to_monday' setting is enabled in localStorage).
 */
export function getDefaultScheduleDate(): Date {
  const storedSetting = localStorage.getItem('skip_weekends_to_monday');
  const skipWeekends = storedSetting !== 'false'; // Default to true
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 6 is Saturday

  if (skipWeekends) {
    if (day === 6) {
      // Saturday -> advance 2 days to Monday
      return addDays(now, 2);
    } else if (day === 0) {
      // Sunday -> advance 1 day to Monday
      return addDays(now, 1);
    }
  }
  return now;
}

/**
 * Compresses an image file to a data URL with max dimension 1280px and JPEG quality 0.82.
 * This guarantees fast uploads, compact JSON storage, and snappy UI previews.
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Checks if the current time falls within [startTime, endTime].
 * If targetDate is provided, also checks that targetDate is today.
 * Handles format 'HH:MM' or 'HH:MM:SS'.
 */
export function isLessonNow(startTime: string, endTime: string, targetDateStr?: string): boolean {
  if (!startTime || !endTime) return false;

  const now = new Date();

  // If a specific date is supplied (e.g. '2026-09-07'), ensure it is today
  if (targetDateStr) {
    const todayIso = format(now, 'yyyy-MM-dd');
    if (targetDateStr !== todayIso) {
      return false;
    }
  }

  const parseTimeMinutes = (timeStr: string) => {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  const startMins = parseTimeMinutes(startTime);
  const endMins = parseTimeMinutes(endTime);
  const currentMins = now.getHours() * 60 + now.getMinutes();

  return currentMins >= startMins && currentMins <= endMins;
}

