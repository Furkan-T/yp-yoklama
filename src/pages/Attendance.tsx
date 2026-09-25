import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, Timestamp, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import type { Student, AttendanceType, AttendanceRecord, ShowToastFn } from '../types';
import { ATTENDANCE_TYPES, SUB_TYPES, TYPE_LABELS, DERS_GROUPS, ALL_GROUPS } from '../constants';
import { isFutureDate, timestampToDateISO, normalizeSubType } from '../utils/validation';
import { useConfirm } from '../hooks/useConfirm';

/** Yoklama ekranındaki seçimler; App'te tutulur, sekme değişince kaybolmaz. */
export interface AttendanceSession {
  date: string;
  type: AttendanceType;
  subType: string;
  /** Yalnızca namazda kullanılır; dahili derste seansın kendisi gruptur. */
  group: string;
}

interface AttendancePageProps {
  students: Student[];
  records: AttendanceRecord[];
  session: AttendanceSession;
  setSession: React.Dispatch<React.SetStateAction<AttendanceSession>>;
  showToast: ShowToastFn;
}

const AttendancePage: React.FC<AttendancePageProps> = ({ students, records, session, setSession, showToast }) => {
  const { date, type, subType, group } = session;
  /** Yok olarak işaretlenen talebeler. Listedeki diğer herkes var sayılır. */
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Dahili derste seans zaten gruptur; namazda vakit ile grup ayrı seçilir.
  const activeGroup = type === 'ETUT' ? subType : group;
  const sessionKey = `${date}|${type}|${subType}|${activeGroup}`;

  // Kullanıcının elle dokunduğu seans. Kaydetme sonrası gelen snapshot'ın
  // ekrandaki seçimleri ezmemesi için tutulur.
  const touchedSessionRef = useRef<string | null>(null);

  const activeStudents = useMemo(() => students.filter(s => s.isActive !== false), [students]);

  /** Gruba atanmamış talebeler (group boş) her grupta listelenir. */
  const studentsOf = useMemo(() => (g: string) =>
    g === ALL_GROUPS ? activeStudents : activeStudents.filter(s => !s.group || s.group === g),
  [activeStudents]);

  const filteredStudents = useMemo(() => studentsOf(activeGroup), [studentsOf, activeGroup]);

  /** Bu tarih/tür/vakit için kayıtlı talebe kimlikleri ve durumları. */
  const statusesFor = useMemo(() => (forSubType: string) => {
    const target = normalizeSubType(forSubType);
    const saved = new Map<string, string>();
    records.forEach(r => {
      if (r.type !== type) return;
      if (timestampToDateISO(r.date) !== date) return;
      if (normalizeSubType(r.subType) !== target) return;
      saved.set(r.studentId, r.status);
    });
    return saved;
  }, [records, date, type]);

  const savedStatuses = useMemo(() => statusesFor(subType), [statusesFor, subType]);

  /** Bu gün ve seans için yoklaması tamamlanmış gruplar. */
  const completedGroups = useMemo(() => {
    const done = new Set<string>();
    DERS_GROUPS.forEach(g => {
      const inGroup = studentsOf(g);
      if (inGroup.length === 0) return;
      const saved = statusesFor(type === 'ETUT' ? g : subType);
      if (inGroup.every(s => saved.has(s.id))) done.add(g);
    });
    return done;
  }, [studentsOf, statusesFor, type, subType]);

  const hasSavedSession = useMemo(
    () => filteredStudents.length > 0 && filteredStudents.every(s => savedStatuses.has(s.id)),
    [filteredStudents, savedStatuses]
  );

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

  const handleTypeChange = (next: AttendanceType) => {
    setSession(s => ({ ...s, type: next, subType: SUB_TYPES[next][0] }));
  };

  /** Dahili derste seansı, namazda grup filtresini değiştirir. */
  const selectGroup = (g: string) => {
    setSession(s => (type === 'ETUT' ? { ...s, subType: g } : { ...s, group: g }));
  };

  const submitAttendance = async () => {
    if (filteredStudents.length === 0) {
      showToast("Listede talebe yok.", "error");
      return;
    }

    if (isFutureDate(date)) {
      const ok = await confirm({ message: "İleri bir tarihe yoklama almak üzeresiniz. Devam edilsin mi?", confirmLabel: 'Devam Et', danger: false });
      if (!ok) return;
    }

    // Gün içindeki tüm seanslar aynı tarih damgasını paylaşsın diye saat sabitlenir.
    const recordTimestamp = Timestamp.fromDate(new Date(`${date}T12:00:00`));
    setIsSubmitting(true);

    try {
      // Mevcut kayıtları TEK sorguda çek (talebe başına ayrı okuma yapmak yerine)
      const snapshot = await getDocs(query(
        collection(db, "attendance"),
        where("date", "==", recordTimestamp),
        where("type", "==", type),
        where("subType", "==", subType)
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
            type,
            subType,
            status,
            date: recordTimestamp,
            updatedAt: serverTimestamp(),
          });
        }
      });

      await batch.commit();

      // Sıradaki gruba geç: art arda yoklama alırken her seferinde tür ve grup
      // yeniden seçilmek zorunda kalınmasın.
      const savedGroup = activeGroup;
      const absentCount = absentIds.size;
      const nextGroup = savedGroup === ALL_GROUPS
        ? null
        : DERS_GROUPS[DERS_GROUPS.indexOf(savedGroup) + 1] ?? null;

      if (nextGroup) {
        touchedSessionRef.current = null;
        selectGroup(nextGroup);
        showToast(`${savedGroup} kaydedildi (${absentCount} yok) → ${nextGroup}`, "success");
      } else {
        showToast(`${savedGroup === ALL_GROUPS ? 'Yoklama' : savedGroup} kaydedildi (${absentCount} yok)`, "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Kayıt sırasında hata oluştu.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const absentCount = filteredStudents.filter(s => absentIds.has(s.id)).length;
  const groupChips = type === 'ETUT' ? DERS_GROUPS : [ALL_GROUPS, ...DERS_GROUPS];

  return (
    <div className="flex flex-col animate-fade-in w-full h-full">
      <div className="pt-6 px-3 pb-4 space-y-3">
        <div className="flex items-center bg-surface border border-line rounded-xl overflow-hidden w-full shadow-sm">
          <div className="px-4 text-primary-600 flex-shrink-0"><i className="fa-solid fa-calendar-days"></i></div>
          <input
            type="date"
            aria-label="Yoklama tarihi"
            value={date}
            onChange={(e) => setSession(s => ({ ...s, date: e.target.value }))}
            className="flex-1 bg-transparent text-ink font-bold py-3 pr-4 outline-none min-w-0"
          />
        </div>

        <div className="flex bg-surface-soft p-1 rounded-xl gap-2 border border-line">
          {ATTENDANCE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`flex-1 py-2.5 text-[11px] font-extrabold rounded-lg transition-all ${type === t ? 'bg-primary-600 text-white shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Namazda vakit; dahili derste seans zaten grup olduğu için gösterilmez. */}
        {type === 'NAMAZ' && (
          <select
            aria-label="Yoklama vakti"
            value={subType}
            onChange={(e) => setSession(s => ({ ...s, subType: e.target.value }))}
            className="w-full p-3 bg-surface border border-line rounded-xl text-ink text-sm outline-none font-bold shadow-sm"
          >
            {SUB_TYPES.NAMAZ.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* GRUP SEÇİMİ — tamamlananlar işaretli gelir */}
        <div className="grid grid-cols-2 gap-2">
          {groupChips.map(g => {
            const selected = activeGroup === g;
            const done = completedGroups.has(g);
            return (
              <button
                key={g}
                onClick={() => selectGroup(g)}
                aria-pressed={selected}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
                  selected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : done
                      ? 'bg-primary-50 text-primary-700 border-primary-200'
                      : 'bg-surface text-muted border-line hover:border-primary-300'
                }`}
              >
                {done && <i className="fa-solid fa-check text-[10px]"></i>}
                <span className="truncate">{g === ALL_GROUPS ? 'Tüm gruplar' : g}</span>
              </button>
            );
          })}
        </div>

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
