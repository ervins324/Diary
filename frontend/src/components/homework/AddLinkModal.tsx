import { useState } from 'react';
import { X, Check, Link as LinkIcon, Presentation, FileText } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Attachment } from '../../types';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (attachment: Attachment) => void;
}

export function AddLinkModal({ isOpen, onClose, onAdd }: AddLinkModalProps) {
  const { language } = useLanguage();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'presentation' | 'pdf' | 'link'>('presentation');

  if (!isOpen) return null;

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    const lower = newUrl.toLowerCase();
    // Auto-detect presentation or pdf from URL pattern
    if (
      lower.includes('docs.google.com/presentation') ||
      lower.includes('canva.com/design') ||
      lower.includes('slideshare') ||
      lower.includes('prezi.com') ||
      lower.includes('.pptx') ||
      lower.includes('.ppt')
    ) {
      setType('presentation');
    } else if (lower.endsWith('.pdf') || lower.includes('.pdf?')) {
      setType('pdf');
    }
  };

  const handleSave = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    let finalName = name.trim();
    if (!finalName) {
      if (type === 'presentation') {
        finalName = language === 'uk' ? 'Презентація' : 'Presentation';
      } else if (type === 'pdf') {
        finalName = language === 'uk' ? 'PDF Документ' : 'PDF Document';
      } else {
        try {
          const parsed = new URL(trimmedUrl);
          finalName = parsed.hostname;
        } catch {
          finalName = language === 'uk' ? 'Посилання' : 'Link';
        }
      }
    }

    onAdd({
      name: finalName,
      type,
      url: trimmedUrl,
    });

    setUrl('');
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-bg-primary border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <LinkIcon size={16} />
            </div>
            <h3 className="font-bold text-text-primary text-sm">
              {language === 'uk' ? 'Додати посилання (Презентація / PDF)' : 'Add Link (Presentation / PDF)'}
            </h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setType('presentation')}
            className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
              type === 'presentation'
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            <Presentation size={18} className="text-amber-500" />
            <span>{language === 'uk' ? 'Презентація' : 'Presentation'}</span>
          </button>

          <button
            type="button"
            onClick={() => setType('pdf')}
            className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
              type === 'pdf'
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            <FileText size={18} className="text-red-500" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setType('link')}
            className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
              type === 'link'
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-bg-secondary border-border text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            <LinkIcon size={18} className="text-sky-500" />
            <span>{language === 'uk' ? 'Посилання' : 'Web Link'}</span>
          </button>
        </div>

        {/* URL Input */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            URL ({language === 'uk' ? 'Google Презентації, Canva, посилання на PDF...' : 'Google Slides, Canva, PDF URL...'})
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://docs.google.com/presentation/..."
            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            autoFocus
          />
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            {language === 'uk' ? 'Назва / Підпис (необовʼязково)' : 'Title / Label (optional)'}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={language === 'uk' ? 'Наприклад: Слайди до теми 4' : 'e.g. Chapter 4 Slides'}
            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-muted hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            {language === 'uk' ? 'Скасувати' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!url.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50"
          >
            <Check size={14} />
            <span>{language === 'uk' ? 'Додати' : 'Add Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
