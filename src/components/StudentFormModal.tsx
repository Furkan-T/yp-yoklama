import React, { useEffect } from 'react';
import type { Student } from '../types';
import { ETUT_SESSIONS } from '../constants';

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
 */
const StudentFormModal: React.FC<StudentFormModalProps> = ({
  mode, value, errors, isSubmitting, onChange, onSubmit, onCancel,
}) => {
  const isEdit = mode === 'edit';
  const accent = isEdit
    ? { text: 'text-accent-400', button: 'bg-accent-500 text-dark-950', chip: 'bg-accent-500 text-dark-950 border-accent-400', hover: 'hover:border-accent-700' }
    : { text: 'text-primary-200', button: 'bg-primary-500 text-white', chip: 'bg-primary-500 text-white border-primary-400', hover: 'hover:border-primary-600' };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const field = (key: keyof Student, placeholder: string, type = 'text') => (
    <div>
      <input
        type={type}
        aria-label={placeholder}
        placeholder={placeholder}
        value={(value[key] as string) || ''}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
        className={`w-full p-4 bg-dark-800 rounded-2xl border text-white placeholder-dark-400 outline-none focus:border-primary-500 ${errors[key] ? 'border-rose-500' : 'border-dark-700'}`}
      />
      {errors[key] && <p className="text-rose-400 text-xs mt-1 ml-2">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-dark-900 w-full md:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-6 border-t sm:border border-primary-900/40 shadow-2xl relative animate-slide-up">
        <h2 className={`text-xl font-bold mb-6 ${accent.text}`}>{isEdit ? 'Talebeyi Düzenle' : 'Yeni Talebe'}</h2>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {field('name', 'Adı Soyadı *')}

          <div className="grid grid-cols-2 gap-3">
            {field('tcNo', 'TC Kimlik No')}
            {field('schoolNumber', 'Okul No')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('grade', 'Sınıfı (Örn: 9/A)')}
            {field('school', 'Okulu')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('parentName', 'Veli Adı Soyadı')}
            {field('parentPhone', 'Veli Tel (5XX)', 'tel')}
          </div>

          {/* ETÜT GRUBU */}
          <div className="p-4 bg-dark-800 rounded-2xl border border-dark-700">
            <div className="text-xs font-bold text-dark-300 mb-3 uppercase tracking-wider">Etüt Grubu</div>
            <div className="grid grid-cols-5 gap-2">
              {ETUT_SESSIONS.map(session => (
                <button
                  key={session}
                  type="button"
                  aria-pressed={value.etut === session}
                  onClick={() => onChange({ ...value, etut: value.etut === session ? '' : session })}
                  className={`py-2.5 rounded-xl text-xs font-extrabold transition-all border ${
                    value.etut === session
                      ? `${accent.chip} shadow-md`
                      : `bg-dark-900 text-dark-300 border-dark-700 ${accent.hover}`
                  }`}
                >
                  {session.replace('Etüt ', '')}
                </button>
              ))}
            </div>
            {!value.etut && <p className="text-dark-400 text-xs mt-2">Seçilmezse tüm etütlerde görünür.</p>}
          </div>

          {/* AKTİFLİK */}
          <button
            type="button"
            aria-pressed={value.isActive !== false}
            onClick={() => onChange({ ...value, isActive: value.isActive === false })}
            className="w-full flex items-center gap-3 p-4 bg-dark-800 rounded-2xl border border-dark-700 text-left"
          >
            <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${value.isActive !== false ? 'bg-primary-500 border-primary-500 text-white' : 'bg-transparent border-dark-500'}`}>
              {value.isActive !== false && <i className="fa-solid fa-check text-xs"></i>}
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Aktif Talebe</div>
              <div className="text-xs text-dark-400">Pasife alınırsa yoklama listelerinde görünmez.</div>
            </div>
          </button>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 py-4 rounded-2xl bg-dark-800 text-dark-300 font-bold disabled:opacity-50">
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
