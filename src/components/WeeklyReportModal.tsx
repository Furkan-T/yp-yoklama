import React, { useEffect, useMemo, useState } from 'react';
import type { Student, AttendanceRecord, ShowToastFn } from '../types';
import { WEEK_LENGTH, buildWeeklyReport, downloadWeeklyReport, defaultWeekStart, formatRange } from '../utils/weeklyReport';
import { NAMAZ_TIMES } from '../constants';

interface WeeklyReportModalProps {
  students: Student[];
  records: AttendanceRecord[];
  showToast: ShowToastFn;
  onClose: () => void;
}

/** Ekranda kaç talebe listelensin; tamamı Excel'de. */
const PREVIEW_LIMIT = 5;

const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ students, records, showToast, onClose }) => {
  const [weekStart, setWeekStart] = useState<Date>(() => defaultWeekStart());
  const [isDownloading, setIsDownloading] = useState(false);

  const report = useMemo(
    () => buildWeeklyReport(students, records, weekStart),
    [students, records, weekStart]
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDownloading) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, isDownloading]);

  const shiftWeek = (weeks: number) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + weeks * WEEK_LENGTH);
      return next;
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadWeeklyReport(report);
      showToast("Haftalık rapor indirildi.", "success");
    } catch (error) {
      console.error(error);
      showToast("Rapor indirilemedi.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  const top = report.rows.filter(r => r.toplam > 0).slice(0, PREVIEW_LIMIT);
  // Gelecek haftaya geçmenin anlamı yok
  const nextDisabled = report.range.end >= new Date();

  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-surface w-full md:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-6 border-t sm:border border-line shadow-2xl animate-slide-up">
        <h2 className="text-xl font-bold text-primary-700 mb-1">Haftalık Rapor</h2>
        <p className="text-xs text-muted mb-4">Cumartesiden cumaya, gelinmeyen dahili ders ve namazlar.</p>

        {/* HAFTA SEÇİMİ */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => shiftWeek(-1)}
            aria-label="Önceki hafta"
            className="w-10 h-10 rounded-xl bg-surface-soft border border-line text-ink flex items-center justify-center active:scale-95 transition-all"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div className="flex-1 text-center px-2 py-2 rounded-xl bg-surface-soft border border-line">
            <div className="text-xs font-bold text-ink">{formatRange(report.range)}</div>
          </div>
          <button
            onClick={() => shiftWeek(1)}
            disabled={nextDisabled}
            aria-label="Sonraki hafta"
            className="w-10 h-10 rounded-xl bg-surface-soft border border-line text-ink flex items-center justify-center active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div className="space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <div className="text-2xl font-extrabold text-rose-600">{report.toplamDevamsizlik}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted">Toplam Devamsızlık</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-soft border border-line text-center">
              <div className="text-2xl font-extrabold text-ink">{report.devamsizTalebeSayisi}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted">Devamsız Talebe</div>
            </div>
          </div>

          {top.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center mx-auto mb-2">
                <i className="fa-solid fa-check text-primary-600"></i>
              </div>
              <p className="text-sm text-muted font-bold">Bu hafta devamsızlık yok.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-1.5">
                {top.map(row => (
                  <li key={row.student.id} className="p-2.5 rounded-xl border border-line bg-surface-soft text-xs flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-ink truncate">{row.student.name}</div>
                      <div className="text-[10px] text-muted">
                        {row.student.group || '—'} · {row.ders} ders · {row.namazToplam} namaz
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-rose-600 flex-shrink-0">{row.toplam}</span>
                  </li>
                ))}
              </ul>
              {report.devamsizTalebeSayisi > PREVIEW_LIMIT && (
                <p className="text-[11px] text-muted text-center">
                  ve {report.devamsizTalebeSayisi - PREVIEW_LIMIT} talebe daha — tamamı Excel dosyasında
                </p>
              )}
            </>
          )}

          <p className="text-[11px] text-muted leading-relaxed bg-surface-soft border border-line rounded-xl p-3">
            Excel dosyasında iki sayfa var: <span className="font-bold">Özet</span> her talebenin
            {' '}{NAMAZ_TIMES.length} namaz vaktini ayrı ayrı ve toplamını gösterir,
            {' '}<span className="font-bold">Devamsızlık Detayı</span> hangi gün hangi vakte gelinmediğini listeler.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={isDownloading} className="flex-1 py-4 rounded-2xl bg-surface-soft text-muted font-bold disabled:opacity-50">
            Kapat
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 py-4 rounded-2xl bg-primary-600 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isDownloading
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Hazırlanıyor...</>
              : <><i className="fa-solid fa-file-arrow-down"></i> Excel İndir</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyReportModal;
