import { ApiClientError } from './secureApiClient';

export class TwoFactorActionError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  sessionsRevoked?: boolean;
  reauthRequired?: boolean;

  constructor(message: string, opts: {
    status: number;
    code?: string;
    retryAfterSeconds?: number;
    attemptsRemaining?: number;
    sessionsRevoked?: boolean;
    reauthRequired?: boolean;
  }) {
    super(message);
    this.name = 'TwoFactorActionError';
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.attemptsRemaining = opts.attemptsRemaining;
    this.sessionsRevoked = opts.sessionsRevoked;
    this.reauthRequired = opts.reauthRequired;
  }
}

export function mapTwoFactorError(error: unknown): never {
  if (error instanceof ApiClientError) {
    const retryAfterRaw = error.headers['retry-after'];
    const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : undefined;
    const detail = (error.details as any)?.detail;
    const attemptsRemainingRaw = detail?.attempts_remaining;
    const attemptsRemaining = Number.isFinite(Number(attemptsRemainingRaw)) ? Number(attemptsRemainingRaw) : undefined;
    throw new TwoFactorActionError(error.message, {
      status: error.status,
      code: error.code,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
      attemptsRemaining,
      sessionsRevoked: !!detail?.sessions_revoked,
      reauthRequired: !!detail?.reauth_required,
    });
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error('Erreur 2FA inconnue');
}

