import axios from 'axios';
import type {
  Subject,
  HomeworkEntry,
  DaySchedule,
  WeeklyStatsResponse,
  AiParsedDay,
  BellSlot,
  AiParsedBellSlot,
  ScheduleRuleItem,
  LessonNote,
  Attachment,
} from '../types';

// Axios instance configured with extended timeout for AI image processing
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 180000, // 3 minutes timeout to prevent 504 errors on long-running AI requests
});

export const fetchSchedule = async (startDate: string, endDate: string): Promise<DaySchedule[]> => {
  const { data } = await api.get('/schedule', { params: { start_date: startDate, end_date: endDate } });
  return data;
};

export const fetchHomework = async (date?: string, subjectId?: string): Promise<HomeworkEntry[]> => {
  const { data } = await api.get('/homework', { params: { date, subject_id: subjectId } });
  return data;
};

export const createHomework = async (homework: Partial<HomeworkEntry>): Promise<HomeworkEntry> => {
  const { data } = await api.post('/homework', homework);
  return data;
};

export const updateHomework = async (id: string, homework: Partial<HomeworkEntry>): Promise<HomeworkEntry> => {
  const { data } = await api.patch(`/homework/${id}`, homework);
  return data;
};

export const deleteHomework = async (id: string): Promise<void> => {
  await api.delete(`/homework/${id}`);
};

export const fetchSubjects = async (): Promise<Subject[]> => {
  const { data } = await api.get('/subjects');
  return data;
};

export const createSubject = async (subject: Partial<Subject>): Promise<Subject> => {
  const { data } = await api.post('/subjects', subject);
  return data;
};

export const updateSubject = async (id: string, subject: Partial<Subject>): Promise<Subject> => {
  const { data } = await api.patch(`/subjects/${id}`, subject);
  return data;
};

export const deleteSubject = async (id: string): Promise<void> => {
  await api.delete(`/subjects/${id}`);
};

/* Randomize all subject colors with unique, visually distinct palette */
export const randomizeSubjectColors = async (): Promise<Subject[]> => {
  const { data } = await api.post('/subjects/randomize-colors');
  return data;
};

/* AI-powered schedule image parsing — returns structured data for review */
export const aiParseSchedule = async (file: File): Promise<{ days: AiParsedDay[] }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/schedule/ai-parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

/* Parse user-submitted schedule JSON directly (from external AI, no API key needed) */
export const parseScheduleJson = async (rawJson: string): Promise<{ days: AiParsedDay[] }> => {
  const { data } = await api.post('/schedule/parse-json', { raw_json: rawJson });
  return data;
};

/* Bulk commit schedule rules using subject IDs (manual entry) */
export const bulkCommitSchedule = async (scheduleData: { week_type: string; rules: unknown[] }): Promise<void> => {
  await api.post('/schedule/bulk-commit', scheduleData);
};

/* Bulk commit schedule rules using subject names (AI import flow, auto-creates subjects) */
export const bulkCommitByName = async (scheduleData: { week_type: string; rules: unknown[] }): Promise<unknown> => {
  const { data } = await api.post('/schedule/bulk-commit-by-name', scheduleData);
  return data;
};

/* Fetch raw schedule rules from database */
export const fetchScheduleRules = async (weekType?: string): Promise<ScheduleRuleItem[]> => {
  const { data } = await api.get('/schedule/rules', { params: { week_type: weekType } });
  return data;
};

/* Delete schedule rules (all or for a specific week type) */
export const deleteAllSchedule = async (weekType?: string): Promise<void> => {
  await api.delete('/schedule', { params: { week_type: weekType } });
};

/* Permanently clear all app data (homework, schedule, bells, subjects) */
export const clearAllAppData = async (): Promise<void> => {
  await api.post('/subjects/clear-all-data');
};

export const fetchWeeklyStats = async (date: string, mode: 'actual' | 'numerator' | 'denominator' = 'actual'): Promise<WeeklyStatsResponse> => {
  const { data } = await api.get('/stats/weekly', { params: { date, mode } });
  return data;
};

// ── Bell Schedule (Розклад Дзвінків) API endpoints ─────────────────────────

export const fetchBells = async (): Promise<BellSlot[]> => {
  const { data } = await api.get('/bells');
  return data;
};

export const createBellSlot = async (slot: Partial<BellSlot>): Promise<BellSlot> => {
  const { data } = await api.post('/bells', slot);
  return data;
};

export const updateBellSlot = async (id: string, slot: Partial<BellSlot>): Promise<BellSlot> => {
  const { data } = await api.patch(`/bells/${id}`, slot);
  return data;
};

export const deleteBellSlot = async (id: string): Promise<void> => {
  await api.delete(`/bells/${id}`);
};

