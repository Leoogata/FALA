import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastContextValue {
  showToast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const duration = t.duration ?? (t.actionLabel ? 7000 : 4500);
    setToasts((prev) => [...prev, { ...t, id }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center w-full max-w-[520px] px-4 pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-white text-sm shadow-lg ${t.type === 'error' ? 'bg-[#7A2A08]' : 'bg-[var(--navy)]'}`}
        >
          <span className="flex-1">{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button
              onClick={t.onAction}
              className="shrink-0 text-white border border-white/60 rounded-lg px-3 py-1 text-xs font-medium hover:bg-white/10"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Fechar notificação"
            className="shrink-0 opacity-60 hover:opacity-100 text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
