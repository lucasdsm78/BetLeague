// Service utilisateur - mise à jour sécurisée du profil
import secureApiClient, { ApiResponse } from './secureApiClient';
import enhancedAuthService from './authService.enhanced';
import { useAuthStore } from '../store/authStore';

export interface UpdateUserPayload { pseudo?: string; email?: string; }
export interface UpdateUserResponse { success: boolean; message?: string; user?: any; }

function sanitizePseudo(pseudo: string): string { return pseudo.trim(); }
function validateEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export async function updateUserProfile(data: UpdateUserPayload): Promise<UpdateUserResponse> {
  const payload: UpdateUserPayload = {};
  if (data.pseudo) payload.pseudo = sanitizePseudo(data.pseudo);
  if (data.email) {
    if (!validateEmail(data.email)) {
      return { success: false, message: 'Format email invalide' };
    }
    payload.email = data.email.trim();
  }

  let res: ApiResponse<any>;
  try {
    res = await secureApiClient.put('/auth/user', payload);
  } catch (e: any) {
    // En cas d’Unauthorized, tenter un refresh puis réessayer
    if (e?.status === 401) {
      const refreshed = await enhancedAuthService.forceRefresh();
      if (refreshed) {
        res = await secureApiClient.put('/auth/user', payload);
      } else {
        return { success: false, message: 'Session expirée, reconnectez-vous.' };
      }
    } else {
      throw e;
    }
  }

  if (!res.success) {
    return { success: false, message: res.error || "Échec de la mise à jour du profil" };
  }

  const updated = res.data?.user || res.data;

  // Màj store local (optimiste sécurisée)
  const auth = useAuthStore.getState();
  auth.updateUser({
    pseudo: updated?.pseudo || payload.pseudo,
    email: updated?.email || payload.email,
  });

  // Resynchroniser profil et claims (ex: email modifié)
  // Forcer un refresh de token pour obtenir un JWT avec email à jour
  await enhancedAuthService.forceRefresh().catch(() => {});
  await (enhancedAuthService as any).fetchUserProfile().catch(() => {});

  return { success: true, message: updated?.message || 'Profil mis à jour', user: updated };
}

export default { updateUserProfile };
