import { computeNextThrottleState } from './useTwoFactorActivationThrottle';

describe('useTwoFactorActivationThrottle', () => {
  it('incrémente les tentatives tant que la limite n’est pas atteinte', () => {
    const next = computeNextThrottleState(
      { attempts: 1, lockedUntil: null, penaltyLevel: 0 },
      { maxAttempts: 5, baseCooldownSeconds: 60, now: 1_000 }
    );

    expect(next).toEqual({ attempts: 2, lockedUntil: null, penaltyLevel: 0 });
  });

  it('déclenche un cooldown exponentiel à la limite', () => {
    const next = computeNextThrottleState(
      { attempts: 4, lockedUntil: null, penaltyLevel: 0 },
      { maxAttempts: 5, baseCooldownSeconds: 60, now: 10_000 }
    );

    expect(next.attempts).toBe(0);
    expect(next.penaltyLevel).toBe(1);
    expect(next.lockedUntil).toBe(70_000);
  });

  it('augmente le cooldown au palier suivant', () => {
    const next = computeNextThrottleState(
      { attempts: 4, lockedUntil: null, penaltyLevel: 1 },
      { maxAttempts: 5, baseCooldownSeconds: 60, now: 10_000 }
    );

    expect(next.penaltyLevel).toBe(2);
    expect(next.lockedUntil).toBe(130_000);
  });

  it('respecte un Retry-After serveur quand présent', () => {
    const next = computeNextThrottleState(
      { attempts: 2, lockedUntil: null, penaltyLevel: 0 },
      { maxAttempts: 5, baseCooldownSeconds: 60, now: 5_000, serverRetryAfterSeconds: 90 }
    );

    expect(next.attempts).toBe(0);
    expect(next.penaltyLevel).toBe(1);
    expect(next.lockedUntil).toBe(95_000);
  });
});

