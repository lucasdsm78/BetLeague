// Service utilisateur - mise à jour sécurisée du profil
import { updateUserProfile as apiUpdateUserProfile, type ApiUpdateUserPayload } from './api/profile';
import enhancedAuthService from './authService.enhanced';
import { useAuthStore } from '../store/authStore';

export interface UpdateUserPayload { pseudo?: string; email?: string; }
export interface UpdateUserResponse { success: boolean; message?: string; user?: any; }

function sanitizePseudo(pseudo: string): string { return pseudo.trim(); }
function validateEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export async function updateUserProfile(data: UpdateUserPayload): Promise<UpdateUserResponse> {
  const payload: ApiUpdateUserPayload = {};
  if (data.pseudo) payload.pseudo = sanitizePseudo(data.pseudo);
  if (data.email) {
    if (!validateEmail(data.email)) {
      return { success: false, message: 'Format email invalide' };
    }
    payload.email = data.email.trim();
  }

  try {
    const updated = await apiUpdateUserProfile(payload);

    // Màj store local (optimiste sécurisée)
    const auth = useAuthStore.getState();
    auth.updateUser({
      pseudo: updated?.pseudo || payload.pseudo,
      email: updated?.email || payload.email,
    });

    // Resynchroniser profil et claims (ex: email modifié)
    await enhancedAuthService.forceRefresh().catch(() => {});
    await (enhancedAuthService as any).fetchUserProfile().catch(() => {});

    return { success: true, message: 'Profil mis à jour', user: updated };
  } catch (e: any) {
    const msg = e?.message || 'Échec de la mise à jour du profil';
    return { success: false, message: msg };
  }
}

export default { updateUserProfile };
