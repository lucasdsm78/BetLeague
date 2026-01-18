// services/api/profile.ts
// API module: profile/user (network + DTO typing)

import http, { type ApiResponse } from '../http';
import type { ApiUserProfile } from '../../types/api/profile';

export interface ApiUpdateUserPayload {
  pseudo?: string;
  email?: string;
}

export interface ApiUpdateUserResponse {
  message?: string;
  user?: ApiUserProfile;
  // certains back renvoient directement le user
  id?: number;
  email?: string;
  pseudo?: string;
}

export async function updateUserProfile(payload: ApiUpdateUserPayload): Promise<ApiUserProfile> {
  const res: ApiResponse<ApiUpdateUserResponse | ApiUserProfile> = await http.put('/auth/user', payload);
  if (!res.success) {
    throw new Error(res.error || 'Échec de la mise à jour du profil');
  }

  const data: any = res.data;
  const user = data?.user ?? data;
  if (!user || typeof user !== 'object') {
    throw new Error('Format de réponse invalide');
  }

  // Hardening minimal
  return {
    id: Number(user.id),
    email: String(user.email ?? ''),
    pseudo: String(user.pseudo ?? ''),
    nb_win: Number(user.nb_win ?? 0),
    nb_lose: Number(user.nb_lose ?? 0),
    nb_btl: Number(user.nb_btl ?? 0),
    is_tournament_subscriber: !!user.is_tournament_subscriber,
    is_two_factor_enabled: !!user.is_two_factor_enabled,
  };
}

