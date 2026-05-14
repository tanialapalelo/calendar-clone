'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Individual toast item
// ---------------------------------------------------------------------------
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onRemove]);

  const icons = {
    success: <CheckCircleIcon size={16} className="shrink-0 text-green-500" />,
    error: <AlertCircleIcon size={16} className="shrink-0 text-red-500" />,
    info: <InfoIcon size={16} className="shrink-0 text-blue-500" />,
  };

  const borders = {
    success: 'border-l-4 border-green-500',
    error: 'border-l-4 border-red-500',
    info: 'border-l-4 border-blue-500',
  };

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-lg',
        'animate-in slide-in-from-right-4 duration-200',
        borders[toast.type],
      ].join(' ')}
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm text-gray-700">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onRemove(toast.id)}
        className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-6 bottom-6 z-[9999] flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
