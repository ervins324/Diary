import { useState } from 'react';
import {
  Bell,
  Sparkles,
  Plus,
  Clock,
  Trash2,
  Edit2,
  Check,
  Loader2,
  Coffee,
} from 'lucide-react';
import { useBells, useSaveBellSlot, useDeleteBellSlot } from '../hooks/useBells';
import { AiBellsImportModal } from '../components/ai-import/AiBellsImportModal';
import type { BellSlot } from '../types';

export function BellsPage() {
  const { data: bells, isLoading } = useBells();
  const saveMutation = useSaveBellSlot();
  const deleteMutation = useDeleteBellSlot();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BellSlot>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<Partial<BellSlot>>({
    lesson_order: 1,
    start_time: '08:30',
    end_time: '09:15',
    name: '1 урок',
  });

  // Calculate duration in minutes between two HH:MM strings
  const getDurationMinutes = (start: string, end: string) => {
    try {
      const [sh, sm] = start.substring(0, 5).split(':').map(Number);
      const [eh, em] = end.substring(0, 5).split(':').map(Number);
      return eh * 60 + em - (sh * 60 + sm);
    } catch {
      return 45;
    }
  };

  // Calculate break in minutes between current lesson end and next lesson start
  const getBreakMinutes = (currentEnd: string, nextStart: string) => {
    try {
      const [eh, em] = currentEnd.substring(0, 5).split(':').map(Number);
      const [sh, sm] = nextStart.substring(0, 5).split(':').map(Number);
      const diff = sh * 60 + sm - (eh * 60 + em);
      return diff > 0 ? diff : null;
    } catch {
      return null;
    }
  };

  const handleStartEdit = (slot: BellSlot) => {
    setEditingId(slot.id);
    setEditForm({
      lesson_order: slot.lesson_order,
      start_time: slot.start_time.substring(0, 5),
      end_time: slot.end_time.substring(0, 5),
      name: slot.name || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await saveMutation.mutateAsync({
      id: editingId,
      ...editForm,
    });
    setEditingId(null);
  };

  const handleSaveAdd = async () => {
    await saveMutation.mutateAsync({
      lesson_order: Number(addForm.lesson_order) || 1,
      start_time: (addForm.start_time || '08:30').substring(0, 5),
      end_time: (addForm.end_time || '09:15').substring(0, 5),
      name: addForm.name || `${addForm.lesson_order} урок`,
    });
    setIsAdding(false);
    // Suggest next lesson order
    const nextOrder = (Number(addForm.lesson_order) || 1) + 1;
    setAddForm({
      lesson_order: nextOrder,
      start_time: '09:25',
      end_time: '10:10',
      name: `${nextOrder} урок`,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this lesson bell slot?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const sortedBells = bells ? [...bells].sort((a, b) => a.lesson_order - b.lesson_order) : [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-secondary p-4 sm:p-6 rounded-xl border border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Bell size={20} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Bell Schedule</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            School lesson bells and break intervals (Розклад дзвінків)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-accent/10 hover:bg-accent/20 text-accent font-medium rounded-lg text-sm transition-colors"
          >
            <Sparkles size={16} />
            <span>AI Image Parse</span>
          </button>
          <button
            onClick={() => {
              const nextOrder = sortedBells.length > 0 ? Math.max(...sortedBells.map(b => b.lesson_order)) + 1 : 1;
              setAddForm({
                lesson_order: nextOrder,
                start_time: '08:30',
                end_time: '09:15',
                name: `${nextOrder} урок`,
              });
              setIsAdding(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-accent hover:bg-accent/90 text-white font-medium rounded-lg text-sm transition-colors shadow-xs"
          >
            <Plus size={16} />
            <span>Add Lesson</span>
          </button>
        </div>
      </div>

      {/* Add New Lesson Inline Form */}
      {isAdding && (
        <div className="bg-accent-light/40 border border-accent/40 rounded-xl p-4 animate-in fade-in duration-200">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Add Lesson Bell Interval</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Lesson Order (#)</label>
              <input
                type="number"
                min="1"
                value={addForm.lesson_order}
                onChange={e => setAddForm({ ...addForm, lesson_order: parseInt(e.target.value) || 1 })}
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Label / Title</label>
              <input
                type="text"
                value={addForm.name || ''}
                placeholder="1 урок"
                onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Start Time</label>
              <input
                type="time"
                value={addForm.start_time}
                onChange={e => setAddForm({ ...addForm, start_time: e.target.value })}
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm focus:border-accent focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">End Time</label>
              <input
                type="time"
                value={addForm.end_time}
                onChange={e => setAddForm({ ...addForm, end_time: e.target.value })}
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm focus:border-accent focus:outline-none font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAdd}
              disabled={saveMutation.isPending}
              className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save Lesson
            </button>
          </div>
        </div>
      )}

      {/* Bell Schedule Timeline / List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading bell schedule...</span>
        </div>
      ) : sortedBells.length === 0 ? (
        <div className="bg-bg-secondary border border-border rounded-xl p-10 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-bg-tertiary flex items-center justify-center text-text-muted mb-3">
            <Clock size={28} />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Bell Schedule Configured</h3>
          <p className="text-sm text-text-secondary mt-1 max-w-md">
            Upload a photo of your school's bell timetable or add lessons manually to personalize lesson durations and breaks.
          </p>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Sparkles size={16} /> Import from Photo
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-bg-tertiary hover:bg-border text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBells.map((slot, index) => {
            const isEditing = editingId === slot.id;
            const nextSlot = sortedBells[index + 1];
            const breakMinutes = nextSlot ? getBreakMinutes(slot.end_time, nextSlot.start_time) : null;
            const duration = getDurationMinutes(slot.start_time, slot.end_time);

            return (
              <div key={slot.id} className="space-y-3">
                {/* Lesson Slot Card */}
                <div className="bg-bg-secondary border border-border rounded-xl p-4 transition-all hover:border-accent/40 shadow-xs">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-text-muted">Order (#)</label>
                          <input
                            type="number"
                            min="1"
                            value={editForm.lesson_order}
                            onChange={e => setEditForm({ ...editForm, lesson_order: parseInt(e.target.value) || 1 })}
                            className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-text-muted">Label</label>
                          <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-text-muted">Start</label>
                          <input
                            type="time"
                            value={editForm.start_time}
                            onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                            className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-text-muted">End</label>
                          <input
                            type="time"
                            value={editForm.end_time}
                            onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                            className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 bg-accent hover:bg-accent/90 text-white rounded text-xs font-medium flex items-center gap-1"
                        >
                          <Check size={14} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center font-bold text-sm text-text-primary shrink-0">
                          {slot.lesson_order}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary text-sm truncate">
                            {slot.name || `${slot.lesson_order} урок`}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                            <span className="font-mono text-text-secondary font-medium">
                              {slot.start_time.substring(0, 5)} – {slot.end_time.substring(0, 5)}
                            </span>
                            <span>•</span>
                            <span>{duration} min</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(slot)}
                          className="p-1.5 text-text-muted hover:text-accent hover:bg-bg-tertiary rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(slot.id)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-bg-tertiary rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Break Indicator between lessons */}
                {breakMinutes !== null && breakMinutes > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1 text-xs text-text-muted">
                    <div className="h-px bg-border flex-1" />
                    <div className="flex items-center gap-1 bg-bg-tertiary border border-border px-2.5 py-0.5 rounded-full text-[11px] text-text-secondary font-medium shrink-0">
                      <Coffee size={12} className="text-accent" />
                      <span>{breakMinutes} min break</span>
                    </div>
                    <div className="h-px bg-border flex-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Bells Import Modal */}
      <AiBellsImportModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
}
