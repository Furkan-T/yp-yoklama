import React, { useEffect } from 'react';

interface ConfirmModalProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title = 'Emin misiniz?',
  message,
  confirmLabel = 'Evet',
  cancelLabel = 'Vazgeç',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="bg-dark-900 w-full md:max-w-sm rounded-3xl p-6 border border-primary-900/40 shadow-2xl relative animate-slide-up">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${danger ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-primary-500/10 border-primary-500/20 text-primary-300'}`}>
          <i className={`fa-solid ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'} text-2xl`}></i>
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-2">{title}</h2>
        <p className="text-sm text-dark-300 text-center leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-8">
          <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-dark-800 text-dark-200 font-bold active:scale-95 transition-all">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-white active:scale-95 transition-all ${danger ? 'bg-rose-500' : 'bg-primary-500'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
