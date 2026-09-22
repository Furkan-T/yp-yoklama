import React, { useState } from 'react';
import { APP_NAME } from '../constants';

const IosInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(() => {
    // Cihaz iOS mu? (iPhone, iPad, iPod)
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    // Uygulama zaten ana ekrandan mı açıldı?
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

    return isIOS && !isStandalone;
  });

  if (!showPrompt) return null;

  return (
    <div className="absolute bottom-24 left-4 right-4 z-[90] bg-dark-900/95 backdrop-blur-xl border border-primary-500/30 p-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] animate-slide-up">
      <button
        onClick={() => setShowPrompt(false)}
        aria-label="Kapat"
        className="absolute -top-3 -right-3 w-8 h-8 bg-dark-800 rounded-full border border-dark-700 flex items-center justify-center text-dark-300 hover:text-white"
      >
        <i className="fa-solid fa-xmark text-sm"></i>
      </button>

      <div className="flex items-start gap-4">
        <img src="/logo.png" alt="" className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(25,112,96,0.5)]" />
        <div className="flex-1">
          <h3 className="text-primary-300 font-bold text-sm mb-1">Uygulamayı Yükle</h3>
          <p className="text-dark-200 text-xs leading-relaxed">
            Daha iyi bir deneyim için {APP_NAME}'yı ana ekranına ekle.
          </p>

          <div className="mt-3 flex items-center gap-2 text-xs text-dark-300 bg-dark-950/50 p-2 rounded-lg border border-white/5">
            <span>1. Aşağıdaki</span>
            <span className="text-sky-400 text-lg"><i className="fa-solid fa-arrow-up-from-bracket"></i></span>
            <span>(Paylaş) butonuna bas.</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-dark-300 bg-dark-950/50 p-2 rounded-lg border border-white/5">
            <span>2.</span>
            <span className="font-bold text-white">"Ana Ekrana Ekle"</span>
            <span>seçeneğini seç.</span>
          </div>
        </div>
      </div>

      {/* Safari'nin alt barına doğru bakan ok */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rotate-45 w-4 h-4 bg-dark-900 border-r border-b border-primary-500/30"></div>
    </div>
  );
};

export default IosInstallPrompt;
