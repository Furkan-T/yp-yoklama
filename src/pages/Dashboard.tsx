import React from 'react';
import type { AttendanceStatus } from '../types';
import { STATUS_META } from '../constants';

interface DashboardProps {
  stats: {
    totalStudents: number;
    activeStudentCount: number;
    latestSessionInfo: { type: string; subType: string } | null;
    latestAbsentees: { name: string; status: AttendanceStatus }[];
  };
  studentLoading: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, studentLoading }) => {
  return (
    <div className="p-4 pt-6 space-y-6 animate-fade-in w-full">

      {/* TOPLAM / AKTİF TALEBE KARTLARI */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-dark-900/60 p-6 rounded-3xl border border-primary-900/30 shadow-lg">
          <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/20 w-fit mb-4">
            <i className="fa-solid fa-users text-2xl text-primary-300"></i>
          </div>
          <div className="text-4xl font-extrabold text-white mb-1">{studentLoading ? '-' : stats.totalStudents}</div>
          <div className="text-xs text-dark-300 font-bold uppercase tracking-wider">Toplam Kayıtlı</div>
        </div>
        <div className="bg-dark-900/60 p-6 rounded-3xl border border-primary-900/30 shadow-lg">
          <div className="p-3 bg-accent-500/10 rounded-2xl border border-accent-500/20 w-fit mb-4">
            <i className="fa-solid fa-user-check text-2xl text-accent-400"></i>
          </div>
          <div className="text-4xl font-extrabold text-white mb-1">{studentLoading ? '-' : stats.activeStudentCount}</div>
          <div className="text-xs text-dark-300 font-bold uppercase tracking-wider">Aktif Kayıtlı</div>
        </div>
      </div>

      {/* BUGÜNÜN SON YOKLAMASI */}
      <section className="bg-dark-900/60 p-6 rounded-3xl border border-primary-900/30 shadow-lg">
        <h2 className="font-bold text-lg text-primary-100 mb-4 border-b border-white/5 pb-3 flex items-center gap-2">
          <i className="fa-solid fa-clock-rotate-left text-primary-300"></i> Bugünün Son Yoklaması
        </h2>

        {stats.latestSessionInfo ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-primary-500/10 text-primary-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-primary-500/20">
                {stats.latestSessionInfo.type} — {stats.latestSessionInfo.subType}
              </span>
            </div>

            {stats.latestAbsentees.length > 0 ? (
              <ul className="space-y-2">
                {stats.latestAbsentees.map((student, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-dark-950 p-3.5 rounded-xl border border-white/5">
                    <span className="font-bold text-sm text-dark-100">{student.name}</span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md border ${STATUS_META[student.status].badge}`}>
                      {STATUS_META[student.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-3 border border-primary-500/20 shadow-[0_0_15px_rgba(25,112,96,0.25)]">
                  <i className="fa-solid fa-check text-primary-300 text-2xl"></i>
                </div>
                <p className="text-sm text-dark-300 font-bold">Bu yoklamada tüm talebeler mevcut.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-inner">
              <i className="fa-solid fa-calendar-xmark text-dark-400 text-3xl"></i>
            </div>
            <p className="text-sm text-dark-400 font-bold">Bugün henüz yoklama alınmadı.</p>
          </div>
        )}
      </section>

      <div className="h-24 w-full flex-shrink-0"></div>
    </div>
  );
};

export default Dashboard;
