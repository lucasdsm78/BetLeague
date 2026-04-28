// services/api/profile.ts
// API module: profile/user (network + DTO typing)

import http, { type ApiResponse } from '../http';
import type { ApiUpdateUserPayload, ApiUpdateUserResponse, ApiUserProfile } from '../../types/api/profile';

export async function updateUserProfile(payload: ApiUpdateUserPayload): Promise<ApiUserProfile> {
  const res: ApiResponse<ApiUpdateUserResponse | ApiUserProfile> = await http.put('/auth/user', payload);

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
    tournament_creation_access: user.tournament_creation_access
      ? {
          monthly_free_tournaments_limit: Number(user.tournament_creation_access.monthly_free_tournaments_limit ?? 0),
          monthly_free_tournaments_used: Number(user.tournament_creation_access.monthly_free_tournaments_used ?? 0),
          monthly_free_tournaments_remaining: Number(user.tournament_creation_access.monthly_free_tournaments_remaining ?? 0),
          has_active_subscription: Boolean(user.tournament_creation_access.has_active_subscription ?? false),
          can_create_tournament: Boolean(user.tournament_creation_access.can_create_tournament ?? false),
          requires_tournament_subscription: Boolean(user.tournament_creation_access.requires_tournament_subscription ?? false),
        }
      : undefined,
  };
}
