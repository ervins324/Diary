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

// In-memory caches to eliminate synchronous localStorage reads and JSON.parse on every frame/render
let cachedCustomEvents: CustomEventType[] | null = null;
let cachedAllEvents: CustomEventType[] | null = null;
let cachedEventMap: Map<string, CustomEventType> | null = null;

let cachedCustomLessons: CustomLessonType[] | null = null;
let cachedAllLessons: CustomLessonType[] | null = null;
let cachedLessonMap: Map<string, CustomLessonType> | null = null;

function initEventCache(): void {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_EVENTS_KEY) : null;
    cachedCustomEvents = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load custom event types from localStorage', e);
    cachedCustomEvents = [];
  }
  cachedAllEvents = [...BUILTIN_EVENT_TYPES, ...(cachedCustomEvents || [])];
  cachedEventMap = new Map();
  for (const item of cachedAllEvents) {
    cachedEventMap.set(item.id.toLowerCase(), item);
  }
}

function initLessonCache(): void {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_LESSONS_KEY) : null;
    cachedCustomLessons = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load custom lesson types from localStorage', e);
    cachedCustomLessons = [];
  }
  cachedAllLessons = [...BUILTIN_LESSON_TYPES, ...(cachedCustomLessons || [])];
  cachedLessonMap = new Map();
  for (const item of cachedAllLessons) {
    cachedLessonMap.set(item.id.toLowerCase(), item);
  }
}

// Invalidate on cross-tab storage changes or custom event signals
if (typeof window !== 'undefined') {
  window.addEventListener('custom_types_changed', () => {
    initEventCache();
    initLessonCache();
  });
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === CUSTOM_EVENTS_KEY) {
      initEventCache();
    }
    if (!e.key || e.key === CUSTOM_LESSONS_KEY) {
      initLessonCache();
    }
  });
}

/* Retrieve user-created custom event types */
export function getCustomEventTypes(): CustomEventType[] {
  if (!cachedCustomEvents) {
    initEventCache();
  }
  return cachedCustomEvents || [];
}

/* Save user-created custom event types */
export function saveCustomEventTypes(types: CustomEventType[]): void {
  try {
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(types));
    cachedCustomEvents = types;
    cachedAllEvents = [...BUILTIN_EVENT_TYPES, ...types];
    cachedEventMap = new Map();
    for (const item of cachedAllEvents) {
      cachedEventMap.set(item.id.toLowerCase(), item);
    }
    window.dispatchEvent(new Event('custom_types_changed'));
  } catch (e) {
    console.error('Failed to save custom event types to localStorage', e);
  }
}

/* Get combined list of built-in templates and user custom event types */
export function getAllEventTypes(): CustomEventType[] {
  if (!cachedAllEvents) {
    initEventCache();
  }
  return cachedAllEvents || BUILTIN_EVENT_TYPES;
}

/* Retrieve full metadata (label, icon, color) for an event type ID */
export function getEventTypeInfo(
  typeId: string | null | undefined,
  language: string = 'uk'
): { id: string; label: string; icon: string; color: string } | null {
  if (!typeId) return null;
  if (!cachedEventMap) {
    initEventCache();
  }
  const match = cachedEventMap?.get(typeId.toLowerCase());
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
  if (!cachedCustomLessons) {
    initLessonCache();
  }
  return cachedCustomLessons || [];
}

/* Save user-created custom lesson types */
export function saveCustomLessonTypes(types: CustomLessonType[]): void {
  try {
    localStorage.setItem(CUSTOM_LESSONS_KEY, JSON.stringify(types));
    cachedCustomLessons = types;
    cachedAllLessons = [...BUILTIN_LESSON_TYPES, ...types];
    cachedLessonMap = new Map();
    for (const item of cachedAllLessons) {
      cachedLessonMap.set(item.id.toLowerCase(), item);
    }
    window.dispatchEvent(new Event('custom_types_changed'));
  } catch (e) {
    console.error('Failed to save custom lesson types to localStorage', e);
  }
}

/* Get combined list of built-in and custom lesson types */
export function getAllLessonTypes(): CustomLessonType[] {
  if (!cachedAllLessons) {
    initLessonCache();
  }
  return cachedAllLessons || BUILTIN_LESSON_TYPES;
}

/* Retrieve full metadata (label, icon, color) for a lesson type ID */
export function getLessonTypeInfo(
  typeId: string | null | undefined,
  language: string = 'uk'
): { id: string; label: string; icon: string; color: string } | null {
  if (!typeId) return null;
  if (!cachedLessonMap) {
    initLessonCache();
  }
  const match = cachedLessonMap?.get(typeId.toLowerCase());
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
