import { useCallback, useEffect, useRef, useState } from 'react';
import secureApiClient, { ApiResponse } from 'services/secureApiClient';

export interface UserProfile {
  id: number;
  email: string;
  pseudo: string;
  nb_win: number;
  nb_lose: number;
  nb_btl: number;
  is_tournament_subscriber?: boolean;
  is_two_factor_enabled?: boolean;
  tournament_creation_access?: {
    monthly_free_tournaments_limit: number;
    monthly_free_tournaments_used: number;
    monthly_free_tournaments_remaining: number;
    has_active_subscription: boolean;
    can_create_tournament: boolean;
    requires_tournament_subscription: boolean;
  };
}

export interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
}

// Récupère le profil de l'utilisateur connecté via le token
async function getCurrentUserProfile(): Promise<UserProfile> {
  // ✅ Preferred secure path: backend endpoint returns only current user
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
    };
  }

  // Hard fail with a clear message (no more /auth/users usage)
  // Optionally call /auth/validate to produce a better error for the user.
  const validateRes: ApiResponse<any> = await secureApiClient.get('/auth/validate');
  if (!validateRes.success) {
    throw new Error(validateRes.error || 'Session invalide. Veuillez vous reconnecter.');
  }
  throw new Error('Impossible de charger votre profil (endpoint /auth/me indisponible).');
}

export function useUserProfile(): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const data = await getCurrentUserProfile();
      setProfile(data);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchProfile]);

  return { profile, loading, error, refetch, lastUpdated };
}
