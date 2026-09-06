export interface Subject {
  id: string;
  name: string;
  short_name: string;
  color_hex: string;
  default_cabinet: string | null;
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
}

export interface LessonSlot {
  date: string;
  lesson_order: number;
  subject: Subject;
  start_time: string;
  end_time: string;
  cabinet: string | null;
  homework: HomeworkEntry[];
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

