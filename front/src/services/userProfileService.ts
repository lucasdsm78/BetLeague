/**
 * User Profile Service - Gestion sécurisée du profil utilisateur
 * Handles profile data updates with validation and error handling
 */

import secureApiClient, { ApiResponse } from './secureApiClient';

export interface UpdateProfileData {
  pseudo?: string;
  email?: string;
}

export interface UpdateProfileResponse {
  message: string;
  user?: {
    id: number;
    email: string;
    pseudo: string;
    nb_win: number;
    nb_lose: number;
    nb_btl: number;
  };
}

class UserProfileService {
  /**
   * Met à jour le profil de l'utilisateur connecté
   * @param data - Données à mettre à jour (pseudo et/ou email)
   * @returns Response avec les données mises à jour
   */
  async updateProfile(data: UpdateProfileData): Promise<ApiResponse<UpdateProfileResponse>> {
    // Validation côté client
    this.validateUpdateData(data);

    try {
      const response = await secureApiClient.put<UpdateProfileResponse>('/auth/user', data);

      if (!response.success) {
        throw new Error(response.error || 'Échec de la mise à jour du profil');
      }

      return response;
    } catch (error: any) {
      console.error('❌ Profile update error:', error);
      throw error;
    }
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
      const response = await secureApiClient.get<{ available: boolean }>(
        `/auth/check-pseudo?pseudo=${encodeURIComponent(pseudo)}`
      );

      return response.data?.available ?? false;
    } catch (error) {
      console.warn('Impossible de vérifier la disponibilité du pseudo:', error);
      return true; // En cas d'erreur, on laisse le serveur valider
    }
  }

  /**
   * Vérifie la disponibilité d'un email
   * @param email - Email à vérifier
   * @returns true si disponible, false sinon
   */
  async checkEmailAvailability(email: string): Promise<boolean> {
    try {
      const response = await secureApiClient.get<{ available: boolean }>(
        `/auth/check-email?email=${encodeURIComponent(email)}`
      );

      return response.data?.available ?? false;
    } catch (error) {
      console.warn('Impossible de vérifier la disponibilité de l\'email:', error);
      return true; // En cas d'erreur, on laisse le serveur valider
    }
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService();

export default userProfileService;
