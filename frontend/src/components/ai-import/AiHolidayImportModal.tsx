import { useState } from 'react';
import { X, Loader2, Sparkles, Plus, Trash2, Check, FileText, Copy, UploadCloud } from 'lucide-react';
import { copyToClipboard } from '../../lib/clipboard';
import { useParseHolidaysJson, useBulkCommitHolidays } from '../../hooks/useHolidays';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AiParsedHoliday } from '../../types';

interface AiHolidayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AI_HOLIDAYS_PROMPT = `Витягни графік шкільних канікул та святкових вихідних днів з тексту у форматі JSON за такою схемою:
{
  "holidays": [
    {
      "name": "Осінні канікули",
      "start_date": "2026-10-26",
      "end_date": "2026-11-01"
    }
  ]
}

Вимоги:
1. name: назва канікул або свята (наприклад, "Осінні канікули", "Зимові канікули", "Весняні канікули").
2. start_date та end_date: дата початку та завершення включно у форматі YYYY-MM-DD.
3. Надай виключно чистий валідний JSON без зайвого тексту.`;

export function AiHolidayImportModal({ isOpen, onClose }: AiHolidayImportModalProps) {
  const { t } = useLanguage();
  const [jsonInput, setJsonInput] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [holidays, setHolidays] = useState<AiParsedHoliday[]>([]);

  const jsonParseMutation = useParseHolidaysJson();
  const commitMutation = useBulkCommitHolidays();

  if (!isOpen) return null;

  /* Parse raw JSON submitted from external AI */
  const handleParseJson = async () => {
    if (!jsonInput.trim()) return;
    try {
      const result = await jsonParseMutation.mutateAsync(jsonInput);
      setHolidays(result.holidays || []);
    } catch (err) {
      console.error('Failed to parse holidays JSON:', err);
    }
  };

  /* Copy template prompt for external AI */
  const handleCopyPrompt = async () => {
    await copyToClipboard(AI_HOLIDAYS_PROMPT);
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

  const handleUpdateHoliday = (index: number, field: keyof AiParsedHoliday, value: string) => {
    setHolidays((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddHoliday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setHolidays((prev) => [
      ...prev,
      {
        name: 'Нові канікули',
        start_date: todayStr,
        end_date: todayStr,
      },
    ]);
  };

  const handleDeleteHoliday = (index: number) => {
    setHolidays((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCommit = async () => {
    try {
      await commitMutation.mutateAsync(holidays);
      onClose();
    } catch (err) {
      console.error('Failed to commit holidays:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-bg-primary border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">{t('holiday_ai_import_title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {holidays.length === 0 ? (
            <div className="space-y-4">
              {/* Copy prompt card */}
              <div className="bg-bg-secondary p-3.5 rounded-xl border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <FileText size={14} className="text-accent" />
                    <span>{t('holiday_prompt_instruction')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-accent text-white rounded-lg hover:opacity-90 font-medium transition cursor-pointer"
                  >
                    {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedPrompt ? t('copied') : t('copy_prompt')}</span>
                  </button>
                </div>
                <pre className="text-[11px] bg-bg-tertiary p-2.5 rounded-lg border border-border text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono">
                  {AI_HOLIDAYS_PROMPT}
                </pre>
              </div>

              {/* Paste JSON */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-primary">{t('paste_json_label')}</label>
                  <label className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer">
                    <UploadCloud size={13} />
                    <span>{t('holiday_upload_json_file')}</span>
                    <input type="file" accept=".json" onChange={handleJsonFileUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{"holidays": [{"name": "Осінні канікули", "start_date": "2026-10-26", "end_date": "2026-11-01"}]}'
                  rows={6}
                  className="w-full bg-bg-secondary border border-border rounded-lg p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!jsonInput.trim() || jsonParseMutation.isPending}
                  onClick={handleParseJson}
                  className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {jsonParseMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  <span>{t('holiday_parse_data')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">
                  {t('parsed_holidays_count').replace('{count}', String(holidays.length))}
                </span>
                <button
                  type="button"
                  onClick={handleAddHoliday}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-bg-tertiary text-text-primary rounded-md hover:bg-border border border-border font-medium cursor-pointer"
                >
                  <Plus size={12} />
                  <span>{t('add_holiday')}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {holidays.map((hol, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-bg-secondary rounded-lg border border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <input
                      type="text"
                      value={hol.name}
                      onChange={(e) => handleUpdateHoliday(idx, 'name', e.target.value)}
                      placeholder={t('holiday_name_placeholder')}
                      className="flex-1 bg-bg-primary border border-border rounded px-2.5 py-1 text-xs font-medium text-text-primary focus:outline-none focus:border-accent"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={hol.start_date}
                        onChange={(e) => handleUpdateHoliday(idx, 'start_date', e.target.value)}
                        className="bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                      />
                      <span className="text-text-muted text-xs">—</span>
                      <input
                        type="date"
                        value={hol.end_date}
                        onChange={(e) => handleUpdateHoliday(idx, 'end_date', e.target.value)}
                        className="bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(idx)}
                        className="p-1 text-text-muted hover:text-danger rounded hover:bg-danger/10 transition cursor-pointer"
                        title={t('delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {holidays.length > 0 && (
          <div className="p-3 bg-bg-secondary border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => setHolidays([])}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
            >
              {t('back')}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs border border-border text-text-primary rounded-lg hover:bg-bg-tertiary cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={commitMutation.isPending}
                className="px-4 py-1.5 text-xs bg-accent text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {commitMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{t('apply_holidays')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
