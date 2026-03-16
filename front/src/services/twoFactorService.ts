/**
 * Two-Factor Authentication (2FA) Service
 * Gère l'activation et la vérification 2FA côté client via secureApiClient
 */

import http from './http';
import type { ApiResponse } from './http';
import { ApiClientError } from './secureApiClient';
import type {
  ApiTwoFactorSetupRawResponse,
  ApiTwoFactorStatusResponse,
  ApiDisableTwoFactorPayload,
  ApiDisableTwoFactorResponse,
  ApiTwoFactorVerifyPayload,
} from '../types/api/profile';
import type { TwoFactorSetup, TwoFactorStatus, DisableTwoFactorPayload } from '../types/entities/twoFactor';
import { mapApiTwoFactorSetupToUi } from './mappers/twoFactorMapper';

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

function mapTwoFactorError(error: unknown): never {
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

async function enableTwoFactor(): Promise<TwoFactorSetup> {
  try {
    const res: ApiResponse<ApiTwoFactorSetupRawResponse> = await http.post('/auth/user/enable-2fa');
    if (!res.data) {
      throw new Error("Échec de l'activation 2FA");
    }
    return mapApiTwoFactorSetupToUi(res.data);
  } catch (error) {
    return mapTwoFactorError(error);
  }
}

async function verifyTwoFactor(code: string): Promise<TwoFactorStatus> {
  const clean = (code || '').trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new Error('Code 2FA invalide');
  }

  try {
    const payload: ApiTwoFactorVerifyPayload = { code: clean };
    const res: ApiResponse<ApiTwoFactorStatusResponse> = await http.post('/auth/user/verify-2fa', payload);
    return {
      enabled: !!res.data?.enabled,
      message: res.data?.message,
      attemptsRemaining: res.data?.attempts_remaining,
    };
  } catch (error) {
    return mapTwoFactorError(error);
  }
}

async function disableTwoFactor(payload: DisableTwoFactorPayload): Promise<TwoFactorStatus> {
  const cleanCode = (payload.code || '').trim();
  const currentPassword = (payload.currentPassword || '').trim();

  if (currentPassword.length < 8) {
    throw new Error('Entrez votre mot de passe actuel');
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Code 2FA invalide');
  }

  try {
    const dto: ApiDisableTwoFactorPayload = {
      current_password: currentPassword,
      code: cleanCode,
    };
    const res: ApiResponse<ApiDisableTwoFactorResponse> = await http.post('/auth/user/disable-2fa', dto);
    return {
      enabled: !!res.data?.enabled,
      message: res.data?.message,
      sessionsRevoked: !!res.data?.sessions_revoked,
      reauthRequired: !!res.data?.reauth_required,
    };
  } catch (error) {
    return mapTwoFactorError(error);
  }
}

export default { enableTwoFactor, verifyTwoFactor, disableTwoFactor };
