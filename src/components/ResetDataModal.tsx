import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Student, AttendanceRecord, ShowToastFn } from '../types';

interface ResetDataModalProps {
  students: Student[];
  records: AttendanceRecord[];
  showToast: ShowToastFn;
  onClose: () => void;
}

/** Firestore bir batch'te en fazla 500 işlem kabul eder; pay bırakılır. */
const BATCH_LIMIT = 450;

/** Yanlışlıkla basılmasın diye kullanıcının yazması istenen onay metni. */
const ONAY_METNI = 'SIFIRLA';

/**
 * Tüm talebeleri ve yoklama kayıtlarını arşivleyerek uygulamayı boş hale
 * getirir. Uygulamanın genelinde olduğu gibi kayıtlar yok edilmez, `isDeleted`
 * bayrağı konur; dinleyiciler bunları elediği için sonuç görsel olarak sıfırlama
 * ile aynıdır ama geri alınabilir (bkz. scripts/silinenleri-geri-al.mjs).
 */
const ResetDataModal: React.FC<ResetDataModalProps> = ({ students, records, showToast, onClose }) => {
  const [typed, setTyped] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [progress, setProgress] = useState(0);

  const total = students.length + records.length;

  // Onay metnini harf büyüklüğünden ve Türkçe i/ı ayrımından bağımsız karşılaştır:
  // "SIFIRLA" küçük harfe çevrilince "sıfırla" olur, kullanıcı ise klavyesinde
  // Türkçe karakter yoksa "sifirla" yazar. İkisi de kabul edilmeli.
  const sadelestir = (value: string) =>
    value.trim().toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[^a-z]/g, '');
  const confirmed = sadelestir(typed) === sadelestir(ONAY_METNI);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResetting) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, isResetting]);

  const handleReset = async () => {
    if (!confirmed || total === 0) return;

    setIsResetting(true);
    setProgress(0);
    let done = 0;

    try {
      const targets: { collection: string; ids: string[] }[] = [
        { collection: 'students', ids: students.map(s => s.id) },
        { collection: 'attendance', ids: records.map(r => r.id) },
      ];

      for (const target of targets) {
        for (let i = 0; i < target.ids.length; i += BATCH_LIMIT) {
          const chunk = target.ids.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach(id => batch.update(doc(db, target.collection, id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
          }));
          await batch.commit();
          done += chunk.length;
          setProgress(done);
        }
      }

      showToast(`${students.length} talebe ve ${records.length} kayıt arşivlendi.`, "success");
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Sıfırlama tamamlanamadı. Kalan kayıtlar yerinde duruyor.", "error");
      setIsResetting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-ink/50 backdrop-blur-sm p-6" role="alertdialog" aria-modal="true" aria-label="Tüm verileri sıfırla">
      <div className="bg-surface w-full md:max-w-sm rounded-3xl p-6 border border-rose-200 shadow-2xl animate-slide-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-rose-50 border border-rose-200 text-rose-600">
          <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
        </div>

        <h2 className="text-lg font-bold text-ink text-center mb-2">Tüm Verileri Sıfırla</h2>

        {total === 0 ? (
          <p className="text-sm text-muted text-center leading-relaxed">
            Silinecek veri yok; uygulama zaten boş.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted text-center leading-relaxed">
              <span className="font-bold text-ink">{students.length} talebe</span> ve{' '}
              <span className="font-bold text-ink">{records.length} yoklama kaydı</span> arşivlenecek.
              Uygulama hiç veri girilmemiş gibi görünecek.
            </p>

            <p className="text-[11px] text-muted text-center mt-3 leading-relaxed bg-surface-soft border border-line rounded-xl p-3">
              Kayıtlar yok edilmez, arşivlenir. Yanlışlıkla yaptıysanız geri alınabilir —
              <span className="font-bold"> scripts/silinenleri-geri-al.mjs</span>
            </p>

            <label htmlFor="reset-onay" className="block text-xs font-bold text-muted mt-5 mb-2">
              Onaylamak için <span className="text-rose-600 font-extrabold">{ONAY_METNI}</span> yazın
            </label>
            <input
              id="reset-onay"
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              disabled={isResetting}
              autoComplete="off"
              className="w-full p-3.5 bg-surface-soft rounded-xl border border-line text-ink outline-none focus:border-rose-500 font-bold tracking-widest text-center"
            />

            {isResetting && (
              <p className="text-xs text-muted text-center mt-3">
                {progress} / {total} kayıt işlendi
              </p>
            )}
          </>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="flex-1 py-3.5 rounded-2xl bg-surface-soft text-muted font-bold active:scale-95 transition-all disabled:opacity-50"
          >
            {total === 0 ? 'Kapat' : 'Vazgeç'}
          </button>
          {total > 0 && (
            <button
              onClick={handleReset}
              disabled={!confirmed || isResetting}
              className="flex-1 py-3.5 rounded-2xl bg-rose-600 text-white font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isResetting
                ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Siliniyor...</>
                : 'Sıfırla'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetDataModal;
