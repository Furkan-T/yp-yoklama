import React from 'react';
import type { TabKey } from '../types';

interface BottomNavProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

const NAV_ITEMS: { tab: TabKey; icon: string; label: string }[] = [
  { tab: 'dashboard', icon: 'fa-house', label: 'Ana Ekran' },
  { tab: 'attendance', icon: 'fa-clipboard-list', label: 'Yoklama' },
  { tab: 'records', icon: 'fa-clock-rotate-left', label: 'Geçmiş' },
  { tab: 'settings', icon: 'fa-gear', label: 'Ayarlar' },
];

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  // Orta sıradaki yuvarlak "Talebeler" butonu, listenin ikinci ve üçüncü
  // sekmesinin arasına denk gelsin diye iki parçaya bölünüyor.
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];

  const navButton = ({ tab, icon, label }: typeof NAV_ITEMS[number]) => {
    const isActive = activeTab === tab;
    return (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        aria-current={isActive ? 'page' : undefined}
        className="flex flex-col items-center gap-1.5 p-2 w-16 group outline-none"
      >
        <i className={`fa-solid ${icon} text-xl transition-all duration-300 ${isActive ? 'text-primary-300 -translate-y-1' : 'text-dark-500 group-hover:text-dark-300'}`}></i>
        <span className={`text-[9px] font-bold tracking-wide transition-colors whitespace-nowrap ${isActive ? 'text-primary-300' : 'text-dark-500'}`}>{label}</span>
      </button>
    );
  };

  return (
    <nav className="absolute bottom-0 left-0 w-full bg-dark-950/90 backdrop-blur-xl border-t border-white/5 pb-8 pt-2 px-6 z-50 flex justify-between items-end shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {left.map(navButton)}

      <div className="relative w-16 flex justify-center z-50">
        <button
          onClick={() => setActiveTab('students')}
          aria-label="Talebeler"
          aria-current={activeTab === 'students' ? 'page' : undefined}
          className="absolute -top-12 w-16 h-16 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center shadow-lg shadow-primary-900/50 border-4 border-dark-950 transform transition-transform active:scale-95 outline-none"
        >
          <i className="fa-solid fa-users text-2xl"></i>
        </button>
      </div>

      {right.map(navButton)}
    </nav>
  );
};

export default BottomNav;
