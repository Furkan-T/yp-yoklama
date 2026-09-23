import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { AttendanceRecord, AttendanceType, ShowToastFn } from '../types';
import { ATTENDANCE_TYPES, SUB_TYPES, STATUS_META, TYPE_LABELS } from '../constants';
import { getLocalDateISO, timestampToDateISO, normalizeSubType } from '../utils/validation';
import { useConfirm } from '../hooks/useConfirm';

interface RecordsProps {
  records: AttendanceRecord[];
  loading: boolean;
  showToast: ShowToastFn;
}

const ALL = 'HEPSI';

const Records: React.FC<RecordsProps> = ({ records, loading, showToast }) => {
  const [historyDate, setHistoryDate] = useState<string>(getLocalDateISO());
  const [historyType, setHistoryType] = useState<AttendanceType>('ETUT');
  const [historySubType, setHistorySubType] = useState<string>(ALL);
  const [isDeleting, setIsDeleting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const handleTypeChange = (newType: AttendanceType) => {
    setHistoryType(newType);
    setHistorySubType(ALL); // Tür değişince gizlenen kayıt kalmasın
  };

  const filteredRecords = useMemo(() => {
    const target = historySubType === ALL ? null : normalizeSubType(historySubType);
    return records.filter(record => {
      if (record.type !== historyType) return false;
      if (timestampToDateISO(record.date) !== historyDate) return false;
      return target === null || normalizeSubType(record.subType) === target;
    });
  }, [records, historyDate, historyType, historySubType]);

  const restoreRecords = async (ids: string[]) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, "attendance", id), { isDeleted: false, deletedAt: null }));
      await batch.commit();
      showToast(ids.length > 1 ? `${ids.length} kayıt geri alındı.` : "Kayıt geri alındı.", "success");
    } catch (error) {
      console.error(error);
      showToast("Geri alma başarısız.", "error");
    }
  };

  const handleDeleteRecord = async (record: AttendanceRecord) => {
    const ok = await confirm({ message: `${record.studentName} kaydını silmek istediğinize emin misiniz?`, confirmLabel: 'Sil' });
    if (!ok) return;
    try {
      await updateDoc(doc(db, "attendance", record.id), { isDeleted: true, deletedAt: serverTimestamp() });
      showToast("Kayıt silindi.", "success", { label: "Geri Al", onClick: () => restoreRecords([record.id]) });
    } catch (error) {
      console.error(error);
      showToast("Silme işlemi başarısız.", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (filteredRecords.length === 0) {
      showToast("Silinecek kayıt yok.", "error");
      return;
    }

    const subTypeText = historySubType === ALL ? 'tüm vakitler' : normalizeSubType(historySubType);
    const ok = await confirm({
      message: `${historyDate} tarihindeki ${TYPE_LABELS[historyType]} (${subTypeText}) için ${filteredRecords.length} kayıt silinecek. Emin misiniz?`,
      confirmLabel: 'Tümünü Sil',
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const ids = filteredRecords.map(record => record.id);
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, "attendance", id), { isDeleted: true, deletedAt: serverTimestamp() }));
      await batch.commit();
      showToast(`${ids.length} kayıt silindi.`, "success", { label: "Geri Al", onClick: () => restoreRecords(ids) });
    } catch (error) {
      console.error(error);
      showToast("Toplu silme başarısız.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in w-full">
      <div className="pt-6 px-4 pb-4">
        <div className="mb-2 flex items-center bg-dark-900/60 border border-primary-900/40 rounded-xl overflow-hidden w-full">
          <div className="px-3 text-primary-300 flex-shrink-0"><i className="fa-solid fa-filter text-xs"></i></div>
          <input
            type="date"
            aria-label="Kayıt tarihi"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="flex-1 bg-transparent text-white font-bold py-2 pr-4 outline-none text-sm [color-scheme:dark] min-w-0"
          />
        </div>

        <div className="flex bg-dark-900/80 p-1 rounded-xl mb-2 gap-2">
          {ATTENDANCE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`flex-1 py-2 text-[11px] font-extrabold rounded-lg transition-all ${historyType === type ? 'bg-primary-500 text-white shadow-md' : 'text-dark-400 hover:text-dark-200'}`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <select
          aria-label="Vakit filtresi"
          value={historySubType}
          onChange={(e) => setHistorySubType(e.target.value)}
          className="w-full p-2.5 bg-dark-900 border border-dark-800 rounded-xl text-primary-100 text-xs outline-none font-medium mb-2"
        >
          <option value={ALL}>TÜMÜNÜ GÖSTER</option>
          {SUB_TYPES[historyType].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {filteredRecords.length > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="w-full py-2.5 px-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 font-bold text-xs hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Siliniyor...</>
              : <><i className="fa-solid fa-trash-can"></i> Tümünü Sil ({filteredRecords.length})</>}
          </button>
        )}
      </div>

      <div className="space-y-2 px-4">
        {loading ? (
          <p className="text-center text-dark-400 py-10">Yükleniyor...</p>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-dark-800 rounded-full flex items-center justify-center mb-4 border border-dark-700">
              <i className="fa-solid fa-filter text-3xl text-dark-500"></i>
            </div>
            <h3 className="font-bold text-dark-300 text-lg">Kayıt Yok</h3>
            <p className="text-xs text-dark-500 mt-1">Bu tarihte kayıt bulunamadı.</p>
          </div>
        ) : (
          filteredRecords.map(record => (
            <div key={record.id} className="p-3 bg-dark-900/60 rounded-xl border border-dark-800 flex justify-between items-center w-full gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1 h-8 rounded-full flex-shrink-0 ${STATUS_META[record.status].bar}`}></div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-primary-50 truncate">{record.studentName}</div>
                  <div className="text-[10px] text-dark-400 mt-0.5">{normalizeSubType(record.subType)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[9px] font-extrabold px-2 py-1 rounded-md border ${STATUS_META[record.status].badge}`}>
                  {STATUS_META[record.status].short}
                </span>
                <button
                  onClick={() => handleDeleteRecord(record)}
                  aria-label={`${record.studentName} kaydını sil`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/10"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {ConfirmDialog}
      <div className="h-32 w-full"></div>
    </div>
  );
};

export default Records;
