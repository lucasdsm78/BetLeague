import React from 'react';

/**
 * SessionStorage helper avec TTL et parsing strict.
 * Objectif: éviter les flows "zombies" et les JSON cassés.
 */

type WithTTL = {
  readonly expiresAt: number;
};

export function useJourneySessionStorage<T extends WithTTL>(params: {
  key: string;
  isValid: (v: unknown) => v is T;
}) {
  const { key, isValid } = params;

  const read = React.useCallback((): T | null => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isValid(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [key, isValid]);

  const [now, setNow] = React.useState(() => Date.now());
  const [data, setData] = React.useState<T | null>(() => read());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expired = !!data && data.expiresAt <= now;
  const secondsRemaining = data ? Math.max(0, Math.ceil((data.expiresAt - now) / 1000)) : 0;

  const write = React.useCallback((next: T) => {
    sessionStorage.setItem(key, JSON.stringify(next));
    setData(next);
  }, [key]);

  const clear = React.useCallback(() => {
    sessionStorage.removeItem(key);
    setData(null);
  }, [key]);

  // Auto-clean si expiré
  React.useEffect(() => {
    if (!expired) return;
    clear();
  }, [expired, clear]);

  return { data, write, clear, expired, secondsRemaining, now, read };
}

