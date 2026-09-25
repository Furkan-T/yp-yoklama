import React, { useEffect } from 'react';
import type { Student } from '../types';
import { MAX_SUPERVISORS } from '../constants';
import { STUDENT_FIELDS, SUPERVISOR_LABELS, type StudentFieldDef } from '../utils/student';

interface StudentFormModalProps {
  mode: 'add' | 'edit';
  value: Partial<Student>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  onChange: (value: Partial<Student>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Talebe ekleme ve düzenleme aynı alanları kullandığı için tek bir kontrollü
 * form bileşeni üzerinden yürür; sadece başlık, buton metni ve vurgu rengi değişir.
 * Alanların kendisi STUDENT_FIELDS listesinden üretilir.
 */
const StudentFormModal: React.FC<StudentFormModalProps> = ({
  mode, value, errors, isSubmitting, onChange, onSubmit, onCancel,
}) => {
  const isEdit = mode === 'edit';
  const accent = isEdit
    ? { text: 'text-accent-700', button: 'bg-accent-500 text-ink', chip: 'bg-accent-500 text-ink border-accent-400', hover: 'hover:border-accent-700' }
    : { text: 'text-primary-700', button: 'bg-primary-500 text-white', chip: 'bg-primary-500 text-white border-primary-400', hover: 'hover:border-primary-600' };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const inputClass = (key: string) =>
    `w-full p-4 bg-surface-soft rounded-2xl border text-ink placeholder-muted outline-none focus:border-primary-500 ${errors[key] ? 'border-rose-500' : 'border-line'}`;

  const setSupervisor = (index: number, name: string) => {
    const next = [...(value.supervisors || [])];
    next[index] = name;
    onChange({ ...value, supervisors: next });
  };

  const renderField = (field: StudentFieldDef) => {
    const key = field.key as string;
    const current = (value[field.key] as string) || '';
    const label = field.label + (field.required ? ' *' : '');

    if (field.kind === 'select') {
      return (
        <div key={key}>
          <select
            aria-label={field.label}
            value={current}
            onChange={e => onChange({ ...value, [field.key]: e.target.value })}
            className={`${inputClass(key)} ${current ? '' : 'text-muted'}`}
          >
            <option value="">{field.label}</option>
            {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          {errors[key] && <p className="text-rose-600 text-xs mt-1 ml-2">{errors[key]}</p>}
        </div>
      );
    }

    return (
      <div key={key}>
        <input
          type={field.kind === 'tel' ? 'tel' : 'text'}
          aria-label={field.label}
          placeholder={label}
          value={current}
          onChange={e => onChange({ ...value, [field.key]: e.target.value })}
          className={inputClass(key)}
        />
        {errors[key]
          ? <p className="text-rose-600 text-xs mt-1 ml-2">{errors[key]}</p>
          : field.hint && <p className="text-muted text-[10px] mt-1 ml-2 leading-snug">{field.hint}</p>}
      </div>
    );
  };

  // Yan yana konabilecek ardışık alanları ikişerli grupla
  const groupedFields: StudentFieldDef[][] = [];
  STUDENT_FIELDS.forEach(field => {
    const last = groupedFields[groupedFields.length - 1];
    if (field.half && last?.length === 1 && last[0].half) last.push(field);
    else groupedFields.push([field]);
  });

  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-surface w-full md:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-6 border-t sm:border border-line shadow-2xl relative animate-slide-up">
        <h2 className={`text-xl font-bold mb-6 ${accent.text}`}>{isEdit ? 'Talebeyi Düzenle' : 'Yeni Talebe'}</h2>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {groupedFields.map((group, i) => (
            group.length === 2
              ? <div key={i} className="grid grid-cols-2 gap-3">{group.map(renderField)}</div>
              : renderField(group[0])
          ))}

          {/* GRUP MESULLERİ — en fazla iki kişi */}
          <div className="p-4 bg-surface-soft rounded-2xl border border-line space-y-3">
            <div className="text-xs font-bold text-muted uppercase tracking-wider">
              Grup Mesulü <span className="normal-case tracking-normal text-muted">(en fazla {MAX_SUPERVISORS})</span>
            </div>
            {SUPERVISOR_LABELS.map((label, index) => (
              <input
                key={label}
                type="text"
                aria-label={label}
                placeholder={label}
                value={value.supervisors?.[index] || ''}
                onChange={e => setSupervisor(index, e.target.value)}
                className="w-full p-3.5 bg-surface rounded-xl border border-line text-ink placeholder-muted outline-none focus:border-primary-500"
              />
            ))}
          </div>

          {/* AKTİFLİK */}
          <button
            type="button"
            aria-pressed={value.isActive !== false}
            onClick={() => onChange({ ...value, isActive: value.isActive === false })}
            className="w-full flex items-center gap-3 p-4 bg-surface-soft rounded-2xl border border-line text-left"
          >
            <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${value.isActive !== false ? 'bg-primary-500 border-primary-500 text-white' : 'bg-transparent border-line'}`}>
              {value.isActive !== false && <i className="fa-solid fa-check text-xs"></i>}
            </div>
            <div className="flex-1">
              <div className="font-bold text-ink text-sm">Aktif Talebe</div>
              <div className="text-xs text-muted">Pasife alınırsa yoklama listelerinde görünmez.</div>
            </div>
          </button>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 py-4 rounded-2xl bg-surface-soft text-muted font-bold disabled:opacity-50">
            Vazgeç
          </button>
          <button onClick={onSubmit} disabled={isSubmitting} className={`flex-1 py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${accent.button}`}>
            {isSubmitting
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> {isEdit ? 'Güncelleniyor...' : 'Kaydediliyor...'}</>
              : (isEdit ? 'Güncelle' : 'Kaydet')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentFormModal;
