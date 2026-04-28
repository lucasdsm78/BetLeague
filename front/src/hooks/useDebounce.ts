/**
 * Debounce Hook - TypeScript version
 * Optimized debouncing with proper TypeScript types
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseDebounceOptions {
  leading?: boolean;  // Execute on leading edge
  trailing?: boolean; // Execute on trailing edge (default)
  maxWait?: number;   // Maximum wait time
}

export interface UseDebounceReturn<T> {
  debouncedValue: T;
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options: UseDebounceOptions = {}
): T {
  const { trailing = true } = options;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (trailing) {
        setDebouncedValue(value);
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, trailing]);

  return debouncedValue;
}

// Advanced debounce hook with more control
export function useAdvancedDebounce<T>(
  value: T,
  delay: number,
  options: UseDebounceOptions = {}
): UseDebounceReturn<T> {
  const {
    leading = false,
    trailing = true,
    maxWait,
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTimeRef = useRef<number | null>(null);
  const lastInvokeTimeRef = useRef<number>(0);

  const invokeFunc = useCallback((newValue: T) => {
    setDebouncedValue(newValue);
    lastInvokeTimeRef.current = Date.now();
  }, []);

  const leadingEdge = useCallback((newValue: T) => {
    lastInvokeTimeRef.current = Date.now();
    if (leading) {
      invokeFunc(newValue);
    }
  }, [leading, invokeFunc]);

  const remainingWait = useCallback((time: number) => {
    const timeSinceLastCall = time - (lastCallTimeRef.current || 0);
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;
    const timeWaiting = delay - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }, [delay, maxWait]);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - (lastCallTimeRef.current || 0);
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

    return (
      lastCallTimeRef.current === null ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }, [delay, maxWait]);

  const trailingEdge = useCallback((newValue: T) => {
    if (trailing) {
      invokeFunc(newValue);
    }
    cancel();
  }, [trailing, invokeFunc]);

  const timerExpired = useCallback((newValue: T) => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(newValue);
    } else {
      // Restart the timer
      timeoutRef.current = setTimeout(
        () => timerExpired(newValue),
        remainingWait(time)
      );
    }
  }, [shouldInvoke, trailingEdge, remainingWait]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    lastInvokeTimeRef.current = 0;
    lastCallTimeRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      invokeFunc(value);
      cancel();
    }
  }, [value, invokeFunc, cancel]);

  const isPending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  useEffect(() => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    lastCallTimeRef.current = time;

    if (isInvoking) {
      if (timeoutRef.current === null) {
        leadingEdge(value);
      }
      
      if (maxWait !== undefined) {
        maxTimeoutRef.current = setTimeout(() => {
          invokeFunc(value);
          cancel();
        }, maxWait);
      }
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(
      () => timerExpired(value),
      isInvoking ? delay : remainingWait(time)
    );

    return () => {
      cancel();
    };
  }, [value, delay, shouldInvoke, leadingEdge, timerExpired, remainingWait, maxWait, invokeFunc, cancel]);

  return {
    debouncedValue,
    cancel,
    flush,
    isPending,
  };
}

// Function debounce hook (for debouncing function calls)
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: UseDebounceOptions = {}
): T & { cancel: () => void; flush: () => void; isPending: () => boolean } {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);

  // Update callback ref
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      cancel();
      callbackRef.current(...argsRef.current);
    }
  }, [cancel]);

  const isPending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    argsRef.current = args;
    cancel();

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      timeoutRef.current = null;
    }, delay);
  }, [delay, cancel]) as T & { 
    cancel: () => void; 
    flush: () => void; 
    isPending: () => boolean;
  };

  debouncedCallback.cancel = cancel;
  debouncedCallback.flush = flush;
  debouncedCallback.isPending = isPending;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return debouncedCallback;
}

export default useDebounce;