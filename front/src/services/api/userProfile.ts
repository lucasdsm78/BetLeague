// services/api/userProfile.ts
// API module: user profile (network + DTO typing)

import http, { type ApiResponse } from '../http';
import type { ApiUserProfile, ApiUpdateProfileData, ApiUpdateProfileResponse } from '../../types/api/profile';
import type { ApiDeleteMyAccountRequest, ApiDeleteMyAccountResponse } from '../../types/api/account';

export async function updateProfile(data: ApiUpdateProfileData): Promise<ApiUpdateProfileResponse> {
  const res: ApiResponse<ApiUpdateProfileResponse> = await http.put('/auth/user', data);
  if (!res.success) {
    throw new Error(res.error || 'Échec de la mise à jour du profil');
  }
  return res.data as ApiUpdateProfileResponse;
}

export async function checkPseudoAvailability(pseudo: string): Promise<boolean> {
  const res: ApiResponse<{ available: boolean }> = await http.get(`/auth/check-pseudo?pseudo=${encodeURIComponent(pseudo)}`);
  if (!res.success) {
    // fallback: laisser le serveur valider
    return true;
  }
  return res.data?.available ?? false;
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const res: ApiResponse<{ available: boolean }> = await http.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
  if (!res.success) {
    return true;
  }
  return res.data?.available ?? false;
}

export async function getCurrentUserProfile(): Promise<ApiUserProfile> {
  const res: ApiResponse<ApiUserProfile> = await http.get('/auth/me');
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Impossible de récupérer le profil utilisateur');
  }
  return res.data as ApiUserProfile;
}

export async function deleteMyAccount(payload: ApiDeleteMyAccountRequest): Promise<ApiDeleteMyAccountResponse> {
  const res: ApiResponse<ApiDeleteMyAccountResponse> = await http.delete('/auth/me', {
    body: JSON.stringify(payload),
  });

  if (!res.success || !res.data) {
    throw new Error(res.error || 'Suppression du compte impossible');
  }

  return res.data as ApiDeleteMyAccountResponse;
}
