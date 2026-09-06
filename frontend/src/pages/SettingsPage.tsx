import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Check, X, Loader2, Globe } from 'lucide-react';
import { fetchSubjects, createSubject, updateSubject, deleteSubject } from '../api/client';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Subject } from '../types';

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const createMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subject> }) => updateSubject(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Subject>>({});
  
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<Partial<Subject>>({
    name: '', short_name: '', color_hex: '#6366F1', default_cabinet: ''
  });

  const handleEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setEditForm({ ...subject });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.name) {
      updateMutation.mutate({ id: editingId, data: editForm });
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('delete_subject_confirm'))) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    if (addForm.name) {
      createMutation.mutate(addForm, {
        onSuccess: () => {
          setIsAdding(false);
          setAddForm({ name: '', short_name: '', color_hex: '#6366F1', default_cabinet: '' });
        }
      });
    }
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-8">{t('settings')}</h1>

      <div className="space-y-8">
        {/* Appearance & Language */}
        <section className="bg-bg-secondary p-5 rounded-xl border border-border space-y-4">
          <h2 className="text-lg font-semibold text-text-primary border-b border-border-light pb-2">{t('appearance')}</h2>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">{t('theme')}</p>
              <p className="text-sm text-text-muted">{t('theme_desc')}</p>
            </div>
            <div className="bg-bg-tertiary rounded-lg">
              <ThemeToggle />
            </div>
          </div>

          <div className="pt-3 border-t border-border-light flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary flex items-center gap-1.5">
                <Globe size={16} className="text-accent" />
                <span>{t('language')}</span>
              </p>
              <p className="text-sm text-text-muted">{t('language_desc')}</p>
            </div>
            <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border">
              <button
                onClick={() => setLanguage('uk')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  language === 'uk'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Українська
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </section>

        {/* Subjects */}
        <section className="bg-bg-secondary p-5 rounded-xl border border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-4 border-b border-border-light pb-2">{t('manage_subjects')}</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-accent" size={24} />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-text-secondary px-2 pb-1 hidden sm:grid">
                <div className="col-span-1">{t('color')}</div>
                <div className="col-span-4">{t('name')}</div>
                <div className="col-span-3">{t('short_name')}</div>
                <div className="col-span-2">{t('cabinet')}</div>
                <div className="col-span-2 text-right">{t('actions')}</div>
              </div>

              {/* List */}
              {subjects?.map((subject) => (
                <div key={subject.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-bg-primary p-2 rounded border border-border-light text-sm">
                  {editingId === subject.id ? (
                    <>
                      <div className="col-span-1 sm:col-span-1 flex justify-center">
                        <input 
                          type="color" 
                          value={editForm.color_hex || '#000'} 
                          onChange={e => setEditForm({...editForm, color_hex: e.target.value})}
                          className="w-6 h-6 rounded cursor-pointer"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-4">
                        <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('subject_name_placeholder')} />
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <input type="text" value={editForm.short_name || ''} onChange={e => setEditForm({...editForm, short_name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('short_name_placeholder')} />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <input type="text" value={editForm.default_cabinet || ''} onChange={e => setEditForm({...editForm, default_cabinet: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('cabinet_placeholder')} />
                      </div>
                      <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
                        <button onClick={handleSaveEdit} className="text-success hover:bg-success/10 p-1 rounded"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="text-text-muted hover:bg-bg-tertiary p-1 rounded"><X size={16} /></button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-1 sm:col-span-1 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full sm:mx-auto" style={{ backgroundColor: subject.color_hex }} />
                        <span className="sm:hidden font-medium text-text-primary">{subject.name}</span>
                      </div>
                      <div className="col-span-1 sm:col-span-4 hidden sm:block truncate text-text-primary font-medium">{subject.name}</div>
                      <div className="col-span-1 sm:col-span-3 text-text-secondary truncate"><span className="sm:hidden text-xs mr-2">{t('short_name')}:</span>{subject.short_name}</div>
                      <div className="col-span-1 sm:col-span-2 text-text-secondary truncate"><span className="sm:hidden text-xs mr-2">{t('cabinet')}:</span>{subject.default_cabinet || '-'}</div>
                      <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 mt-2 sm:mt-0">
                        <button onClick={() => handleEdit(subject)} className="text-text-muted hover:text-accent p-1"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(subject.id)} className="text-text-muted hover:text-danger p-1"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add New */}
              {isAdding ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-accent-light/50 p-2 rounded border border-accent border-dashed text-sm mt-4">
                  <div className="col-span-1 flex justify-center">
                    <input type="color" value={addForm.color_hex} onChange={e => setAddForm({...addForm, color_hex: e.target.value})} className="w-6 h-6 rounded cursor-pointer" />
                  </div>
                  <div className="col-span-1 sm:col-span-4">
                    <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('subject_name_placeholder')} autoFocus />
                  </div>
                  <div className="col-span-1 sm:col-span-3">
                    <input type="text" value={addForm.short_name} onChange={e => setAddForm({...addForm, short_name: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('short_name_placeholder')} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <input type="text" value={addForm.default_cabinet ?? ''} onChange={e => setAddForm({...addForm, default_cabinet: e.target.value})} className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent" placeholder={t('cabinet_placeholder')} />
                  </div>
                  <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
                    <button onClick={handleAdd} className="text-accent hover:bg-accent/10 p-1 rounded font-medium text-xs px-2">{t('save')}</button>
                    <button onClick={() => setIsAdding(false)} className="text-text-muted hover:bg-bg-tertiary p-1 rounded"><X size={16} /></button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="mt-4 w-full py-2 border-2 border-dashed border-border hover:border-accent hover:text-accent text-text-secondary rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                >
                  <Plus size={16} /> {t('add_subject')}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
