import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { EditablePreview } from './EditablePreview';
import { useAiParse, useBulkCommitByName } from '../../hooks/useSchedule';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AiParsedDay } from '../../types';

interface AiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen modal for AI-powered schedule import.
 * Flow: Upload image → AI parses → User reviews/edits → Commit to database.
 */
export function AiImportModal({ isOpen, onClose }: AiImportModalProps) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<AiParsedDay[]>([]);
  /* Week type selector: numerator, denominator, or both */
  const [weekType, setWeekType] = useState<string>('numerator');
  
  const parseMutation = useAiParse();
  /* Use bulk-commit-by-name to auto-create subjects from AI-parsed names */
  const commitMutation = useBulkCommitByName();

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

  /* Commit the reviewed schedule to the database using subject names */
  const handleCommit = () => {
    /* Transform parsed data into bulk-commit-by-name format */
    const rules = parsedData.flatMap(day =>
      day.lessons.map(lesson => ({
        subject_name: lesson.subject_name,
        day_of_week: day.day_of_week,
        lesson_order: lesson.order,
        start_time: lesson.start_time || '08:30',
        end_time: lesson.end_time || '09:15',
        cabinet: lesson.cabinet || null,
      }))
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
    setParsedData([]);
    parseMutation.reset();
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
            /* Step 1: File upload */
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-10">
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
                className="mt-6 w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {parseMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                {parseMutation.isPending ? t('parsing_image') : t('parse_schedule_btn')}
              </button>
            </div>
          ) : (
            <>
              {/* Step 2: Side-by-side review */}
              {/* Left side: Image Preview */}
              <div className="w-full md:w-1/3 flex flex-col gap-3 shrink-0">
                <h3 className="font-medium text-text-primary text-sm">{t('source_image')}</h3>
                <div className="bg-bg-tertiary rounded-lg border border-border overflow-hidden h-48 md:h-[480px] flex items-center justify-center p-2">
                  {previewUrl && (
                    <img src={previewUrl} alt="Schedule source" className="max-w-full max-h-full object-contain rounded" />
                  )}
                </div>
              </div>
              
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
                  <EditablePreview data={parsedData} onChange={setParsedData} />
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
