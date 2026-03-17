import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_PREFIX = 'betleague:2fa:activation:';
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_COOLDOWN_SECONDS = 60;
const MAX_COOLDOWN_SECONDS = 15 * 60;

export interface TwoFactorAttemptLimiterState {
  attempts: number;
  lockedUntil: number | null;
  penaltyLevel: number;
}

export interface TwoFactorAttemptLimiterOptions {
  storageKey: string;
  maxAttempts?: number;
  baseCooldownSeconds?: number;
}

const EMPTY_STATE: TwoFactorAttemptLimiterState = {
  attempts: 0,
  lockedUntil: null,
  penaltyLevel: 0,
};

function clampCooldown(seconds: number) {
  return Math.max(1, Math.min(seconds, MAX_COOLDOWN_SECONDS));
}

function sanitizeState(raw: unknown, now = Date.now()): TwoFactorAttemptLimiterState {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_STATE };
  }

  const data = raw as Partial<TwoFactorAttemptLimiterState>;
  const attempts = Number.isFinite(data.attempts) ? Math.max(0, Number(data.attempts)) : 0;
  const lockedUntil = Number.isFinite(data.lockedUntil) ? Number(data.lockedUntil) : null;
  const penaltyLevel = Number.isFinite(data.penaltyLevel) ? Math.max(0, Number(data.penaltyLevel)) : 0;

  if (lockedUntil && lockedUntil <= now) {
    return {
      attempts: 0,
      lockedUntil: null,
      penaltyLevel,
    };
  }

  return {
    attempts,
    lockedUntil,
    penaltyLevel,
  };
}

function readState(storageKey: string): TwoFactorAttemptLimiterState {
  if (typeof window === 'undefined') return { ...EMPTY_STATE };

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return { ...EMPTY_STATE };
    return sanitizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writeState(storageKey: string, state: TwoFactorAttemptLimiterState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(state));
  } catch {
    // ignore storage quota / privacy mode failures
  }
}

export function clearTwoFactorAttemptLimiter(storageKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
  } catch {
    // ignore storage failures
  }
}

export function computeNextAttemptLimiterState(
  current: TwoFactorAttemptLimiterState,
  opts: { maxAttempts?: number; baseCooldownSeconds?: number; now?: number; serverRetryAfterSeconds?: number }
): TwoFactorAttemptLimiterState {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseCooldownSeconds = Math.max(1, opts.baseCooldownSeconds ?? DEFAULT_BASE_COOLDOWN_SECONDS);
  const now = opts.now ?? Date.now();
  const currentState = sanitizeState(current, now);

  const serverRetryAfterSeconds = Number(opts.serverRetryAfterSeconds ?? 0);
  if (serverRetryAfterSeconds > 0) {
    return {
      attempts: 0,
      lockedUntil: now + clampCooldown(serverRetryAfterSeconds) * 1000,
      penaltyLevel: Math.max(1, currentState.penaltyLevel),
    };
  }

  const nextAttempts = currentState.attempts + 1;
  if (nextAttempts < maxAttempts) {
    return {
      ...currentState,
      attempts: nextAttempts,
      lockedUntil: null,
    };
  }

  const nextPenaltyLevel = currentState.penaltyLevel + 1;
  const cooldownSeconds = clampCooldown(baseCooldownSeconds * Math.pow(2, nextPenaltyLevel - 1));

  return {
    attempts: 0,
    lockedUntil: now + cooldownSeconds * 1000,
    penaltyLevel: nextPenaltyLevel,
  };
}

export function useTwoFactorAttemptLimiter({
  storageKey,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseCooldownSeconds = DEFAULT_BASE_COOLDOWN_SECONDS,
}: TwoFactorAttemptLimiterOptions) {
  const [state, setState] = useState<TwoFactorAttemptLimiterState>(() => readState(storageKey));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const next = readState(storageKey);
    setState(next);
    setNow(Date.now());
  }, [storageKey]);

  useEffect(() => {
    writeState(storageKey, state);
  }, [storageKey, state]);

  useEffect(() => {
    if (!state.lockedUntil || state.lockedUntil <= Date.now()) {
      if (state.lockedUntil && state.lockedUntil <= Date.now()) {
        setState((prev) => sanitizeState(prev, Date.now()));
      }
      return undefined;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
      setState((prev) => sanitizeState(prev, Date.now()));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state.lockedUntil]);

  const registerFailure = useCallback((serverRetryAfterSeconds?: number) => {
    setState((prev) => computeNextAttemptLimiterState(prev, {
      maxAttempts,
      baseCooldownSeconds,
      serverRetryAfterSeconds,
    }));
    setNow(Date.now());
  }, [baseCooldownSeconds, maxAttempts]);

  const reset = useCallback(() => {
    clearTwoFactorAttemptLimiter(storageKey);
    setState({ ...EMPTY_STATE });
    setNow(Date.now());
  }, [storageKey]);

  const remainingSeconds = useMemo(() => {
    if (!state.lockedUntil || state.lockedUntil <= now) return 0;
    return Math.ceil((state.lockedUntil - now) / 1000);
  }, [state.lockedUntil, now]);

  const isBlocked = remainingSeconds > 0;
  const attemptsRemaining = useMemo(() => {
    if (isBlocked) return 0;
    return Math.max(0, maxAttempts - state.attempts);
  }, [isBlocked, maxAttempts, state.attempts]);

  return {
    attemptsUsed: state.attempts,
    attemptsRemaining,
    isBlocked,
    remainingSeconds,
    penaltyLevel: state.penaltyLevel,
    registerFailure,
    reset,
  };
}

