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

export const fetchWeeklyStats = async (date: string): Promise<WeeklyStatsResponse> => {
  const { data } = await api.get('/stats/weekly', { params: { date } });
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

