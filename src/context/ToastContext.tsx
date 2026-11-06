import React, { createContext, useContext, useState, useCallback } from 'react';
import { IconCheck, IconAlertTriangle, IconX } from '../components/common/Icons.js';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  undoAction?: () => void;
  undoLabel?: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (msg: string, type?: Toast['type'], undo?: { label: string; action: () => void }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'info', undo?: { label: string; action: () => void }) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message,
        type,
        undoAction: undo?.action,
        undoLabel: undo?.label
      };
      setToasts((prev) => [...prev, newToast]);

      // Auto dismiss after 6 seconds unless has undo
      const ttl = undo ? 10000 : 5000;
      setTimeout(() => {
        removeToast(id);
      }, ttl);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-[10px] border shadow-sm flex items-start gap-3 transition-all ${
              t.type === 'success'
                ? 'bg-white border-[#0F766E] text-[#1E1B18]'
                : t.type === 'error'
                ? 'bg-white border-[#8F1D1D] text-[#1E1B18]'
                : 'bg-white border-[#E9DFD3] text-[#1E1B18]'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {t.type === 'success' && <IconCheck size={18} className="text-[#0F766E]" />}
              {t.type === 'error' && <IconAlertTriangle size={18} className="text-[#8F1D1D]" />}
              {t.type === 'info' && <span className="w-2 h-2 rounded-full bg-[#B03A0C] inline-block mt-1" />}
            </div>
            <div className="flex-1 text-[13px] leading-relaxed">
              <p>{t.message}</p>
              {t.undoAction && (
                <button
                  onClick={() => {
                    t.undoAction?.();
                    removeToast(t.id);
                  }}
                  className="mt-1.5 text-[12px] font-semibold text-[#B03A0C] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {t.undoLabel || 'Undo action'}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#6A5D52] hover:text-[#1E1B18] cursor-pointer"
            >
              <IconX size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

