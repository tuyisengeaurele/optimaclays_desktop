import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };
const COLORS = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-brand-navy text-white',
};

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const autoClose = setTimeout(() => setLeaving(true), 4000);
    return () => { cancelAnimationFrame(raf); clearTimeout(autoClose); };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timeout = setTimeout(() => onDone(toast.id), 200);
    return () => clearTimeout(timeout);
  }, [leaving, onDone, toast.id]);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm min-w-64 max-w-sm transition-all duration-200 ${COLORS[toast.type]} ${visible && !leaving ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-3 scale-95'}`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => setLeaving(true)}>
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDone={remove} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be within ToastProvider');
  return ctx;
}
