import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Component
const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const { type, message } = toast;

  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-cyan-400 shrink-0" />,
  };

  const styleMap = {
    success: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100 shadow-emerald-950/20 shadow-lg',
    warning: 'border-amber-500/30 bg-amber-950/20 text-amber-100 shadow-amber-950/20 shadow-lg',
    error: 'border-rose-500/30 bg-rose-950/20 text-rose-100 shadow-rose-950/20 shadow-lg',
    info: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-100 shadow-cyan-950/20 shadow-lg',
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl
        transition-all duration-300 transform translate-y-0 opacity-100 scale-100
        animate-in slide-in-from-bottom-5 fade-in duration-300
        ${styleMap[type]}
      `}
      style={{
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }}
    >
      <div className="mt-0.5">{iconMap[type]}</div>
      <div className="flex-1 text-xs font-semibold leading-relaxed tracking-wide">
        {message}
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
