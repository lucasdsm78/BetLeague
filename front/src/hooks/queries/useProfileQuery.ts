import { useQuery } from '@tanstack/react-query';
import http, { type ApiResponse } from '../../services/http';
import { profileKeys } from './profileKeys';
import type { ApiUserProfile } from '../../types/api/profile';

async function fetchMe(): Promise<ApiUserProfile> {
  const meRes: ApiResponse<any> = await http.get('/auth/me');
  if (meRes.success && meRes.data) {
    const currentUser = meRes.data;
    return {
      id: Number(currentUser.id),
      email: String(currentUser.email || ''),
      pseudo: String(currentUser.pseudo || ''),
      nb_win: Number(currentUser.nb_win || 0),
      nb_lose: Number(currentUser.nb_lose || 0),
      nb_btl: Number(currentUser.nb_btl || 0),
      is_tournament_subscriber: Boolean(currentUser.is_tournament_subscriber || false),
      is_two_factor_enabled: Boolean(currentUser.is_two_factor_enabled || false),
      tournament_creation_access: currentUser.tournament_creation_access
        ? {
            monthly_free_tournaments_limit: Number(currentUser.tournament_creation_access.monthly_free_tournaments_limit ?? 0),
            monthly_free_tournaments_used: Number(currentUser.tournament_creation_access.monthly_free_tournaments_used ?? 0),
            monthly_free_tournaments_remaining: Number(currentUser.tournament_creation_access.monthly_free_tournaments_remaining ?? 0),
            has_active_subscription: Boolean(currentUser.tournament_creation_access.has_active_subscription ?? false),
            can_create_tournament: Boolean(currentUser.tournament_creation_access.can_create_tournament ?? false),
            requires_tournament_subscription: Boolean(currentUser.tournament_creation_access.requires_tournament_subscription ?? false),
          }
        : undefined,
      commerce_availability: currentUser.commerce_availability
        ? {
            shop_enabled: Boolean(currentUser.commerce_availability.shop_enabled ?? false),
            btl_purchase_enabled: Boolean(currentUser.commerce_availability.btl_purchase_enabled ?? false),
            tournament_subscription_enabled: Boolean(currentUser.commerce_availability.tournament_subscription_enabled ?? false),
          }
        : undefined,
    };
  }

  const validateRes: ApiResponse<any> = await http.get('/auth/validate');
  if (!validateRes.success) {
    throw new Error(validateRes.error || 'Session invalide. Veuillez vous reconnecter.');
  }
  throw new Error('Impossible de charger votre profil (endpoint /auth/me indisponible).');
}

export function useProfileMeQuery(options?: { enabled?: boolean; refetchIntervalMs?: number }) {
  return useQuery<ApiUserProfile, Error>({
    queryKey: profileKeys.me(),
    queryFn: fetchMe,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}
