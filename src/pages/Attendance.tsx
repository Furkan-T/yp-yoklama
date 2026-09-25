import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, Timestamp, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import type { Student, AttendanceType, AttendanceRecord, TabKey, ShowToastFn } from '../types';
import { ATTENDANCE_TYPES, SUB_TYPES, TYPE_LABELS, DERS_GROUPS } from '../constants';
import { isFutureDate, getLocalDateISO, timestampToDateISO, normalizeSubType } from '../utils/validation';
import { useConfirm } from '../hooks/useConfirm';

interface AttendancePageProps {
  students: Student[];
  records: AttendanceRecord[];
  setActiveTab: (tab: TabKey) => void;
  showToast: ShowToastFn;
}

const ALL_GROUPS = 'HEPSI';

const AttendancePage: React.FC<AttendancePageProps> = ({ students, records, setActiveTab, showToast }) => {
  const [selectedType, setSelectedType] = useState<AttendanceType>('ETUT');
  const [selectedSubType, setSelectedSubType] = useState<string>(SUB_TYPES.ETUT[0]);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateISO());
  // Namazda vakit ile grup ayrı seçilir; dahili derste seansın kendisi zaten gruptur.
  const [namazGroup, setNamazGroup] = useState<string>(ALL_GROUPS);
  /** Yok olarak işaretlenen talebeler. Listedeki diğer herkes var sayılır. */
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const activeGroup = selectedType === 'ETUT' ? selectedSubType : namazGroup;
  const sessionKey = `${selectedDate}|${selectedType}|${selectedSubType}|${activeGroup}`;

  // Kullanıcının elle dokunduğu seans. Kaydetme sonrası gelen snapshot'ın
  // ekrandaki seçimleri ezmemesi için tutulur.
  const touchedSessionRef = useRef<string | null>(null);

  // Gruba atanmamış talebeler (group boş) her grupta listelenir.
  const filteredStudents = useMemo(() => {
    const activeStudents = students.filter(s => s.isActive !== false);
    if (activeGroup === ALL_GROUPS) return activeStudents;
    return activeStudents.filter(s => !s.group || s.group === activeGroup);
  }, [students, activeGroup]);

  // Seçilen tarih/tür/vakit için kayıtlı durumlar
  const savedStatuses = useMemo(() => {
    const saved = new Map<string, string>();
    const target = normalizeSubType(selectedSubType);
    records.forEach(r => {
      if (r.type !== selectedType) return;
      if (timestampToDateISO(r.date) !== selectedDate) return;
      if (normalizeSubType(r.subType) !== target) return;
      saved.set(r.studentId, r.status);
    });
    return saved;
  }, [records, selectedDate, selectedType, selectedSubType]);

  /** Bu seansta daha önce kayıt alınmış mı? */
  const hasSavedSession = useMemo(
    () => filteredStudents.some(s => savedStatuses.has(s.id)),
    [filteredStudents, savedStatuses]
  );

  // Tür değişince alt tür o türün ilk seansına çekilir
  const handleTypeChange = (type: AttendanceType) => {
    setSelectedType(type);
    setSelectedSubType(SUB_TYPES[type][0]);
  };

  // Seans değişince kayıtlı durumları yükle; kullanıcı seçim yapmışsa dokunma
  useEffect(() => {
    if (touchedSessionRef.current === sessionKey) return;
    // VAR dışındaki her durum (YOK, GEÇ, İZİNLİ) işaretli gelir
    const absent = new Set<string>();
    savedStatuses.forEach((status, studentId) => {
      if (status !== 'VAR') absent.add(studentId);
    });
    setAbsentIds(absent);
  }, [sessionKey, savedStatuses]);

  const toggleAbsent = (studentId: string) => {
    touchedSessionRef.current = sessionKey;
    setAbsentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const submitAttendance = async () => {
    if (filteredStudents.length === 0) {
      showToast("Listede talebe yok.", "error");
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

      // Listelenen herkes kaydedilir: işaretliler YOK, kalanlar VAR.
      // Listede olmayanlara (başka grup) dokunulmaz.
      const batch = writeBatch(db);
      filteredStudents.forEach(student => {
        const status = absentIds.has(student.id) ? 'YOK' : 'VAR';
        const existingDocId = existingDocIdByStudent.get(student.id);

        if (existingDocId) {
          batch.update(doc(db, "attendance", existingDocId), { status, updatedAt: serverTimestamp() });
        } else {
          batch.set(doc(collection(db, "attendance")), {
            studentId: student.id,
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
      showToast(`Yoklama kaydedildi — ${absentIds.size} yok, ${filteredStudents.length - absentIds.size} var.`, "success");
      setActiveTab('records');
    } catch (error) {
      console.error(error);
      showToast("Kayıt sırasında hata oluştu.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const absentCount = filteredStudents.filter(s => absentIds.has(s.id)).length;

  return (
    <div className="flex flex-col animate-fade-in w-full h-full">
      <div className="pt-6 px-3 pb-4 space-y-3">
        <div className="flex items-center bg-surface border border-line rounded-xl overflow-hidden w-full shadow-sm">
          <div className="px-4 text-primary-600 flex-shrink-0"><i className="fa-solid fa-calendar-days"></i></div>
          <input
            type="date"
            aria-label="Yoklama tarihi"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 bg-transparent text-ink font-bold py-3 pr-4 outline-none min-w-0"
          />
        </div>

        <div className="flex bg-surface-soft p-1 rounded-xl gap-2 border border-line">
          {ATTENDANCE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`flex-1 py-2.5 text-[11px] font-extrabold rounded-lg transition-all ${selectedType === type ? 'bg-primary-600 text-white shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <select
          aria-label="Yoklama vakti"
          value={selectedSubType}
          onChange={(e) => setSelectedSubType(e.target.value)}
          className="w-full p-3 bg-surface border border-line rounded-xl text-ink text-sm outline-none font-bold shadow-sm"
        >
          {SUB_TYPES[selectedType].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Namazda grup ayrı seçilir; dahili derste seansın kendisi gruptur. */}
        {selectedType === 'NAMAZ' && (
          <select
            aria-label="Grup filtresi"
            value={namazGroup}
            onChange={(e) => setNamazGroup(e.target.value)}
            className="w-full p-3 bg-surface border border-accent-300 rounded-xl text-accent-800 text-sm outline-none font-bold shadow-sm"
          >
            <option value={ALL_GROUPS}>Tüm gruplar</option>
            {DERS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}

        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-muted font-bold">
            Yok olanları işaretleyin — kalan herkes var sayılır.
          </p>
          {absentCount > 0 && (
            <button
              onClick={() => { touchedSessionRef.current = sessionKey; setAbsentIds(new Set()); }}
              className="text-[11px] font-extrabold text-primary-700 hover:underline"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 w-full px-3">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <i className="fa-solid fa-user-slash text-3xl mb-2"></i>
            <p className="text-sm font-bold">Bu seansta listelenecek talebe yok.</p>
          </div>
        ) : filteredStudents.map(student => {
          const isAbsent = absentIds.has(student.id);
          return (
            <button
              key={student.id}
              onClick={() => toggleAbsent(student.id)}
              aria-pressed={isAbsent}
              className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] ${
                isAbsent ? 'bg-rose-50 border-rose-300' : 'bg-surface border-line hover:border-primary-300'
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className={`font-bold text-sm block truncate ${isAbsent ? 'text-rose-700' : 'text-ink'}`}>{student.name}</span>
                <span className="text-[10px] text-muted truncate">
                  {[student.group, student.faculty].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              <span className={`w-16 py-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 border flex-shrink-0 transition-all ${
                isAbsent ? 'bg-rose-600 text-white border-rose-600' : 'bg-surface-soft text-muted border-line'
              }`}>
                <i className={`fa-solid ${isAbsent ? 'fa-xmark' : 'fa-check'} text-xs`}></i>
                {isAbsent ? 'YOK' : 'VAR'}
              </span>
            </button>
          );
        })}
      </div>

      {filteredStudents.length > 0 && (
        <div className="absolute bottom-28 left-0 right-0 px-4 z-40 w-full space-y-2">
          <div className="text-center text-xs font-bold bg-surface/95 backdrop-blur py-2 rounded-xl border border-line shadow-sm">
            <span className="text-rose-600">{absentCount} yok</span>
            <span className="text-muted"> · </span>
            <span className="text-primary-700">{filteredStudents.length - absentCount} var</span>
          </div>
          <button
            onClick={submitAttendance}
            disabled={isSubmitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-xl font-extrabold text-base shadow-lg shadow-primary-900/20 transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...</>
              : hasSavedSession ? 'GÜNCELLE' : 'KAYDET'}
          </button>
        </div>
      )}

      {ConfirmDialog}
      <div className="h-72 w-full flex-shrink-0"></div>
    </div>
  );
};

export default AttendancePage;
