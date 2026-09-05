import axios from 'axios';
import type { Subject, HomeworkEntry, DaySchedule, WeeklyStat, AiParsedDay } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
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

/* Bulk commit schedule rules using subject IDs (manual entry) */
export const bulkCommitSchedule = async (scheduleData: { week_type: string; rules: unknown[] }): Promise<void> => {
  await api.post('/schedule/bulk-commit', scheduleData);
};

/* Bulk commit schedule rules using subject names (AI import flow, auto-creates subjects) */
export const bulkCommitByName = async (scheduleData: { week_type: string; rules: unknown[] }): Promise<unknown> => {
  const { data } = await api.post('/schedule/bulk-commit-by-name', scheduleData);
  return data;
};

export const fetchWeeklyStats = async (date: string): Promise<WeeklyStat[]> => {
  const { data } = await api.get('/stats/weekly', { params: { date } });
  return data;
};
