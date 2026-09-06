import { useState, useEffect } from 'react';
import { X, Loader2, Image, FileText, Copy, Check, UploadCloud } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { EditablePreview } from './EditablePreview';
import { useAiParse, useParseScheduleJson, useBulkCommitByName } from '../../hooks/useSchedule';
import { useBells } from '../../hooks/useBells';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AiParsedDay } from '../../types';

interface AiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AI_SCHEDULE_PROMPT = `Витягни шкільний розклад уроків з цього зображення у форматі JSON за такою схемою:
{
  "days": [
    {
      "day_of_week": 1,
      "day_name": "Понеділок",
      "lessons": [
        {
          "order": 1,
          "subject_name": "Укр мова",
          "start_time": "08:30",
          "end_time": "09:15",
          "cabinet": "101"
        }
      ]
    }
  ]
}

Вимоги:
1. day_of_week: 1 (Пн), 2 (Вт), 3 (Ср), 4 (Чт), 5 (Пт), 6 (Сб).
2. Якщо точний час уроку відсутній або невідомий, обов'язково встанови start_time і end_time як null (додаток автоматично візьме твій розклад дзвінків).
3. Скорочуй довгі назви предметів (Укр мова, Укр літ, Англ мова, Фізра, Зар літ, Іст України, Інформ, Матем, Геом, Алг, Біол, Хім, Фіз, Геогр).
4. Надай виключно чистий валідний JSON без зайвих слів.`;

/**
 * Full-screen modal for AI-powered schedule import.
 * Flow: Upload image or paste JSON → AI / JSON parses → User reviews/edits → Commit to database.
 */
