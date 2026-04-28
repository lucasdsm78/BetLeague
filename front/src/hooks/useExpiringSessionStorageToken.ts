import React from 'react';

type Stored = {
  expiresAt?: number;
  [k: string]: any;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useExpiringSessionStorageToken<T extends Stored>(key: string) {
  const [data, setData] = React.useState<T | null>(() => {
    const parsed = safeParse<T>(sessionStorage.getItem(key));
    if (!parsed) return null;
    // validation minimale
    if (parsed.expiresAt !== undefined && typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  });

  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
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

  React.useEffect(() => {
    if (!expired) return;
    clear();
  }, [expired, clear]);

  return { data, write, clear, expired, secondsRemaining, now };
}
