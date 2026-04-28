// services/api/userProfile.ts
// API module: user profile (network + DTO typing)

import http, { type ApiResponse } from '../http';
import type { ApiUserProfile, ApiUpdateProfileData, ApiUpdateProfileResponse } from '../../types/api/profile';
import type { ApiDeleteMyAccountRequest, ApiDeleteMyAccountResponse } from '../../types/api/account';
import type { ApiChangePasswordRequest, ApiChangePasswordResponse } from '../../types/api/changePassword';

export async function updateProfile(data: ApiUpdateProfileData): Promise<ApiUpdateProfileResponse> {
  const res: ApiResponse<ApiUpdateProfileResponse> = await http.put('/auth/user', data);
  if (!res.data) throw new Error('Échec de la mise à jour du profil');
  return res.data as ApiUpdateProfileResponse;
}

export async function checkPseudoAvailability(pseudo: string): Promise<boolean> {
  const res: ApiResponse<{ available: boolean }> = await http.get(`/auth/check-pseudo?pseudo=${encodeURIComponent(pseudo)}`);
  return res.data?.available ?? true;
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const res: ApiResponse<{ available: boolean }> = await http.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
  return res.data?.available ?? true;
}

export async function getCurrentUserProfile(): Promise<ApiUserProfile> {
  const res: ApiResponse<ApiUserProfile> = await http.get('/auth/me');
  if (!res.data) {
    throw new Error('Impossible de récupérer le profil utilisateur');
  }
  return res.data as ApiUserProfile;
}

export async function deleteMyAccount(payload: ApiDeleteMyAccountRequest): Promise<ApiDeleteMyAccountResponse> {
  const res: ApiResponse<ApiDeleteMyAccountResponse> = await http.delete('/auth/me', {
    body: JSON.stringify(payload),
  });

  if (!res.data) {
    throw new Error('Suppression du compte impossible');
  }

  return res.data as ApiDeleteMyAccountResponse;
}

export async function changeMyPassword(payload: ApiChangePasswordRequest): Promise<ApiChangePasswordResponse> {
  const res: ApiResponse<ApiChangePasswordResponse> = await http.post('/auth/change-password', payload);
  if (!res.data) throw new Error('Changement de mot de passe impossible');
  return res.data as ApiChangePasswordResponse;
}
