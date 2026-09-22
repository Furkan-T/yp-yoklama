import { useCallback, useRef, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts;
    setOptions(normalized);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleResult = (result: boolean) => {
    setOptions(null);
    resolver.current?.(result);
  };

  const ConfirmDialog = options ? (
    <ConfirmModal
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      danger={options.danger}
      onConfirm={() => handleResult(true)}
      onCancel={() => handleResult(false)}
    />
  ) : null;

  return { confirm, ConfirmDialog };
}