export const bulkCommitBells = async (slots: Partial<BellSlot>[]): Promise<BellSlot[]> => {
  const { data } = await api.put('/bells/bulk', { slots });
  return data;
};

/* AI-powered bell schedule image parsing */
export const aiParseBells = async (file: File): Promise<{ slots: AiParsedBellSlot[] }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/bells/ai-parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

/* Parse user-submitted bell schedule JSON directly (from external AI, no API key needed) */
export const parseBellsJson = async (rawJson: string): Promise<{ slots: AiParsedBellSlot[] }> => {
  const { data } = await api.post('/bells/parse-json', { raw_json: rawJson });
  return data;
};

// ── Full System Backup & Restore ──────────────────────────────────────────

/* Export all application data (subjects, bells, schedule, homework) as a JSON object */
export const exportFullBackup = async (): Promise<any> => {
  const { data } = await api.get('/system/backup/export');
  return data;
};

/* Restore all application data from a JSON backup object */
export const importFullBackup = async (backupData: any): Promise<{ status: string; message: string; imported: any }> => {
  const { data } = await api.post('/system/backup/import', backupData);
  return data;
};

export interface CleanDataParams {
  before_date?: string;
  start_date?: string;
  end_date?: string;
  clean_homework?: boolean;
  clean_completed_homework_only?: boolean;
  clean_schedule_overrides?: boolean;
  clean_orphaned_files?: boolean;
}

export const cleanSystemData = async (params: CleanDataParams): Promise<{ status: string; message: string; deleted: { homework: number; schedule_overrides: number; stored_files: number } }> => {
  const { data } = await api.post('/system/clean-data', params);
  return data;
};

export interface StorageSubcategory {
  bytes: number;
  count: number;
}

export interface StorageCategory {
  id: string;
  label: string;
  bytes: number;
  count: number;
  is_file_storage: boolean;
  subcategories?: Record<string, StorageSubcategory>;
}

export interface StorageStatsResponse {
  total_bytes: number;
  categories: StorageCategory[];
}

export const fetchStorageStats = async (): Promise<StorageStatsResponse> => {
  const { data } = await api.get('/system/storage-stats');
  return data;
};

// ── File Storage (PDF, Images) API endpoints ─────────────────────────────

export const uploadStoredFile = async (file: File): Promise<{ id: string; filename: string; content_type: string; size: number; url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// ── Next Lesson & Schedule Override API endpoints ───────────────────────

export const fetchNextLesson = async (
  subjectId: string,
  currentDate?: string,
  currentLessonOrder?: number,
  fromDate?: string
): Promise<any> => {
  const { data } = await api.get('/schedule/next-lesson', {
    params: {
      subject_id: subjectId,
      current_date: currentDate,
      current_lesson_order: currentLessonOrder,
      from_date: fromDate,
    },
  });
  return data;
};

export const fetchPreviousLesson = async (
  subjectId: string,
  currentDate?: string,
  currentLessonOrder?: number
): Promise<any> => {
  const { data } = await api.get('/schedule/previous-lesson', {
    params: {
      subject_id: subjectId,
      current_date: currentDate,
      current_lesson_order: currentLessonOrder,
    },
  });
  return data;
};

export const fetchScheduleOverrides = async (startDate?: string, endDate?: string): Promise<any[]> => {
  const { data } = await api.get('/schedule/overrides', {
    params: { start_date: startDate, end_date: endDate },
  });
  return data;
};

export const setScheduleOverride = async (overrideData: any): Promise<any> => {
  const { data } = await api.post('/schedule/override', overrideData);
  return data;
};

export const deleteScheduleOverride = async (targetDate: string, lessonOrder: number): Promise<void> => {
  await api.delete('/schedule/override', {
    params: { target_date: targetDate, lesson_order: lessonOrder },
  });
};

// ── Lesson Notes API endpoints ─────────────────────────────────────────

export const fetchLessonNotes = async (
  targetDate?: string,
  lessonOrder?: number,
  subjectId?: string
): Promise<LessonNote[]> => {
  const { data } = await api.get('/lesson-notes', {
    params: {
      date: targetDate,
      lesson_order: lessonOrder,
      subject_id: subjectId,
    },
  });
  return data;
};

export const createLessonNote = async (noteData: {
  subject_id: string;
  date: string;
  lesson_order: number;
  text: string;
  images?: string[];
  attachments?: Attachment[];
}): Promise<LessonNote> => {
  const { data } = await api.post('/lesson-notes', noteData);
  return data;
};

export const updateLessonNote = async (
  id: string,
  updateData: {
    text?: string;
    images?: string[];
    attachments?: Attachment[];
  }
): Promise<LessonNote> => {
  const { data } = await api.patch(`/lesson-notes/${id}`, updateData);
  return data;
};

export const deleteLessonNote = async (id: string): Promise<void> => {
  await api.delete(`/lesson-notes/${id}`);
};

