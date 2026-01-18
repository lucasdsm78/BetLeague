import React, { createContext, useContext } from 'react';
import { ToastContainer } from '../components/ToastContainer';
import { useToast, type UseToastReturn } from '../hooks/useToast';

const ToastContext = createContext<UseToastReturn | null>(null);

export const useGlobalToast = (): UseToastReturn => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useGlobalToast must be used within <GlobalToastProvider />');
  }
  return ctx;
};

export const GlobalToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Hook unique -> un seul système toast global
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer
        toasts={toast.toasts}
        removeToast={toast.removeToast}
        pauseToast={toast.pauseToast}
        resumeToast={toast.resumeToast}
      />
    </ToastContext.Provider>
  );
};