export function AiImportModal({ isOpen, onClose }: AiImportModalProps) {
  const { t } = useLanguage();
  /* Active tab mode: 'photo' (via Gemini API) or 'json' (from external AI, no API key required) */
  const [importMode, setImportMode] = useState<'photo' | 'json'>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState<string>('');
  const [rawJsonPreview, setRawJsonPreview] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<AiParsedDay[]>([]);
  /* Week type selector: numerator, denominator, or both */
  const [weekType, setWeekType] = useState<string>('numerator');
  
  const parseMutation = useAiParse();
  const jsonParseMutation = useParseScheduleJson();
  /* Use bulk-commit-by-name to auto-create subjects from AI-parsed names */
  const commitMutation = useBulkCommitByName();
  /* Fetch imported bell schedule for smart time fallbacks */
  const { data: bellSlots } = useBells();

  /* Create object URL for image preview */
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  if (!isOpen) return null;

  /* Send image to AI for parsing */
  const handleParse = () => {
    if (!file) return;
    parseMutation.mutate(file, {
      onSuccess: (response) => {
        /* API returns { days: [...] } */
        setParsedData(response.days);
      }
    });
  };

  /* Parse raw JSON submitted from external AI */
  const handleParseJson = () => {
    if (!jsonInput.trim()) return;
    jsonParseMutation.mutate(jsonInput, {
      onSuccess: (response) => {
        setParsedData(response.days);
        setRawJsonPreview(jsonInput.trim());
      }
    });
  };

  /* Copy template prompt for external AI */
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_SCHEDULE_PROMPT);
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

  /* Commit the reviewed schedule to the database using subject names */
  const handleCommit = () => {
    /* Transform parsed data into bulk-commit-by-name format */
    const rules = parsedData.flatMap(day =>
      day.lessons.map(lesson => {
        /* Use imported bell schedule times as fallback, then hardcoded defaults */
        const bellSlot = bellSlots?.find(b => b.lesson_order === lesson.order);
        const fallbackStart = bellSlot ? bellSlot.start_time.substring(0, 5) : '08:30';
        const fallbackEnd = bellSlot ? bellSlot.end_time.substring(0, 5) : '09:15';

        return {
          subject_name: lesson.subject_name,
          day_of_week: day.day_of_week,
          lesson_order: lesson.order,
          start_time: lesson.start_time || fallbackStart,
          end_time: lesson.end_time || fallbackEnd,
          cabinet: lesson.cabinet || null,
        };
      })
    );

    /* If "both" is selected, commit for both numerator and denominator */
    const weekTypes = weekType === 'both' ? ['numerator', 'denominator'] : [weekType];

    const commitAll = async () => {
      for (const wt of weekTypes) {
        await commitMutation.mutateAsync({ week_type: wt, rules });
      }
      handleClose();
    };

    commitAll();
  };

  /* Reset all state and close modal */
  const handleClose = () => {
    setFile(null);
    setPreviewUrl(null);
    setJsonInput('');
    setRawJsonPreview('');
    setParsedData([]);
    parseMutation.reset();
    jsonParseMutation.reset();
    commitMutation.reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div className="bg-bg-secondary w-full max-w-5xl rounded-xl shadow-2xl border border-border flex flex-col h-[92vh] max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
          <h2 className="text-xl font-semibold text-text-primary">{t('import_schedule_ai')}</h2>
          <button onClick={handleClose} className="p-2 rounded-lg text-text-muted hover:bg-bg-tertiary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 flex flex-col md:flex-row gap-6">
          {parsedData.length === 0 ? (
            /* Step 1: File upload or JSON input */
            <div className="flex-1 flex flex-col items-center justify-start max-w-2xl mx-auto w-full py-2 md:py-4">
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
                /* Mode A: Photo / Image upload */
                <div className="w-full flex flex-col items-center">
                  <FileDropzone onFileSelect={setFile} selectedFile={file} />
                  {parseMutation.isError && (
                    <div className="mt-4 p-3.5 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm w-full max-w-lg text-left">
                      <p className="font-semibold flex items-center gap-1.5">
                        <span>⚠️</span> {t('parsing_failed')}
                      </p>
                      <p className="text-xs mt-1 text-danger/90 break-words">
                        {(parseMutation.error as any)?.response?.data?.detail || parseMutation.error.message || t('unknown_error')}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleParse}
                    disabled={!file || parseMutation.isPending}
                    className="mt-6 w-full max-w-lg py-2.5 px-4 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {parseMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                    {parseMutation.isPending ? t('parsing_image') : t('parse_schedule_btn')}
                  </button>
                </div>
              ) : (
                /* Mode B: Direct JSON input from external AI */
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
                      htmlFor="json-file-input"
                      className="cursor-pointer text-xs text-accent hover:underline flex items-center gap-1.5"
                    >
                      <UploadCloud size={14} />
                      <span>{t('upload_json_file')}</span>
                      <input
                        id="json-file-input"
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
                      <p className="text-xs mt-1 text-danger/90 break-words">
                        {(jsonParseMutation.error as any)?.response?.data?.detail || jsonParseMutation.error.message || t('invalid_json_error')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Step 2: Side-by-side review */}
              {previewUrl ? (
                /* Left side: Image Preview */
                <div className="w-full md:w-1/3 flex flex-col gap-3 shrink-0">
                  <h3 className="font-medium text-text-primary text-sm">{t('source_image')}</h3>
                  <div className="bg-bg-tertiary rounded-lg border border-border overflow-hidden h-48 md:h-[480px] flex items-center justify-center p-2">
                    <img src={previewUrl} alt="Schedule source" className="max-w-full max-h-full object-contain rounded" />
                  </div>
                </div>
              ) : (
                /* Left side: Source JSON Preview */
                <div className="w-full md:w-1/3 flex flex-col gap-3 shrink-0">
                  <h3 className="font-medium text-text-primary text-sm">{t('source_json')}</h3>
                  <div className="bg-bg-tertiary rounded-lg border border-border overflow-hidden h-48 md:h-[480px] p-3 flex flex-col">
                    <pre className="text-xs font-mono text-text-secondary overflow-auto flex-1 whitespace-pre-wrap select-all">
                      {rawJsonPreview || JSON.stringify(parsedData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Right side: Editable Data */}
              <div className="w-full md:w-2/3 flex flex-col gap-3 min-h-0 flex-1">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="font-medium text-text-primary text-sm">{t('review_and_edit')}</h3>
                  {/* Week type selector */}
                  <select 
                    value={weekType}
                    onChange={(e) => setWeekType(e.target.value)}
                    className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="numerator">{t('numerator_week')}</option>
                    <option value="denominator">{t('denominator_week')}</option>
                    <option value="both">{t('both_weeks')}</option>
                  </select>
                </div>
                
                <div className="flex-1 border border-border rounded-lg overflow-hidden bg-bg-primary min-h-0 flex flex-col">
                  <EditablePreview data={parsedData} onChange={setParsedData} bellSlots={bellSlots} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — only shown after parsing */}
        {parsedData.length > 0 && (
          <div className="p-4 border-t border-border flex justify-end gap-3 bg-bg-tertiary/50 shrink-0">
            <button 
              onClick={() => setParsedData([])}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('back')}
            </button>
            <button
              onClick={handleCommit}
              disabled={commitMutation.isPending}
              className="px-6 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {commitMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {t('commit_to_schedule')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

