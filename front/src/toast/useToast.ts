/**
 * Toast Hook - TypeScript version
 * Advanced toast notification system with queue management
 *
 * Implémentation interne au système de toast global. À utiliser via `GlobalToastProvider`.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Toast, ToastAction } from '../types';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface CreateToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
  persistent?: boolean;
  dismissible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export interface UseToastReturn {
  toasts: Toast[];
  showToast: (options: CreateToastOptions) => string;
  showSuccess: (title: string, message?: string, duration?: number) => string;
  showError: (title: string, message?: string, duration?: number) => string;
  showWarning: (title: string, message?: string, duration?: number) => string;
  showInfo: (title: string, message?: string, duration?: number) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

export interface ToastConfig {
  maxToasts: number;
  defaultDuration: number;
  position: CreateToastOptions['position'];
  pauseOnHover: boolean;
  closeOnClick: boolean;
  newestFirst: boolean;
}

const DEFAULT_CONFIG: ToastConfig = {
  maxToasts: 5,
  defaultDuration: 5000,
  position: 'top-right',
  pauseOnHover: true,
  closeOnClick: true,
  newestFirst: true,
};

interface ToastTimer {
  id: string;
  timeoutId: NodeJS.Timeout;
  remainingTime: number;
  startTime: number;
  paused: boolean;
}

export function useToast(config: Partial<ToastConfig> = {}): UseToastReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ToastTimer>>(new Map());
  const nextIdRef = useRef(1);

  const generateId = useCallback((): string => {
    return `toast-${nextIdRef.current++}-${Date.now()}`;
  }, []);

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    clearTimer(id);
  }, [clearTimer]);

  const setupTimer = useCallback((id: string, duration: number) => {
    clearTimer(id);

    const startTime = Date.now();
    const timeoutId = setTimeout(() => {
      removeToast(id);
    }, duration);

    timersRef.current.set(id, {
      id,
      timeoutId,
      remainingTime: duration,
      startTime,
      paused: false,
    });
  }, [clearTimer, removeToast]);

  const pauseToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer && !timer.paused) {
      clearTimeout(timer.timeoutId);
      const elapsed = Date.now() - timer.startTime;
      const remainingTime = Math.max(0, timer.remainingTime - elapsed);

      timersRef.current.set(id, {
        ...timer,
        remainingTime,
        paused: true,
      });
    }
  }, []);

  const resumeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer && timer.paused && timer.remainingTime > 0) {
      const timeoutId = setTimeout(() => {
        removeToast(id);
      }, timer.remainingTime);

      timersRef.current.set(id, {
        ...timer,
        timeoutId,
        startTime: Date.now(),
        paused: false,
      });
    }
  }, [removeToast]);

  const showToast = useCallback((options: CreateToastOptions): string => {
    const id = generateId();
    const duration = options.duration ?? finalConfig.defaultDuration;

    const toast: Toast = {
      id,
      type: options.type,
      title: options.title,
      message: options.message,
      duration: options.persistent ? undefined : duration,
      actions: options.actions,
    };

    setToasts(prev => {
      let newToasts = finalConfig.newestFirst ? [toast, ...prev] : [...prev, toast];

      if (newToasts.length > finalConfig.maxToasts) {
        const toastsToRemove = newToasts.slice(finalConfig.maxToasts);
        toastsToRemove.forEach(t => clearTimer(t.id));
        newToasts = newToasts.slice(0, finalConfig.maxToasts);
      }

      return newToasts;
    });

    if (!options.persistent && duration > 0) {
      setupTimer(id, duration);
    }

    return id;
  }, [generateId, finalConfig, setupTimer, clearTimer]);

  const showSuccess = useCallback((title: string, message?: string, duration?: number): string => {
    return showToast({ type: 'success', title, message, duration });
  }, [showToast]);

  const showError = useCallback((title: string, message?: string, duration?: number): string => {
    return showToast({ type: 'error', title, message, duration: duration || 8000 });
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, duration?: number): string => {
    return showToast({ type: 'warning', title, message, duration });
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, duration?: number): string => {
    return showToast({ type: 'info', title, message, duration });
  }, [showToast]);

  const clearAllToasts = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer.timeoutId));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer.timeoutId));
      timersRef.current.clear();
    };
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    clearAllToasts,
    pauseToast,
    resumeToast,
  };
}
