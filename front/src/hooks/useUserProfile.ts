import { useCallback, useEffect, useRef, useState } from 'react';
import secureApiClient, { ApiResponse } from 'services/secureApiClient';

export interface UserProfile {
  id: number;
  email: string;
  pseudo: string;
  nb_win: number;
  nb_lose: number;
  nb_btl: number;
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
  // D'abord valider le token pour obtenir l'email
  const validateRes: ApiResponse<any> = await secureApiClient.get('/auth/validate');
  if (!validateRes.success) {
    throw new Error(validateRes.error || 'Validation échouée');
  }

  const email = validateRes.data?.user?.email;
  if (!email) {
    throw new Error('Email non trouvé dans le token');
  }

  // Ensuite chercher l'utilisateur par email pour obtenir son ID
  const usersRes: ApiResponse<any> = await secureApiClient.get('/auth/users');
  if (!usersRes.success) {
    throw new Error(usersRes.error || 'Récupération des utilisateurs échouée');
  }

  const users = usersRes.data?.users || [];
  const currentUser = users.find((u: any) => u.email === email);

  if (!currentUser) {
    throw new Error('Utilisateur non trouvé');
  }

  return {
    id: currentUser.id,
    email: currentUser.email,
    pseudo: currentUser.pseudo,
    nb_win: currentUser.nb_win || 0,
    nb_lose: currentUser.nb_lose || 0,
    nb_btl: currentUser.nb_btl || 0
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
