import secureApiClient, { ApiResponse } from './secureApiClient';

export interface UpdateLeagueData {
  name: string; // Obligatoire
  max_players: number; // Obligatoire
  start_date: number; // Obligatoire (timestamp Unix en secondes)
  is_private?: boolean; // Optionnel
  is_free?: boolean; // Optionnel
  nb_btl?: number; // Optionnel
}

export interface UpdateLeagueResponse {
  message: string;
  league?: {
    id: number;
    name: string;
    max_players: number;
    is_private: boolean;
    is_free: boolean;
    nb_btl?: number;
    start_date: number;
    is_started: boolean;
  };
}

class LeagueUpdateService {
  /**
   * Met à jour une ligue (uniquement pour le créateur)
   * @param leagueId - ID de la ligue à modifier
   * @param data - Données à mettre à jour
   * @returns Response avec les données mises à jour
   */
  async updateLeague(
    leagueId: number,
    data: UpdateLeagueData
  ): Promise<ApiResponse<UpdateLeagueResponse>> {
    // Validation côté client
    this.validateUpdateData(data);

    try {
      console.log('🔄 Updating league:', { leagueId, data });

      const response = await secureApiClient.put<UpdateLeagueResponse>(
        `/league/${leagueId}`,
        data
      );

      console.log('📥 League update response:', response);

      if (!response.success) {
        // Gérer les différents formats d'erreur
        let errorMessage = 'Échec de la mise à jour de la ligue';

        if (response.error) {
          console.log('🔍 Error details:', response.error);

          if (typeof response.error === 'string') {
            errorMessage = response.error;
          } else if (Array.isArray(response.error)) {
            // Si c'est un tableau d'erreurs (validation backend)
            const errors = response.error as any[];
            console.log('🔍 Validation errors:', errors);

            errorMessage = errors.map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.msg) {
                // Inclure le champ concerné si disponible
                const field = err.loc ? err.loc.join('.') : '';
                return field ? `${field}: ${err.msg}` : err.msg;
              }
              if (err.message) return err.message;
              return JSON.stringify(err);
            }).join(', ');
          } else if (typeof response.error === 'object') {
            // Si c'est un objet d'erreur
            const errObj = response.error as any;
            errorMessage = errObj.message ||
                          errObj.detail ||
                          JSON.stringify(response.error);
          }
        }

        throw new Error(errorMessage);
      }

      return response;
    } catch (error: any) {
      console.error('❌ League update error:', error);

      // S'assurer que l'erreur a un message lisible
      if (error.message && typeof error.message === 'string') {
        throw error;
      } else {
        throw new Error('Une erreur est survenue lors de la mise à jour de la ligue');
      }
    }
  }

  /**
   * Valide les données avant l'envoi
   */
  private validateUpdateData(data: UpdateLeagueData): void {
    // Validation du nom
    if (data.name !== undefined) {
      const name = data.name.trim();

      if (!name) {
        throw new Error('Le nom de la ligue ne peut pas être vide');
      }

      if (name.length < 3) {
        throw new Error('Le nom doit contenir au moins 3 caractères');
      }

      if (name.length > 100) {
        throw new Error('Le nom ne peut pas dépasser 100 caractères');
      }

      if (!/^[a-zA-Z0-9\s\-_À-ÿ]+$/.test(name)) {
        throw new Error(
          'Le nom contient des caractères non autorisés. Utilisez uniquement des lettres, chiffres, espaces, tirets et underscores.'
        );
      }
    }

    // Validation du nombre maximum de joueurs
    if (data.max_players !== undefined) {
      if (!Number.isInteger(data.max_players) || data.max_players < 2) {
        throw new Error('Le nombre minimum de participants est 2');
      }

      if (data.max_players > 200) {
        throw new Error('Le nombre maximum de participants est 200');
      }
    }

    // Validation des BTL (si ligue payante)
    if (data.is_free === false && data.nb_btl !== undefined) {
      if (!Number.isInteger(data.nb_btl) || data.nb_btl <= 0) {
        throw new Error('Le montant BTL doit être un nombre positif');
      }

      if (data.nb_btl > 10000) {
        throw new Error('Le montant BTL ne peut pas dépasser 10000');
      }
    }

    // Vérifier que les champs obligatoires sont présents
    if (!data.name) {
      throw new Error('Le nom de la ligue est requis');
    }

    if (data.max_players === undefined || data.max_players === null) {
      throw new Error('Le nombre maximum de joueurs est requis');
    }

    if (data.start_date === undefined || data.start_date === null) {
      throw new Error('La date de début est requise');
    }
  }

  /**
   * Vérifie si un nom de ligue est disponible
   * @param name - Nom à vérifier
   * @returns true si disponible, false sinon
   */
  async checkLeagueNameAvailability(name: string): Promise<boolean> {
    try {
      const response = await secureApiClient.get<{ available: boolean }>(
        `/league/check-name?name=${encodeURIComponent(name)}`
      );

      return response.data?.available ?? true;
    } catch (error) {
      console.warn('Impossible de vérifier la disponibilité du nom:', error);
      return true; // En cas d'erreur, on laisse le serveur valider
    }
  }
}

// Export singleton instance
export const leagueUpdateService = new LeagueUpdateService();

export default leagueUpdateService;
