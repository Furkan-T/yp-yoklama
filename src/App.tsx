import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from './firebase';
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Student, AttendanceRecord, AttendanceType, TabKey, ShowToastFn } from './types';
import { APP_VERSION, APP_NAME, SUB_TYPES, ALL_GROUPS } from './constants';
import { getLocalDateISO, timestampToDateISO } from './utils/validation';

import BottomNav from './components/BottomNav';
import IosInstallPrompt from './components/IosInstallPrompt';
import Toast from './components/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AttendancePage, { type AttendanceSession } from './pages/Attendance';
import Students from './pages/Students';
import Records from './pages/Records';
import Settings from './pages/Settings';
import { useConfirm } from './hooks/useConfirm';

const auth = getAuth();

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const mainRef = useRef<HTMLElement>(null);

  // Yoklama ekranındaki seçimler burada tutulur: sekme değiştirip geri dönünce
  // tarih, tür ve grubu yeniden seçmek gerekmesin.
  const [session, setSession] = useState<AttendanceSession>({
    date: getLocalDateISO(),
    type: 'ETUT',
    subType: SUB_TYPES.ETUT[0],
    group: ALL_GROUPS,
  });

  // GLOBAL VERİLER — tüm dinleyiciler burada açılır, sayfalara props olarak iner.
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', action?: { label: string, onClick: () => void } } | null>(null);
  const showToast = useCallback<ShowToastFn>((message, type, action) => {
    setToast({ message, type, action });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  // Sekme değişince içerik önceki sayfanın kaydırma konumunda kalmasın
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubRecords = onSnapshot(query(collection(db, "attendance"), orderBy("date", "desc")), (s) => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
      setRecords(all.filter(r => !r.isDeleted));
      setLoading(false);
    }, (error) => {
      console.error(error);
      showToast("Yoklama kayıtları yüklenemedi. Bağlantınızı kontrol edin.", "error");
      setLoading(false);
    });

    const unsubStudents = onSnapshot(query(collection(db, "students"), orderBy("name", "asc")), (s) => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
      setStudents(all.filter(st => !st.isDeleted));
      setStudentLoading(false);
    }, (error) => {
      console.error(error);
      showToast("Talebe listesi yüklenemedi. Bağlantınızı kontrol edin.", "error");
      setStudentLoading(false);
    });

    return () => { unsubRecords(); unsubStudents(); };
  }, [user, showToast]);

  const stats = useMemo(() => {
    const activeStudentCount = students.filter(s => s.isActive !== false).length;
    const today = getLocalDateISO();
    const todayRecords = records.filter(r => timestampToDateISO(r.date) === today);

    // Bugünün seanslarını grupla. `date` gün başına sabitlendiği için aynı günün
    // seansları aynı zaman damgasını taşır; en sonuncuyu bulmak için önce
    // kaydın yazılma anına (updatedAt), o da yoksa seansın sıra numarasına bakılır.
    const sessions = new Map<string, {
      type: AttendanceType;
      subType: string;
      savedAt: number;
      orderIndex: number;
      records: AttendanceRecord[];
    }>();

    todayRecords.forEach(r => {
      const key = `${r.type}|${r.subType}`;
      const savedAt = r.updatedAt?.seconds ?? 0;
      const existing = sessions.get(key);
      if (existing) {
        existing.savedAt = Math.max(existing.savedAt, savedAt);
        existing.records.push(r);
      } else {
        sessions.set(key, {
          type: r.type,
          subType: r.subType,
          savedAt,
          orderIndex: SUB_TYPES[r.type]?.indexOf(r.subType) ?? -1,
          records: [r],
        });
      }
    });

    const latestSession = [...sessions.values()].sort((a, b) =>
      b.savedAt - a.savedAt || b.orderIndex - a.orderIndex
    )[0];

    const latestAbsentees = latestSession
      ? latestSession.records
        .filter(r => r.status !== 'VAR')
        .map(r => ({ name: r.studentName, status: r.status }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      : [];

    return {
      totalStudents: students.length,
      activeStudentCount,
      latestSessionInfo: latestSession ? { type: latestSession.type, subType: latestSession.subType } : null,
      latestAbsentees,
    };
  }, [records, students]);

  const { confirm, ConfirmDialog } = useConfirm();
  const handleRefreshApp = async () => {
    const ok = await confirm({ message: "Uygulama yenilensin mi?", confirmLabel: 'Yenile', danger: false });
    if (ok) window.location.reload();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-primary-600">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl"></i>
      </div>
    );
  }
  if (!user) return <Login />;

  return (
    <div className="w-screen h-[100dvh] bg-canvas md:h-screen md:flex md:items-center md:justify-center">
      <div className="w-full h-full md:max-w-md md:h-[calc(100vh-4rem)] bg-canvas flex flex-col font-sans text-ink overflow-hidden relative md:rounded-[2.5rem] md:border md:border-line md:shadow-2xl">
        {toast && <Toast message={toast.message} type={toast.type} action={toast.action} onClose={closeToast} />}
        {ConfirmDialog}
        <IosInstallPrompt />

        {/* BAŞLIK */}
        <header className="flex-none bg-surface pt-12 pb-6 px-6 rounded-b-[2.5rem] shadow-xl border-b border-line z-30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="" className="h-14 w-14 object-contain drop-shadow-[0_0_12px_rgba(25,112,96,0.45)]" />
            <div>
              <h1 className="text-base font-extrabold text-primary-700 tracking-tight leading-tight whitespace-nowrap">{APP_NAME}</h1>
              <p className="text-[10px] text-accent-700 font-bold tracking-[0.2em] uppercase mt-1">
                Yönetici Paneli <span className="text-muted tracking-normal">· {APP_VERSION}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleRefreshApp}
            aria-label="Uygulamayı yenile"
            className="w-10 h-10 rounded-xl bg-surface-soft text-primary-700 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all shadow-lg shadow-black/20 active:scale-95"
          >
            <i className="fa-solid fa-rotate-right text-lg"></i>
          </button>
        </header>

        {/* İÇERİK */}
        <main ref={mainRef} className="flex-1 overflow-y-auto w-full custom-scrollbar">
          {activeTab === 'dashboard' && <Dashboard stats={stats} studentLoading={studentLoading} />}
          {activeTab === 'attendance' && <AttendancePage students={students} records={records} session={session} setSession={setSession} showToast={showToast} />}
          {activeTab === 'students' && <Students students={students} loading={studentLoading} showToast={showToast} />}
          {activeTab === 'records' && <Records records={records} loading={loading} showToast={showToast} />}
          {activeTab === 'settings' && <Settings userEmail={user.email || ''} students={students} records={records} showToast={showToast} />}
        </main>

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};

export default App;
