import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, action }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, action ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [onClose, action]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-slide-down border backdrop-blur-md ${
        type === 'success'
          ? 'bg-primary-600/95 text-white border-primary-400/40 shadow-primary-900/40'
          : 'bg-rose-500/95 text-white border-rose-400/50 shadow-rose-500/20'
      }`}
    >
      <i className={`text-xl fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
      <span className="font-bold text-sm tracking-wide">{message}</span>
      {action && (
        <button
          onClick={() => { action.onClick(); onClose(); }}
          className="ml-2 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-extrabold uppercase tracking-wide transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default Toast;
