import { useState } from 'react';
import { X, Loader2, Sparkles, Plus, Trash2, Check, Image, FileText, Copy, UploadCloud } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { useAiParseBells, useParseBellsJson, useBulkCommitBells } from '../../hooks/useBells';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AiParsedBellSlot } from '../../types';

interface AiBellsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AI_BELLS_PROMPT = `Витягни розклад шкільних дзвінків з цього зображення у форматі JSON за такою схемою:
{
  "slots": [
    {
      "order": 1,
      "start_time": "08:30",
      "end_time": "09:15",
      "name": "1 урок"
    }
  ]
}

Вимоги:
1. order: порядковий номер уроку (1, 2, 3...).
2. start_time та end_time: час у 24-годинному форматі HH:MM (наприклад, 08:30, 09:15).
3. name: назва уроку (наприклад, "1 урок", "2 урок").
4. Надай виключно чистий валідний JSON без зайвих слів.`;

export function AiBellsImportModal({ isOpen, onClose }: AiBellsImportModalProps) {
  const { t } = useLanguage();
  /* Active tab mode: 'photo' (via Gemini API) or 'json' (from external AI, no API key required) */
  const [importMode, setImportMode] = useState<'photo' | 'json'>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState<string>('');
  const [rawJsonPreview, setRawJsonPreview] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [slots, setSlots] = useState<AiParsedBellSlot[]>([]);

  const parseMutation = useAiParseBells();
  const jsonParseMutation = useParseBellsJson();
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

  /* Parse raw JSON submitted from external AI */
  const handleParseJson = async () => {
    if (!jsonInput.trim()) return;
    try {
      const result = await jsonParseMutation.mutateAsync(jsonInput);
      const sorted = [...(result.slots || [])].sort((a, b) => a.order - b.order);
      setSlots(sorted);
      setRawJsonPreview(jsonInput.trim());
    } catch (err) {
      console.error('Failed to parse bells JSON:', err);
    }
  };

  /* Copy template prompt for external AI */
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_BELLS_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  /* Load uploaded .json file content into textarea */
  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonInput(content);
      }
    };
    reader.readAsText(uploadedFile);
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
    setJsonInput('');
    setRawJsonPreview('');
    setSlots([]);
    parseMutation.reset();
    jsonParseMutation.reset();
    commitMutation.reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t('import_bells_ai')}</h2>
              <p className="text-xs text-text-muted">{t('import_bells_desc')}</p>
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
            /* Step 1: Upload Image or Paste JSON */
            <div className="flex-1 flex flex-col items-center justify-start max-w-xl mx-auto w-full py-2 md:py-4">
              {/* Import Mode Tabs */}
              <div className="flex p-1 bg-bg-tertiary rounded-lg border border-border mb-6 w-full max-w-md">
                <button
                  type="button"
                  onClick={() => setImportMode('photo')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    importMode === 'photo'
                      ? 'bg-bg-secondary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Image size={16} />
                  <span>{t('tab_photo_ai')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('json')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    importMode === 'json'
                      ? 'bg-bg-secondary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <FileText size={16} />
                  <span>{t('tab_json_ai')}</span>
                </button>
              </div>

              {importMode === 'photo' ? (
                /* Mode A: Photo upload */
                <div className="w-full flex flex-col items-center">
                  <FileDropzone onFileSelect={setFile} selectedFile={file} />

                  {parseMutation.isError && (
                    <div className="mt-4 p-3.5 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm w-full text-left">
                      <p className="font-semibold flex items-center gap-1.5">
                        <span>⚠️</span> {t('parsing_failed')}
                      </p>
                      <p className="text-xs mt-1 text-danger/90 break-words font-mono">
                        {(parseMutation.error as any)?.response?.data?.detail || parseMutation.error.message || t('unknown_error')}
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
                        <span>{t('analyzing_bells')}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>{t('extract_bells_btn')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Mode B: Direct JSON input */
                <div className="w-full flex flex-col gap-4">
                  {/* Prompt helper callout */}
                  <div className="p-3.5 bg-accent/10 border border-accent/20 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs md:text-sm">
                    <p className="text-text-secondary leading-relaxed">
                      {t('json_instructions_hint')}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="shrink-0 px-3 py-1.5 bg-accent text-white hover:bg-accent/90 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedPrompt ? t('prompt_copied') : t('copy_ai_prompt')}</span>
                    </button>
                  </div>

                  {/* JSON Textarea */}
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder={t('paste_json_placeholder')}
                      className="w-full h-44 md:h-56 p-3 bg-bg-primary border border-border rounded-lg text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none transition-colors"
                    />
                  </div>

                  {/* File Upload Alternative & Action */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <label
                      htmlFor="bells-json-file-input"
                      className="cursor-pointer text-xs text-accent hover:underline flex items-center gap-1.5"
                    >
                      <UploadCloud size={14} />
                      <span>{t('upload_json_file')}</span>
                      <input
                        id="bells-json-file-input"
                        type="file"
                        accept=".json,application/json,text/plain"
                        onChange={handleJsonFileUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleParseJson}
                      disabled={!jsonInput.trim() || jsonParseMutation.isPending}
                      className="w-full sm:w-auto px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-xs"
                    >
                      {jsonParseMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                      {jsonParseMutation.isPending ? t('parsing_json') : t('parse_json_btn')}
                    </button>
                  </div>

                  {jsonParseMutation.isError && (
                    <div className="p-3.5 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm text-left">
                      <p className="font-semibold flex items-center gap-1.5">
                        <span>⚠️</span> {t('parsing_failed')}
                      </p>
                      <p className="text-xs mt-1 text-danger/90 break-words font-mono">
                        {(jsonParseMutation.error as any)?.response?.data?.detail || jsonParseMutation.error.message || t('invalid_json_error')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Review and Edit Parsed Bells */
            <div className="flex flex-col md:flex-row gap-6">
              {/* Source Preview: Image or JSON (Left side on desktop) */}
              {previewUrl ? (
                <div className="w-full md:w-5/12 flex flex-col gap-2 shrink-0">
                  <h3 className="text-sm font-medium text-text-primary">{t('source_image')}</h3>
                  <div className="bg-bg-tertiary rounded-lg border border-border overflow-hidden h-64 md:h-[450px] flex items-center justify-center p-2">
                    <img
                      src={previewUrl}
                      alt="Bell schedule source"
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full md:w-5/12 flex flex-col gap-2 shrink-0">
                  <h3 className="text-sm font-medium text-text-primary">{t('source_json')}</h3>
                  <div className="bg-bg-tertiary rounded-lg border border-border overflow-hidden h-64 md:h-[450px] p-3 flex flex-col">
                    <pre className="text-xs font-mono text-text-secondary overflow-auto flex-1 whitespace-pre-wrap select-all">
                      {rawJsonPreview || JSON.stringify({ slots }, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Editable Table (Right side on desktop) */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-text-primary">
                    {t('extracted_bells')} ({slots.length})
                  </h3>
                  <button
                    onClick={handleAddSlot}
                    className="text-xs text-accent hover:bg-accent/10 px-2.5 py-1 rounded-md flex items-center gap-1 font-medium transition-colors"
                  >
                    <Plus size={14} /> {t('add_lesson')}
                  </button>
                </div>

                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg-tertiary text-text-secondary text-xs uppercase border-b border-border">
                      <tr>
                        <th className="px-3 py-2 w-14">{t('table_num')}</th>
                        <th className="px-3 py-2">{t('label_title')}</th>
                        <th className="px-3 py-2 w-28">{t('table_start')}</th>
                        <th className="px-3 py-2 w-28">{t('table_end')}</th>
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
                              placeholder={`${slot.order} ${t('lesson_label')}`}
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
                    {t('re_upload')}
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
                    {t('save_bell_schedule')}
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
