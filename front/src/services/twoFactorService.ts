/**
 * Two-Factor Authentication (2FA) Service
 * Gère l'activation et la vérification 2FA côté client via secureApiClient
 */

import http from './http';
import type { ApiResponse } from './http';
import type { ApiTwoFactorSetupRawResponse } from '../types/api/profile';
import type { TwoFactorSetup, TwoFactorStatus } from '../types/entities/twoFactor';
import { mapApiTwoFactorSetupToUi } from './mappers/twoFactorMapper';

async function enableTwoFactor(): Promise<TwoFactorSetup> {
  const res: ApiResponse<ApiTwoFactorSetupRawResponse> = await http.post('/auth/user/enable-2fa');
  if (!res.data) {
    throw new Error("Échec de l'activation 2FA");
  }
  return mapApiTwoFactorSetupToUi(res.data);
}

async function verifyTwoFactor(code: string): Promise<TwoFactorStatus> {
  const clean = (code || '').trim();
  if (!/^\d{4,8}$/.test(clean)) {
    throw new Error('Code 2FA invalide');
  }
  const endpoint = `/auth/user/verify-2fa?code=${encodeURIComponent(clean)}`;
  const res: ApiResponse<{ message?: string }> = await http.post(endpoint);
  return { enabled: true, message: res.data?.message };
}

export default { enableTwoFactor, verifyTwoFactor };
