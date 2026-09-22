import React, { useState } from 'react';
import { getAuth, signOut } from "firebase/auth";
import type { AttendanceRecord, AttendanceStatus, ShowToastFn } from '../types';
import { APP_VERSION, APP_NAME, STATUS_META } from '../constants';
import { normalizeSubType } from '../utils/validation';
import { useConfirm } from '../hooks/useConfirm';

interface SettingsProps {
  userEmail: string | undefined;
  records: AttendanceRecord[];
  showToast: ShowToastFn;
}

const Settings: React.FC<SettingsProps> = ({ userEmail, records, showToast }) => {
  const [showAbout, setShowAbout] = useState(false);
  const auth = getAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleLogout = async () => {
    const ok = await confirm({ message: "Çıkış yapmak istiyor musunuz?", confirmLabel: 'Çıkış Yap', danger: false });
    if (ok) await signOut(auth);
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast("İndirilecek kayıt bulunamadı.", "error");
      return;
    }

    // Tarih (yeni -> eski), tür, vakit, isim sırasına diz
    const sorted = [...records].sort((a, b) => {
      const dateA = (a.date?.seconds || 0);
      const dateB = (b.date?.seconds || 0);
      if (dateB !== dateA) return dateB - dateA;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.subType !== b.subType) return a.subType.localeCompare(b.subType, 'tr');
      return a.studentName.localeCompare(b.studentName, 'tr');
    });

    // Excel'in Türkçe yerel ayarıyla uyumlu olması için ayraç noktalı virgül
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines: string[] = [
      escape(`${APP_NAME} - Yoklama Raporu`),
      [escape('Rapor Tarihi'), escape(new Date().toLocaleDateString('tr-TR'))].join(';'),
      [escape('Toplam Kayit'), escape(String(records.length))].join(';'),
      '',
      ['TARIH', 'GUN', 'TUR', 'VAKIT', 'TALEBE ADI', 'DURUM'].map(escape).join(';'),
    ];

    sorted.forEach(record => {
      if (!record.date) return;
      const d = new Date(record.date.seconds * 1000);
      lines.push([
        d.toLocaleDateString('tr-TR'),
        d.toLocaleDateString('tr-TR', { weekday: 'long' }),
        record.type === 'ETUT' ? 'Etut' : 'Namaz',
        normalizeSubType(record.subType),
        record.studentName,
        record.status,
      ].map(escape).join(';'));
    });

    lines.push('', escape('OZET'));
    (Object.keys(STATUS_META) as AttendanceStatus[]).forEach(status => {
      const count = records.filter(r => r.status === status).length;
      lines.push([escape(`${status} Sayisi`), escape(String(count))].join(';'));
    });

    // Başa BOM: Excel'in UTF-8 olarak açması için gerekli
    const blob = new Blob(["﻿" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Yoklama_Rapor_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Rapor indirildi!", "success");
  };

  return (
    <div className="space-y-6 animate-fade-in w-full px-4 pt-6">
      <div className="bg-dark-900/60 p-6 rounded-3xl border border-primary-900/30 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-500/15 flex items-center justify-center text-primary-300 text-2xl border border-primary-500/30 flex-shrink-0">
          <i className="fa-solid fa-user-tie"></i>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-accent-500/80 uppercase font-bold tracking-wider">Aktif Hesap</div>
          <div className="text-white font-bold text-lg break-all">{userEmail}</div>
        </div>
      </div>

      <div className="space-y-2">
        <button onClick={handleExportCSV} className="w-full bg-dark-900/40 p-5 rounded-2xl border border-dark-800 flex items-center gap-3 hover:bg-dark-800 transition-colors active:scale-95">
          <i className="fa-solid fa-file-csv text-primary-300"></i>
          <span className="text-dark-100 font-bold">Verileri Yedekle (Excel/CSV)</span>
        </button>
        <button onClick={() => setShowAbout(true)} className="w-full bg-dark-900/40 p-5 rounded-2xl border border-dark-800 flex items-center gap-3 hover:bg-dark-800 transition-colors active:scale-95">
          <i className="fa-solid fa-circle-info text-accent-400"></i>
          <span className="text-dark-100 font-bold">Uygulama Hakkında</span>
        </button>
      </div>

      <button onClick={handleLogout} className="w-full bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl flex items-center justify-center gap-3 text-rose-400 font-bold hover:bg-rose-500 hover:text-white transition-all mt-8">
        <i className="fa-solid fa-right-from-bracket"></i>Güvenli Çıkış Yap
      </button>

      <div className="text-center text-xs text-dark-500 mt-4">{APP_VERSION}</div>

      {showAbout && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" role="dialog" aria-modal="true">
          <div className="bg-dark-900 w-full md:max-w-sm rounded-3xl p-6 border border-primary-900/40 shadow-2xl relative text-center animate-slide-up">
            <button onClick={() => setShowAbout(false)} aria-label="Kapat" className="absolute top-4 right-4 text-dark-400 hover:text-white">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            <img src="/logo.png" alt="" className="w-20 h-20 mx-auto mb-4 object-contain" />
            <h2 className="text-xl font-extrabold text-primary-300">{APP_NAME}</h2>
            <p className="text-sm text-accent-500/80 mt-2 font-bold uppercase tracking-wider">Yönetici Paneli</p>
            <p className="text-xs text-dark-400 mt-4 leading-relaxed">
              Talebe yoklamalarını ve devam takibini kolaylaştırmak için geliştirilmiş yönetici panelidir.
            </p>
            <button onClick={() => setShowAbout(false)} className="w-full py-3 rounded-xl bg-primary-500 text-white font-bold mt-6">Tamam</button>
          </div>
        </div>
      )}

      {ConfirmDialog}
      <div className="h-24 w-full"></div>
    </div>
  );
};

export default Settings;
