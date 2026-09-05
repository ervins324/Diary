import { useState } from 'react';
import { Check, X, Edit2, Trash2 } from 'lucide-react';
import { useUpdateHomework, useDeleteHomework } from '../../hooks/useHomework';
import type { HomeworkEntry } from '../../types';
import { cn } from '../../lib/utils';

interface HomeworkInlineProps {
  homework: HomeworkEntry;
}

/**
 * Inline homework display within a LessonCard.
 * Shows completion toggle, text, and edit/delete actions on hover.
 */
export function HomeworkInline({ homework }: HomeworkInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  /* Use homework.text to match backend HomeworkRead schema */
  const [editText, setEditText] = useState(homework.text);
  
  const updateMutation = useUpdateHomework();
  const deleteMutation = useDeleteHomework();

  /* Toggle the completion status */
  const handleToggle = () => {
    updateMutation.mutate({ id: homework.id, data: { is_completed: !homework.is_completed } });
  };

  /* Save edited text */
  const handleSave = () => {
    if (editText.trim() !== homework.text) {
      updateMutation.mutate({ id: homework.id, data: { text: editText } });
    }
    setIsEditing(false);
  };

  /* Delete with confirmation */
  const handleDelete = () => {
    if (confirm('Delete this homework?')) {
      deleteMutation.mutate(homework.id);
    }
  };

  /* Inline edit mode */
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
          autoFocus
        />
        <button onClick={handleSave} className="text-success hover:bg-success/10 p-1 rounded">
          <Check size={14} />
        </button>
        <button onClick={() => setIsEditing(false)} className="text-text-muted hover:bg-bg-tertiary p-1 rounded">
          <X size={14} />
        </button>
      </div>
    );
  }

  /* Default display mode */
  return (
    <div className="group flex items-start gap-2 mt-1">
      {/* Completion checkbox */}
      <button
        onClick={handleToggle}
        className={cn(
          "mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
          homework.is_completed ? "bg-success border-success text-white" : "border-border hover:border-accent"
        )}
      >
        {homework.is_completed && <Check size={12} />}
      </button>
      {/* Homework text with strikethrough when completed */}
      <span className={cn("text-sm flex-1", homework.is_completed && "line-through text-text-muted")}>
        {homework.text}
      </span>
      {/* Edit/delete actions — visible on hover */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
        <button onClick={() => setIsEditing(true)} className="text-text-muted hover:text-accent p-1">
          <Edit2 size={12} />
        </button>
        <button onClick={handleDelete} className="text-text-muted hover:text-danger p-1">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
