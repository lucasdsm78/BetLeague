/**
 * Two-Factor Authentication (2FA) Service
 * Gère l'activation et la vérification 2FA côté client via secureApiClient
 */

import http from './http';
import type { ApiResponse } from './http';
import type {
  ApiTwoFactorSetupRawResponse,
  ApiTwoFactorStatusResponse,
  ApiDisableTwoFactorPayload,
  ApiDisableTwoFactorResponse,
  ApiTwoFactorVerifyPayload,
} from '../types/api/profile';
import type { TwoFactorSetup } from '../types/entities/twoFactor';
import type { DisableTwoFactorPayload, TwoFactorStatus } from './twoFactorService.types';
import { mapApiTwoFactorSetupToUi } from './mappers/twoFactorMapper';
import { mapTwoFactorError } from './twoFactorService.errors';

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
