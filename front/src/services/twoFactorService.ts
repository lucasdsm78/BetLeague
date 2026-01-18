/**
 * Two-Factor Authentication (2FA) Service
 * Gère l'activation et la vérification 2FA côté client via secureApiClient
 */

import http from './http';
import type { ApiResponse } from './http';
import type { ApiTwoFactorSetupResponse } from '../types/api/profile';

export interface TwoFactorStatus { enabled: boolean; message?: string; }

async function enableTwoFactor(): Promise<ApiTwoFactorSetupResponse> {
  const res: ApiResponse<Blob> = await http.post('/auth/user/enable-2fa');
  if (!res.success || !res.data) {
    throw new Error(res.error || "Échec de l'activation 2FA");
  }
  // Convertir le blob PNG en data URL
  const blob = res.data as Blob;
  const qr_code = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { qr_code };
}

async function verifyTwoFactor(code: string): Promise<TwoFactorStatus> {
  const clean = (code || '').trim();
  if (!/^\d{4,8}$/.test(clean)) {
    throw new Error('Code 2FA invalide');
  }
  // Le backend attend le paramètre "code" en query string, pas en body
  const endpoint = `/auth/user/verify-2fa?code=${encodeURIComponent(clean)}`;
  const res: ApiResponse<any> = await http.post(endpoint);
  if (!res.success) {
    throw new Error(res.error || 'Vérification 2FA échouée');
  }
  return { enabled: true, message: (res.data as any)?.message };
}

export default { enableTwoFactor, verifyTwoFactor };
