/**
 * User Profile Service - Gestion sécurisée du profil utilisateur
 * Handles profile data updates with validation and error handling
 */

import { useAuthStore } from '../store/authStore';
import {
  updateProfile as apiUpdateProfile,
  checkPseudoAvailability as apiCheckPseudoAvailability,
  checkEmailAvailability as apiCheckEmailAvailability,
  getCurrentUserProfile as apiGetCurrentUserProfile,
  type ApiUpdateProfileData,
  type ApiUpdateProfileResponse,
} from './api/userProfile';

export interface UpdateProfileData {
  pseudo?: string;
  email?: string;
}

export interface UpdateProfileResponse extends ApiUpdateProfileResponse {}

class UserProfileService {
  /**
   * Met à jour le profil de l'utilisateur connecté
   * @param data - Données à mettre à jour (pseudo et/ou email)
   * @returns Response avec les données mises à jour
   */
  async updateProfile(data: UpdateProfileData) {
    // Validation côté client
    this.validateUpdateData(data);

    const response = await apiUpdateProfile(data as ApiUpdateProfileData);

    // Mettre à jour le store avec les nouvelles données si disponibles
    const authStore = useAuthStore.getState();
    if (authStore.user) {
      authStore.updateUser({
        ...authStore.user,
        ...(data.pseudo ? { pseudo: data.pseudo } : {}),
        ...(data.email ? { email: data.email } : {}),
      });
    }

    return {
      success: true,
      data: response,
      status: 200,
      headers: {},
    };
  }

  /**
   * Valide les données avant l'envoi
   */
  private validateUpdateData(data: UpdateProfileData): void {
    // Validation du pseudo
    if (data.pseudo !== undefined) {
      const pseudo = data.pseudo.trim();

      if (!pseudo) {
        throw new Error('Le pseudo ne peut pas être vide');
      }

      if (pseudo.length < 2) {
        throw new Error('Le pseudo doit contenir au moins 2 caractères');
      }

      if (pseudo.length > 50) {
        throw new Error('Le pseudo ne peut pas dépasser 50 caractères');
      }

      if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(pseudo)) {
        throw new Error('Le pseudo contient des caractères non autorisés. Utilisez uniquement des lettres, chiffres, espaces, tirets, underscores et points.');
      }
    }

    // Validation de l'email
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();

      if (!email) {
        throw new Error('L\'email ne peut pas être vide');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Format d\'email invalide');
      }

      if (email.length > 320) {
        throw new Error('L\'email est trop long (maximum 320 caractères)');
      }
    }

    // Au moins un champ doit être fourni
    if (!data.pseudo && !data.email) {
      throw new Error('Aucune donnée à mettre à jour');
    }
  }

  /**
   * Vérifie la disponibilité d'un pseudo
   * @param pseudo - Pseudo à vérifier
   * @returns true si disponible, false sinon
   */
  async checkPseudoAvailability(pseudo: string): Promise<boolean> {
    try {
      return await apiCheckPseudoAvailability(pseudo);
    } catch {
      return true;
    }
  }

  /**
   * Vérifie la disponibilité d'un email
   * @param email - Email à vérifier
   * @returns true si disponible, false sinon
   */
  async checkEmailAvailability(email: string): Promise<boolean> {
    try {
      return await apiCheckEmailAvailability(email);
    } catch {
      return true;
    }
  }

  /**
   * Récupère le profil complet de l'utilisateur connecté
   * Inclut nb_btl, nb_win, nb_lose, etc.
   * @returns Le profil utilisateur complet
   */
  async fetchCurrentUserProfile() {
    try {
      const profile = await apiGetCurrentUserProfile();

      const authStore = useAuthStore.getState();
      if (authStore.user) {
        authStore.updateUser({
          ...authStore.user,
          ...profile,
          id: String(profile.id),
          btlBalance: profile.nb_btl,
        });
      }

      return {
        success: true,
        data: profile,
        status: 200,
        headers: {},
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur lors de la récupération du profil utilisateur',
        status: 500,
        headers: {},
      };
    }
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService();

export default userProfileService;
