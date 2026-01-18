import { useQuery } from '@tanstack/react-query';
import secureApiClient, { type ApiResponse } from '../../services/secureApiClient';
import { profileKeys } from './profileKeys';
import type { ApiUserProfile } from '../../types/api/profile';

async function fetchMe(): Promise<ApiUserProfile> {
  const meRes: ApiResponse<any> = await secureApiClient.get('/auth/me');
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
    };
  }

  const validateRes: ApiResponse<any> = await secureApiClient.get('/auth/validate');
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
