import React, { useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Student, ShowToastFn } from '../types';
import { toStudentDocument, fullName } from '../utils/student';
import { parseStudentFile, downloadTemplate, summarize, type ImportRow } from '../utils/studentImport';

interface StudentImportModalProps {
  students: Student[];
  showToast: ShowToastFn;
  onClose: () => void;
}

/** Firestore bir batch'te en fazla 500 işlem kabul eder; pay bırakılır. */
const BATCH_LIMIT = 450;

const StudentImportModal: React.FC<StudentImportModalProps> = ({ students, showToast, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [unknownColumns, setUnknownColumns] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsParsing(true);
    setFileName(file.name);
    try {
      const result = await parseStudentFile(file, students);
      setRows(result.rows);
      setUnknownColumns(result.unknownColumns);
      if (result.rows.length === 0) showToast("Dosyada talebe satırı bulunamadı.", "error");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Dosya okunamadı.", "error");
      setRows(null);
      setFileName('');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!rows) return;
    const { validRows } = summarize(rows);
    if (validRows.length === 0) {
      showToast("Eklenebilecek geçerli satır yok.", "error");
      return;
    }

    setIsSaving(true);
    try {
      // 450'lik parçalara böl: her parça kendi içinde atomik yazılır
      for (let i = 0; i < validRows.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        validRows.slice(i, i + BATCH_LIMIT).forEach(row => {
          batch.set(doc(collection(db, "students")), {
            ...toStudentDocument(row.student),
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      showToast(`${validRows.length} talebe eklendi.`, "success");
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Toplu ekleme başarısız.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const stats = rows ? summarize(rows) : null;

  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-surface w-full md:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-6 border-t sm:border border-line shadow-2xl relative animate-slide-up">
        <h2 className="text-xl font-bold text-primary-700 mb-1">Excel'den Toplu Ekle</h2>
        <p className="text-xs text-muted mb-5">.xlsx, .xls veya .csv dosyası yükleyin.</p>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
          <button
            onClick={() => downloadTemplate().catch(() => showToast("Şablon indirilemedi.", "error"))}
            className="w-full p-4 bg-surface-soft rounded-2xl border border-line flex items-center gap-3 hover:border-primary-600 transition-colors text-left"
          >
            <i className="fa-solid fa-file-arrow-down text-accent-700 text-lg"></i>
            <div>
              <div className="font-bold text-ink text-sm">Şablonu İndir</div>
              <div className="text-xs text-muted">Doğru sütun başlıklarını içeren boş dosya</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="w-full p-4 bg-surface-soft rounded-2xl border border-dashed border-primary-700 flex items-center gap-3 hover:border-primary-500 transition-colors text-left disabled:opacity-50"
          >
            <i className={`text-lg text-primary-700 fa-solid ${isParsing ? 'fa-circle-notch fa-spin' : 'fa-file-excel'}`}></i>
            <div className="min-w-0">
              <div className="font-bold text-ink text-sm">{isParsing ? 'Okunuyor...' : 'Dosya Seç'}</div>
              <div className="text-xs text-muted truncate">{fileName || 'Henüz dosya seçilmedi'}</div>
            </div>
          </button>

          {unknownColumns.length > 0 && (
            <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 text-xs text-accent-300">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              Tanınmayan sütunlar yok sayıldı: {unknownColumns.join(', ')}
            </div>
          )}

          {stats && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-primary-50 border border-primary-200 text-center">
                  <div className="text-2xl font-extrabold text-primary-700">{stats.valid}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Eklenecek</div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${stats.invalid > 0 ? 'bg-rose-50 border-rose-200' : 'bg-surface-soft border-line'}`}>
                  <div className={`text-2xl font-extrabold ${stats.invalid > 0 ? 'text-rose-300' : 'text-muted'}`}>{stats.invalid}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Hatalı</div>
                </div>
              </div>

              <ul className="space-y-1.5">
                {rows?.map(row => {
                  const messages = Object.values(row.errors);
                  const ok = messages.length === 0;
                  return (
                    <li key={row.rowNumber} className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${ok ? 'bg-surface-soft border-line' : 'bg-rose-500/5 border-rose-200'}`}>
                      <span className="text-muted font-mono flex-shrink-0">{row.rowNumber}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`font-bold truncate ${ok ? 'text-ink' : 'text-rose-300'}`}>
                          {fullName(row.student) || '(isimsiz satır)'}
                        </div>
                        {!ok && <div className="text-rose-600 mt-0.5">{messages.join(' · ')}</div>}
                      </div>
                      <i className={`fa-solid flex-shrink-0 mt-0.5 ${ok ? 'fa-check text-primary-600' : 'fa-xmark text-rose-600'}`}></i>
                    </li>
                  );
                })}
              </ul>

              {stats.invalid > 0 && (
                <p className="text-[11px] text-muted leading-relaxed">
                  Hatalı satırlar atlanır, yalnızca geçerli olanlar eklenir. Düzeltip dosyayı yeniden yükleyebilirsiniz.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={isSaving} className="flex-1 py-4 rounded-2xl bg-surface-soft text-muted font-bold disabled:opacity-50">
            Vazgeç
          </button>
          <button
            onClick={handleImport}
            disabled={isSaving || !stats || stats.valid === 0}
            className="flex-1 py-4 rounded-2xl bg-primary-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Ekleniyor...</>
              : `Ekle${stats?.valid ? ` (${stats.valid})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentImportModal;
