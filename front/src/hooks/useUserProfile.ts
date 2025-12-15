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
  // D'abord valider le token pour obtenir l'ID utilisateur
  const validateRes: ApiResponse<any> = await secureApiClient.get('/auth/validate');
  if (!validateRes.success) {
    throw new Error(validateRes.error || 'Validation échouée');
  }

  // Récupérer l'ID depuis le token (plus stable que l'email)
  const userId = validateRes.data?.user?.id || validateRes.data?.user?.user_id || validateRes.data?.user?.uuid;

  // Fallback: si pas d'ID, utiliser l'email (pour compatibilité)
  const email = validateRes.data?.user?.email;

  if (!userId && !email) {
    throw new Error('Impossible d\'identifier l\'utilisateur dans le token');
  }

  // Chercher l'utilisateur dans la liste
  const usersRes: ApiResponse<any> = await secureApiClient.get('/auth/users');
  if (!usersRes.success) {
    throw new Error(usersRes.error || 'Récupération des utilisateurs échouée');
  }

  const users = usersRes.data?.users || [];

  // Chercher par ID en priorité, sinon par email
  let currentUser;
  if (userId) {
    currentUser = users.find((u: any) =>
      u.id === userId || u.user_id === userId || u.uuid === userId
    );
  }

  // Fallback sur email si pas trouvé par ID
  if (!currentUser && email) {
    currentUser = users.find((u: any) => u.email === email);
  }

  if (!currentUser) {
    throw new Error('Utilisateur non trouvé');
  }

  return {
    id: currentUser.id,
    email: currentUser.email,
    pseudo: currentUser.pseudo,
    nb_win: currentUser.nb_win || 0,
    nb_lose: currentUser.nb_lose || 0,
    nb_btl: currentUser.nb_btl || 0,
    is_tournament_subscriber: currentUser.is_tournament_subscriber || false
  };
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
