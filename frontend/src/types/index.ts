export interface Subject {
  id: string;
  name: string;
  short_name: string;
  color_hex: string;
  default_cabinet: string | null;
}

export interface Attachment {
  id?: string;
  name: string;
  type: 'image' | 'pdf' | 'presentation' | 'link';
  url: string;
  size?: number | null;
}

/* Homework entry matching backend HomeworkRead schema */
export interface HomeworkEntry {
  id: string;
  subject_id: string;
  due_date: string;
  lesson_order: number | null;
  text: string;
  is_completed: boolean;
  subject?: Subject;
  images?: string[];
  attachments?: Attachment[];
}

export interface LessonSlot {
  date: string;
  lesson_order: number;
  subject: Subject;
  start_time: string;
  end_time: string;
  cabinet: string | null;
  homework: HomeworkEntry[];
  original_subject?: Subject | null;
  is_override?: boolean;
  is_cancelled?: boolean;
  override_note?: string | null;
}

export interface ScheduleOverride {
  id: string;
  date: string;
  lesson_order: number;
  subject_id: string | null;
  original_subject_id: string | null;
  original_subject_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  cabinet?: string | null;
  is_cancelled: boolean;
  note?: string | null;
  subject?: Subject | null;
  original_subject?: Subject | null;
}

export interface NextLesson {
  date: string;
  lesson_order: number;
  subject_id: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  cabinet?: string | null;
}

export interface DaySchedule {
  date: string;
  day_name: string;
  week_type: string;
  lessons: LessonSlot[];
}

export interface WeeklyStat {
  subject_name: string;
  short_name: string;
  color_hex: string;
  total_minutes: number;
}

export interface DayStatSubject {
  name: string;
  short_name: string;
  color_hex: string;
  cabinet: string | null;
  lesson_order: number;
  start_time: string;
  end_time: string;
}

export interface DayStat {
  day_of_week: number;
  date: string;
  day_key: string;
  lessons_count: number;
  total_minutes: number;
  break_minutes: number;
  subjects: DayStatSubject[];
  homework_count: number;
  homework_completed: number;
}

export interface WeeklyStatsResponse {
  subjects: WeeklyStat[];
  days?: DayStat[];
  total_subjects: number;
  total_lessons: number;
  avg_lessons_per_day: number;
  total_break_minutes: number;
  homework_stats: {
    total: number;
    completed: number;
    completion_rate: number;
  };
}

/* Parsed lesson from AI schedule image recognition */
export interface AiParsedLesson {
  order: number;
  subject_name: string;
  start_time: string | null;
  end_time: string | null;
  cabinet: string | null;
}

export interface AiParsedDay {
  day_of_week: number;
  day_name: string;
  lessons: AiParsedLesson[];
}

/* Bell schedule slot (Розклад дзвінків) */
export interface BellSlot {
  id: string;
  lesson_order: number;
  start_time: string;
  end_time: string;
  name?: string | null;
}

/* Parsed bell slot from AI bell schedule recognition */
export interface AiParsedBellSlot {
  order: number;
  start_time: string;
  end_time: string;
  name?: string | null;
}

/* Raw schedule rule from database */
export interface ScheduleRuleItem {
  id: string;
  subject_id: string;
  day_of_week: number;
  week_type: string;
  lesson_order: number;
  start_time: string;
  end_time: string;
  cabinet: string | null;
  subject: Subject;
}

