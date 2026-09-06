import { useState } from 'react';
import { X, Loader2, Sparkles, Plus, Trash2, Check } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { useAiParseBells, useBulkCommitBells } from '../../hooks/useBells';
import type { AiParsedBellSlot } from '../../types';

interface AiBellsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiBellsImportModal({ isOpen, onClose }: AiBellsImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slots, setSlots] = useState<AiParsedBellSlot[]>([]);

  const parseMutation = useAiParseBells();
  const commitMutation = useBulkCommitBells();

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const result = await parseMutation.mutateAsync(file);
      // Sort slots by ascending order
      const sorted = [...(result.slots || [])].sort((a, b) => a.order - b.order);
      setSlots(sorted);
    } catch (err) {
      console.error('Failed to parse bells image:', err);
    }
  };

  const handleUpdateSlot = (index: number, field: keyof AiParsedBellSlot, value: unknown) => {
    setSlots(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSlot = () => {
    setSlots(prev => {
      const nextOrder = prev.length > 0 ? Math.max(...prev.map(s => s.order)) + 1 : 1;
      return [
        ...prev,
        {
          order: nextOrder,
          start_time: '08:30',
          end_time: '09:15',
          name: `${nextOrder} урок`,
        },
      ];
    });
  };

  const handleCommit = async () => {
    if (slots.length === 0) return;

    const payload = slots.map(s => ({
      lesson_order: s.order,
      start_time: (s.start_time || '08:30').substring(0, 5),
      end_time: (s.end_time || '09:15').substring(0, 5),
      name: s.name || `${s.order} урок`,
    }));

    await commitMutation.mutateAsync(payload);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl(null);
    setSlots([]);
    parseMutation.reset();
    commitMutation.reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Import Bell Schedule via AI</h2>
              <p className="text-xs text-text-muted">Upload a photo of your school's bell timetable (розклад дзвінків)</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
          {slots.length === 0 ? (
            /* Step 1: Upload Image */
            <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full py-8">
              <FileDropzone onFileSelect={setFile} selectedFile={file} />

              {parseMutation.isError && (
                <div className="mt-4 p-3.5 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm w-full text-left">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>⚠️</span> Parsing failed
                  </p>
                  <p className="text-xs mt-1 text-danger/90 break-words font-mono">
                    {(parseMutation.error as any)?.response?.data?.detail || parseMutation.error.message || 'Unknown error'}
                  </p>
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={!file || parseMutation.isPending}
                className="mt-6 w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Analyzing Image with Gemini 3.5 Flash...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Extract Bell Schedule</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Step 2: Review and Edit Parsed Bells */
            <div className="flex flex-col md:flex-row gap-6">
              {/* Image Preview (Left side on desktop) */}
              {previewUrl && (
                <div className="w-full md:w-5/12 flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-text-primary">Source Image</h3>
                  <div className="bg-bg-tertiary rounded-lg border border-border overflow-hidden h-64 md:h-[450px] flex items-center justify-center p-2">
                    <img
                      src={previewUrl}
                      alt="Bell schedule source"
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                </div>
              )}

              {/* Editable Table (Right side on desktop) */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-text-primary">
                    Extracted Bell Slots ({slots.length})
                  </h3>
                  <button
                    onClick={handleAddSlot}
                    className="text-xs text-accent hover:bg-accent/10 px-2.5 py-1 rounded-md flex items-center gap-1 font-medium transition-colors"
                  >
                    <Plus size={14} /> Add Lesson
                  </button>
                </div>

                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg-tertiary text-text-secondary text-xs uppercase border-b border-border">
                      <tr>
                        <th className="px-3 py-2 w-14">#</th>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2 w-28">Start</th>
                        <th className="px-3 py-2 w-28">End</th>
                        <th className="px-2 py-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slots.map((slot, index) => (
                        <tr key={index} className="hover:bg-bg-tertiary/40 transition-colors">
                          <td className="px-3 py-2 font-medium text-text-muted">
                            <input
                              type="number"
                              min="1"
                              value={slot.order}
                              onChange={e => handleUpdateSlot(index, 'order', parseInt(e.target.value) || 1)}
                              className="w-12 bg-transparent border border-border rounded px-1.5 py-0.5 text-center text-sm focus:border-accent focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={slot.name || ''}
                              placeholder={`${slot.order} урок`}
                              onChange={e => handleUpdateSlot(index, 'name', e.target.value)}
                              className="w-full bg-transparent border border-border rounded px-2 py-0.5 text-sm focus:border-accent focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              value={(slot.start_time || '').substring(0, 5)}
                              onChange={e => handleUpdateSlot(index, 'start_time', e.target.value)}
                              className="w-full bg-transparent border border-border rounded px-1.5 py-0.5 text-sm focus:border-accent focus:outline-none font-mono"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              value={(slot.end_time || '').substring(0, 5)}
                              onChange={e => handleUpdateSlot(index, 'end_time', e.target.value)}
                              className="w-full bg-transparent border border-border rounded px-1.5 py-0.5 text-sm focus:border-accent focus:outline-none font-mono"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleRemoveSlot(index)}
                              className="text-text-muted hover:text-danger p-1 rounded transition-colors"
                              title="Delete row"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border mt-auto">
                  <button
                    onClick={() => setSlots([])}
                    className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg transition-colors"
                  >
                    Re-upload
                  </button>
                  <button
                    onClick={handleCommit}
                    disabled={commitMutation.isPending || slots.length === 0}
                    className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {commitMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Save Bell Schedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
