/**
 * Toast Container Component - TypeScript version
 * Compatible with the new toast hook API
 */

import React from 'react';
import type { Toast } from '../types';
import './Toast.css';

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onClose, onPause, onResume }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  return (
    <div
      className={`toast toast-${toast.type}`}
      onMouseEnter={() => onPause?.(toast.id)}
      onMouseLeave={() => onResume?.(toast.id)}
    >
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
      </div>
      <button
        className="toast-close"
        onClick={() => onClose(toast.id)}
        aria-label="Fermer la notification"
      >
        ×
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
  pauseToast?: (id: string) => void;
  resumeToast?: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  removeToast,
  pauseToast,
  resumeToast
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onClose={removeToast}
          onPause={pauseToast}
          onResume={resumeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;