import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { LessonSlot } from '../../types';
import { formatTime } from '../../lib/utils';
import { HomeworkInline } from '../homework/HomeworkInline';
import { useCreateHomework } from '../../hooks/useHomework';

interface LessonCardProps {
  lesson: LessonSlot;
}

export function LessonCard({ lesson }: LessonCardProps) {
  const [isAddingHomework, setIsAddingHomework] = useState(false);
  const [newHomework, setNewHomework] = useState('');
  const createMutation = useCreateHomework();

  const handleAddHomework = () => {
    if (newHomework.trim()) {
      createMutation.mutate(
        {
          subject_id: lesson.subject.id,
          due_date: lesson.date,
          lesson_order: lesson.lesson_order,
          text: newHomework.trim(),
        },
        {
          onSuccess: () => {
            setNewHomework('');
            setIsAddingHomework(false);
          },
        }
      );
    } else {
      setIsAddingHomework(false);
    }
  };

  return (
    <div className="relative bg-bg-secondary rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Color strip */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5" 
        style={{ backgroundColor: lesson.subject.color_hex || 'var(--color-accent)' }} 
      />
      
      <div className="pl-4 pr-3 py-3 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-bg-tertiary text-text-secondary">
              {lesson.lesson_order}
            </span>
            <span className="font-semibold text-text-primary">
              {lesson.subject.name}
            </span>
          </div>
          {lesson.cabinet && (
            <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary font-medium">
              Cab {lesson.cabinet}
            </span>
          )}
        </div>
        
        <div className="text-xs text-text-muted">
          {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
        </div>

        <div className="mt-1">
          {lesson.homework?.map((hw) => (
            <HomeworkInline key={hw.id} homework={hw} />
          ))}
          
          {isAddingHomework ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="Add homework..."
                value={newHomework}
                onChange={(e) => setNewHomework(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddHomework();
                  if (e.key === 'Escape') setIsAddingHomework(false);
                }}
                className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAddingHomework(true)}
              className="mt-2 flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
            >
              <Plus size={12} /> Add Homework
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
