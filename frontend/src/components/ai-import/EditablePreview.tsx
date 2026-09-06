import { Plus, Trash2 } from 'lucide-react';
import type { AiParsedDay, AiParsedLesson } from '../../types';

interface EditablePreviewProps {
  data: AiParsedDay[];
  onChange: (data: AiParsedDay[]) => void;
}

export function EditablePreview({ data, onChange }: EditablePreviewProps) {
  
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
    
    newData[dayIndex].lessons.push({
      order: newOrder,
      subject_name: 'New Subject',
      start_time: '08:00',
      end_time: '08:45',
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-bg-tertiary text-text-secondary sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 border-b border-border font-medium">#</th>
            <th className="px-3 py-2 border-b border-border font-medium w-1/3">Subject</th>
            <th className="px-3 py-2 border-b border-border font-medium">Start</th>
            <th className="px-3 py-2 border-b border-border font-medium">End</th>
            <th className="px-3 py-2 border-b border-border font-medium">Cab</th>
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
                    No lessons parsed for this day.
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
