import React from 'react';

type Stored = {
  expiresAt?: number;
  [k: string]: any;
};

export function useExpiringSessionStorageToken<T extends Stored>(key: string) {
  const [data, setData] = React.useState<T | null>(() => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const expired = !!data?.expiresAt && data.expiresAt <= now;
  const secondsRemaining = data?.expiresAt ? Math.max(0, Math.ceil((data.expiresAt - now) / 1000)) : 0;

  const write = React.useCallback((next: T) => {
    sessionStorage.setItem(key, JSON.stringify(next));
    setData(next);
  }, [key]);

  const clear = React.useCallback(() => {
    sessionStorage.removeItem(key);
    setData(null);
  }, [key]);

  return { data, write, clear, expired, secondsRemaining, now };
}
