import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, Timestamp, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import type { Student, AttendanceType, AttendanceStatus, AttendanceRecord, TabKey, ShowToastFn } from '../types';
import { ATTENDANCE_TYPES, SUB_TYPES, STATUS_META } from '../constants';
import { isFutureDate, getLocalDateISO, timestampToDateISO, normalizeSubType } from '../utils/validation';
import { useConfirm } from '../hooks/useConfirm';

interface AttendancePageProps {
  students: Student[];
  records: AttendanceRecord[];
  setActiveTab: (tab: TabKey) => void;
  showToast: ShowToastFn;
}

const STATUS_BUTTONS: { status: AttendanceStatus; icon: string; active: string }[] = [
  { status: 'VAR', icon: 'fa-solid fa-check', active: 'bg-primary-600 ring-primary-400' },
  { status: 'GEC', icon: 'fa-regular fa-clock', active: 'bg-accent-600 ring-accent-400' },
  { status: 'YOK', icon: 'fa-solid fa-xmark', active: 'bg-rose-600 ring-rose-400' },
  { status: 'IZINLI', icon: 'fa-solid fa-user-shield', active: 'bg-sky-600 ring-sky-400' },
];

const AttendancePage: React.FC<AttendancePageProps> = ({ students, records, setActiveTab, showToast }) => {
  const [selectedType, setSelectedType] = useState<AttendanceType>('ETUT');
  const [selectedSubType, setSelectedSubType] = useState<string>(SUB_TYPES.ETUT[0]);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateISO());
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const sessionKey = `${selectedDate}|${selectedType}|${selectedSubType}`;

  // Kullanıcının elle dokunduğu seans. Kaydetme sonrası gelen snapshot'ın
  // ekrandaki seçimleri ezmemesi için tutulur.
  const touchedSessionRef = useRef<string | null>(null);

  // ETÜT'te sadece o gruba atanmış talebeler listelenir; grubu olmayanlar
  // (etut alanı boş) geriye dönük uyumluluk için tüm etütlerde görünür.
  const filteredStudents = useMemo(() => {
    const activeStudents = students.filter(s => s.isActive !== false);
    if (selectedType !== 'ETUT') return activeStudents;
    return activeStudents.filter(s => !s.etut || s.etut === selectedSubType);
  }, [students, selectedType, selectedSubType]);

  // Seçilen tarih/tür/vakit için daha önce kaydedilmiş durumlar
  const savedAttendance = useMemo(() => {
    const saved: Record<string, AttendanceStatus> = {};
    const target = normalizeSubType(selectedSubType);
    records.forEach(r => {
      if (r.type !== selectedType) return;
      if (timestampToDateISO(r.date) !== selectedDate) return;
      if (normalizeSubType(r.subType) !== target) return;
      saved[r.studentId] = r.status;
    });
    return saved;
  }, [records, selectedDate, selectedType, selectedSubType]);

  // Tür değişince alt tür o türün ilk seansına çekilir
  const handleTypeChange = (type: AttendanceType) => {
    setSelectedType(type);
    setSelectedSubType(SUB_TYPES[type][0]);
  };

  // Seans değişince kayıtlı durumları yükle; kullanıcı seçim yapmışsa dokunma
  useEffect(() => {
    if (touchedSessionRef.current !== sessionKey) {
      setAttendance(savedAttendance);
    }
  }, [sessionKey, savedAttendance]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    touchedSessionRef.current = sessionKey;
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = async () => {
    if (Object.keys(attendance).length > 0) {
      const ok = await confirm({ message: "Mevcut seçimlerin üzerine yazılacak, emin misiniz?", confirmLabel: 'Evet, Üzerine Yaz', danger: false });
      if (!ok) return;
    }
    touchedSessionRef.current = sessionKey;
    setAttendance(Object.fromEntries(filteredStudents.map(s => [s.id, 'VAR' as AttendanceStatus])));
    showToast("Listelenen tüm talebeler VAR seçildi.", "success");
  };

  const submitAttendance = async () => {
    if (Object.keys(attendance).length === 0) {
      showToast("Lütfen seçim yapın!", "error");
      return;
    }

    if (isFutureDate(selectedDate)) {
      const ok = await confirm({ message: "İleri bir tarihe yoklama almak üzeresiniz. Devam edilsin mi?", confirmLabel: 'Devam Et', danger: false });
      if (!ok) return;
    }

    // Gün içindeki tüm seanslar aynı tarih damgasını paylaşsın diye saat sabitlenir.
    const recordTimestamp = Timestamp.fromDate(new Date(`${selectedDate}T12:00:00`));
    setIsSubmitting(true);

    try {
      // Mevcut kayıtları TEK sorguda çek (talebe başına ayrı okuma yapmak yerine)
      const snapshot = await getDocs(query(
        collection(db, "attendance"),
        where("date", "==", recordTimestamp),
        where("type", "==", selectedType),
        where("subType", "==", selectedSubType)
      ));

      const existingDocIdByStudent = new Map<string, string>();
      snapshot.docs.forEach(d => {
        const data = d.data() as AttendanceRecord;
        if (!data.isDeleted) existingDocIdByStudent.set(data.studentId, d.id);
      });

      // Tüm yazmalar tek atomik batch'te — ya tamamı uygulanır ya hiçbiri.
      const batch = writeBatch(db);
      Object.entries(attendance).forEach(([studentId, status]) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        const existingDocId = existingDocIdByStudent.get(studentId);
        if (existingDocId) {
          batch.update(doc(db, "attendance", existingDocId), { status, updatedAt: serverTimestamp() });
        } else {
          batch.set(doc(collection(db, "attendance")), {
            studentId,
            studentName: student.name,
            type: selectedType,
            subType: selectedSubType,
            status,
            date: recordTimestamp,
            updatedAt: serverTimestamp(),
          });
        }
      });

      await batch.commit();
      showToast("Yoklama kaydedildi!", "success");
      setActiveTab('records');
    } catch (error) {
      console.error(error);
      showToast("Kayıt sırasında hata oluştu.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sayaç yalnızca ekranda listelenen talebeleri gösterir; kaydetme ise
  // listede olmayan (ör. etüt grubu değişmiş) talebelerin durumlarını da korur.
  const selectedCount = filteredStudents.filter(s => attendance[s.id]).length;

  return (
    <div className="flex flex-col animate-fade-in w-full h-full">
      <div className="pt-6 px-3 pb-4">
        <div className="mb-3 flex items-center bg-dark-900/60 border border-primary-900/40 rounded-xl overflow-hidden w-full">
          <div className="px-4 text-primary-300 flex-shrink-0"><i className="fa-solid fa-calendar-days"></i></div>
          <input
            type="date"
            aria-label="Yoklama tarihi"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 bg-transparent text-white font-bold py-3 pr-4 outline-none [color-scheme:dark] min-w-0"
          />
        </div>

        <button
          onClick={markAllPresent}
          className="w-full py-3 mb-3 bg-primary-500/10 border border-primary-500/30 text-primary-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-500 hover:text-white transition-all"
        >
          <i className="fa-solid fa-check-double"></i> Tümünü Geldi İşaretle
        </button>

        <div className="flex bg-dark-900/80 p-1 rounded-xl mb-3 gap-2">
          {ATTENDANCE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`flex-1 py-2.5 text-[11px] font-extrabold rounded-lg transition-all ${selectedType === type ? 'bg-primary-500 text-white shadow-md' : 'text-dark-400 hover:text-dark-200 bg-dark-800/50 hover:bg-dark-800'}`}
            >
              {type}
            </button>
          ))}
        </div>

        <select
          aria-label="Yoklama vakti"
          value={selectedSubType}
          onChange={(e) => setSelectedSubType(e.target.value)}
          className="w-full p-3 bg-dark-900 border border-dark-800 rounded-xl text-primary-100 text-sm outline-none font-medium"
        >
          {SUB_TYPES[selectedType].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="space-y-2 w-full px-3">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10 text-dark-400">
            <i className="fa-solid fa-user-slash text-3xl mb-2"></i>
            <p className="text-sm font-bold">Bu seansta listelenecek talebe yok.</p>
          </div>
        ) : filteredStudents.map(student => (
          <div key={student.id} className="bg-dark-900/60 p-3 rounded-xl border border-dark-800 flex items-center justify-between gap-3 w-full">
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm text-primary-50 block truncate">{student.name}</span>
              <span className="text-[10px] text-dark-400 truncate">{student.grade || student.school || '—'}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label={`${student.name} durumu`}>
              {STATUS_BUTTONS.map(({ status, icon, active }) => (
                <button
                  key={status}
                  onClick={() => setStatus(student.id, status)}
                  aria-pressed={attendance[student.id] === status}
                  className={`w-12 py-2 rounded-lg text-[9px] font-extrabold transition-all flex flex-col items-center justify-center gap-0.5 ${
                    attendance[student.id] === status
                      ? `${active} text-white shadow-lg ring-1`
                      : 'bg-dark-800 text-dark-400 border border-dark-700'
                  }`}
                >
                  <i className={`${icon} text-xs`}></i> {STATUS_META[status].short}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedCount > 0 && (
        <div className="absolute bottom-28 left-0 right-0 px-4 z-40 w-full space-y-2">
          <div className="text-center text-xs text-primary-200 font-bold bg-dark-900/90 py-2 rounded-xl border border-primary-900/40">
            {selectedCount} / {filteredStudents.length} talebe seçildi
          </div>
          <button
            onClick={submitAttendance}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-400 text-white py-3 rounded-xl font-extrabold text-base shadow-2xl shadow-primary-950/60 transform active:scale-95 transition-all border border-primary-300/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...</> : `KAYDET (${selectedCount})`}
          </button>
        </div>
      )}

      {ConfirmDialog}
      <div className="h-72 w-full flex-shrink-0"></div>
    </div>
  );
};

export default AttendancePage;
