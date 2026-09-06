import { Plus, Trash2 } from 'lucide-react';
import type { AiParsedDay, AiParsedLesson, BellSlot } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface EditablePreviewProps {
  data: AiParsedDay[];
  onChange: (data: AiParsedDay[]) => void;
  /* Optional bell schedule slots for smart default times when adding new lessons */
  bellSlots?: BellSlot[];
}

export function EditablePreview({ data, onChange, bellSlots }: EditablePreviewProps) {
  const { t } = useLanguage();
  
  const updateLesson = (dayIndex: number, lessonIndex: number, field: keyof AiParsedLesson, value: any) => {
    const newData = [...data];
    newData[dayIndex].lessons[lessonIndex] = {
      ...newData[dayIndex].lessons[lessonIndex],
      [field]: value
    };
    onChange(newData);
  };

  const addLesson = (dayIndex: number) => {
    const newData = [...data];
    const newOrder = newData[dayIndex].lessons.length > 0 
      ? Math.max(...newData[dayIndex].lessons.map(l => l.order)) + 1 
      : 1;
    
    /* Use imported bell schedule times if available, otherwise fall back to hardcoded defaults */
    const bellSlot = bellSlots?.find(b => b.lesson_order === newOrder);
    const defaultStart = bellSlot ? bellSlot.start_time.substring(0, 5) : '08:00';
    const defaultEnd = bellSlot ? bellSlot.end_time.substring(0, 5) : '08:45';

    newData[dayIndex].lessons.push({
      order: newOrder,
      subject_name: 'New Subject',
      start_time: defaultStart,
      end_time: defaultEnd,
      cabinet: ''
    });
    onChange(newData);
  };

  const removeLesson = (dayIndex: number, lessonIndex: number) => {
    const newData = [...data];
    newData[dayIndex].lessons.splice(lessonIndex, 1);
    onChange(newData);
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-auto min-h-0 max-h-[50vh] md:max-h-[550px]">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-bg-tertiary text-text-secondary sticky top-0 z-10 shadow-xs">
          <tr>
            <th className="px-3 py-2 border-b border-border font-medium w-12">{t('table_num')}</th>
            <th className="px-3 py-2 border-b border-border font-medium w-1/3">{t('table_subject')}</th>
            <th className="px-3 py-2 border-b border-border font-medium">{t('table_start')}</th>
            <th className="px-3 py-2 border-b border-border font-medium">{t('table_end')}</th>
            <th className="px-3 py-2 border-b border-border font-medium w-20">{t('table_cab')}</th>
            <th className="px-3 py-2 border-b border-border font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((day, dayIndex) => (
            <div key={dayIndex} className="contents">
              <tr>
                <td colSpan={6} className="px-3 py-2 bg-bg-secondary font-semibold text-text-primary border-b border-border">
                  <div className="flex justify-between items-center">
                    <span>{day.day_name}</span>
                    <button 
                      onClick={() => addLesson(dayIndex)}
                      className="text-accent hover:text-accent-light flex items-center gap-1 text-xs font-normal"
                    >
                      <Plus size={14} /> Add Lesson
                    </button>
                  </div>
                </td>
              </tr>
              {day.lessons.map((lesson, lessonIndex) => (
                <tr key={`${dayIndex}-${lessonIndex}`} className="border-b border-border-light hover:bg-bg-tertiary/50">
                  <td className="px-3 py-1.5">
                    <input 
                      type="number" 
                      value={lesson.order} 
                      onChange={(e) => updateLesson(dayIndex, lessonIndex, 'order', parseInt(e.target.value))}
                      className="w-12 bg-transparent border border-border rounded px-1 py-1 focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input 
                      type="text" 
                      value={lesson.subject_name} 
                      onChange={(e) => updateLesson(dayIndex, lessonIndex, 'subject_name', e.target.value)}
                      className="w-full bg-transparent border border-border rounded px-2 py-1 focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input 
                      type="time" 
                      value={(lesson.start_time || '').substring(0, 5)} 
                      onChange={(e) => updateLesson(dayIndex, lessonIndex, 'start_time', e.target.value + ':00')}
                      className="w-full bg-transparent border border-border rounded px-1 py-1 focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input 
                      type="time" 
                      value={(lesson.end_time || '').substring(0, 5)} 
                      onChange={(e) => updateLesson(dayIndex, lessonIndex, 'end_time', e.target.value + ':00')}
                      className="w-full bg-transparent border border-border rounded px-1 py-1 focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input 
                      type="text" 
                      value={lesson.cabinet || ''} 
                      onChange={(e) => updateLesson(dayIndex, lessonIndex, 'cabinet', e.target.value)}
                      className="w-16 bg-transparent border border-border rounded px-1 py-1 focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button 
                      onClick={() => removeLesson(dayIndex, lessonIndex)}
                      className="text-text-muted hover:text-danger p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {day.lessons.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-text-muted text-sm border-b border-border-light">
                    {t('no_lessons_parsed_day')}
                  </td>
                </tr>
              )}
            </div>
          ))}
        </tbody>
      </table>
    </div>
  );
}
