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

const toastStyles: Record<string, React.CSSProperties> = {
  success: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
  },
  error: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)',
  },
  warning: {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    color: '#78350f',
    border: '1px solid rgba(120, 53, 15, 0.25)',
    boxShadow: '0 8px 25px rgba(245, 158, 11, 0.4)',
  },
  info: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
  },
};

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

  const typeStyle = toastStyles[toast.type] || toastStyles.info;
  const textColor = typeStyle.color as string;

  return (
    <div
      className={`toast toast-${toast.type}`}
      style={typeStyle}
      onMouseEnter={() => onPause?.(toast.id)}
      onMouseLeave={() => onResume?.(toast.id)}
    >
      <div className="toast-icon" style={{ fontSize: '20px', flexShrink: 0 }}>{getIcon()}</div>
      <div className="toast-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="toast-title" style={{ fontSize: '15px', fontWeight: 700, color: textColor, lineHeight: 1.3 }}>
          {toast.title}
        </div>
        {toast.message && (
          <div className="toast-message" style={{ fontSize: '13px', fontWeight: 500, color: textColor, opacity: 0.95, lineHeight: 1.4 }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        className="toast-close"
        style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', opacity: 0.8 }}
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