export interface CustomEventType {
  id: string;
  nameUk: string;
  nameEn: string;
  icon: string;
  color: string; // Hex color or Tailwind color prefix
  isCustom?: boolean;
}

export interface CustomLessonType {
  id: string;
  nameUk: string;
  nameEn: string;
  icon: string;
  color: string;
  isCustom?: boolean;
}

export const BUILTIN_EVENT_TYPES: CustomEventType[] = [
  {
    id: 'control_work',
    nameUk: 'Контрольна робота',
    nameEn: 'Control Work',
    icon: '🔥',
    color: '#f43f5e', // rose-500
    isCustom: false,
  },
  {
    id: 'test',
    nameUk: 'Самостійна / Тест',
    nameEn: 'Test / Quiz',
    icon: '📝',
    color: '#f59e0b', // amber-500
    isCustom: false,
  },
  {
    id: 'essay',
    nameUk: 'Твір / Есе',
    nameEn: 'Essay / Paper',
    icon: '✍️',
    color: '#a855f7', // purple-500
    isCustom: false,
  },
  {
    id: 'project',
    nameUk: 'Проєкт',
    nameEn: 'Project',
    icon: '🚀',
    color: '#0ea5e9', // sky-500
    isCustom: false,
  },
];

export const BUILTIN_LESSON_TYPES: CustomLessonType[] = [
  {
    id: 'lecture',
    nameUk: 'Лекція',
    nameEn: 'Lecture',
    icon: '📖',
    color: '#6366f1', // indigo-500
    isCustom: false,
  },
  {
    id: 'practice',
    nameUk: 'Практичне заняття',
    nameEn: 'Practice / Exercise',
    icon: '🛠️',
    color: '#3b82f6', // blue-500
    isCustom: false,
  },
  {
    id: 'lab',
    nameUk: 'Лабораторна робота',
    nameEn: 'Laboratory',
    icon: '🔬',
    color: '#10b981', // emerald-500
    isCustom: false,
  },
  {
    id: 'seminar',
    nameUk: 'Семінар',
    nameEn: 'Seminar',
    icon: '💬',
    color: '#14b8a6', // teal-500
    isCustom: false,
  },
  {
    id: 'consultation',
    nameUk: 'Консультація',
    nameEn: 'Consultation',
    icon: '💡',
    color: '#8b5cf6', // violet-500
    isCustom: false,
  },
  {
    id: 'elective',
    nameUk: 'Факультатив',
    nameEn: 'Elective',
    icon: '⭐',
    color: '#f97316', // orange-500
    isCustom: false,
  },
];

const CUSTOM_EVENTS_KEY = 'custom_event_types';
const CUSTOM_LESSONS_KEY = 'custom_lesson_types';

/* Retrieve user-created custom event types */
export function getCustomEventTypes(): CustomEventType[] {
  try {
    const raw = localStorage.getItem(CUSTOM_EVENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load custom event types from localStorage', e);
    return [];
  }
}

/* Save user-created custom event types */
export function saveCustomEventTypes(types: CustomEventType[]): void {
  try {
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(types));
    window.dispatchEvent(new Event('custom_types_changed'));
  } catch (e) {
    console.error('Failed to save custom event types to localStorage', e);
  }
}

/* Get combined list of built-in templates and user custom event types */
export function getAllEventTypes(): CustomEventType[] {
  const custom = getCustomEventTypes();
  return [...BUILTIN_EVENT_TYPES, ...custom];
}

/* Retrieve full metadata (label, icon, color) for an event type ID */
export function getEventTypeInfo(
  typeId: string | null | undefined,
  language: string = 'uk'
): { id: string; label: string; icon: string; color: string } | null {
  if (!typeId) return null;
  const all = getAllEventTypes();
  const match = all.find((item) => item.id.toLowerCase() === typeId.toLowerCase());
  if (match) {
    return {
      id: match.id,
      label: language === 'uk' ? match.nameUk : match.nameEn,
      icon: match.icon,
      color: match.color,
    };
  }

  // Fallback for unrecognized custom strings
  return {
    id: typeId,
    label: typeId,
    icon: '📌',
    color: '#3b82f6',
  };
}

/* Retrieve user-created custom lesson types */
export function getCustomLessonTypes(): CustomLessonType[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LESSONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load custom lesson types from localStorage', e);
    return [];
  }
}

/* Save user-created custom lesson types */
export function saveCustomLessonTypes(types: CustomLessonType[]): void {
  try {
    localStorage.setItem(CUSTOM_LESSONS_KEY, JSON.stringify(types));
    window.dispatchEvent(new Event('custom_types_changed'));
  } catch (e) {
    console.error('Failed to save custom lesson types to localStorage', e);
  }
}

/* Get combined list of built-in and custom lesson types */
export function getAllLessonTypes(): CustomLessonType[] {
  const custom = getCustomLessonTypes();
  return [...BUILTIN_LESSON_TYPES, ...custom];
}

/* Retrieve full metadata (label, icon, color) for a lesson type ID */
export function getLessonTypeInfo(
  typeId: string | null | undefined,
  language: string = 'uk'
): { id: string; label: string; icon: string; color: string } | null {
  if (!typeId) return null;
  const all = getAllLessonTypes();
  const match = all.find((item) => item.id.toLowerCase() === typeId.toLowerCase());
  if (match) {
    return {
      id: match.id,
      label: language === 'uk' ? match.nameUk : match.nameEn,
      icon: match.icon,
      color: match.color,
    };
  }

  return {
    id: typeId,
    label: typeId,
    icon: '📚',
    color: '#6366f1',
  };
}
