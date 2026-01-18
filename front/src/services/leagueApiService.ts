/**
 * League API Service - Secure TypeScript integration with backend
 * Optimized for React, mobile-first, security, and performance
 */

import type { LeagueSummary } from 'types/entities/league';
import { type LeaguesPage } from './leaguesPaging';
import type {
  ApiLeagueCreateRequest,
  ApiLeagueMessageResponse,
  ApiLeagueBalancesBulkResponse,
  ApiLeagueBalanceResponse,
  ApiLeagueRankingRow,
  ApiInvitationReceived,
} from '../types/api/leagues';
import type { UserSearchResult } from '../types/entities/userSearch';
import type { InvitationActionResponse } from './api/leagues';
import {
  createLeague as apiCreateLeague,
  getAvailableLeaguesPage as apiGetAvailableLeaguesPage,
  getCreatedLeaguesPage as apiGetCreatedLeaguesPage,
  getParticipatedLeaguesPage as apiGetParticipatedLeaguesPage,
  joinLeague as apiJoinLeague,
  getReceivedInvitations as apiGetReceivedInvitations,
  updateInvitation as apiUpdateInvitation,
  getLeagueDetails as apiGetLeagueDetails,
  searchUsers as apiSearchUsers,
  inviteUserToLeague as apiInviteUserToLeague,
  getLeagueRanking as apiGetLeagueRanking,
  leaveLeague as apiLeaveLeague,
  getLeaguesBalancesBulk as apiGetLeaguesBalancesBulk,
  getLeagueBalanceResponse as apiGetLeagueBalance,
} from './api/leagues';

export interface LeagueCreateFormData {
  name: string;
  type: 'public' | 'private';
  maxMembers: number;
  entryFee: number;
  description?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// NOTE: ce service construit des objets "success/data/error" pour la UI.
// Le type ApiResponse (secureApiClient) inclut status/headers et reste réservé au client HTTP.

export interface LegacyApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class LeagueApiService {
  /**
   * Validate league name with enhanced security checks
   */
  public validateLeagueName(name: string): ValidationResult {
    if (!name || typeof name !== 'string') {
      return { isValid: false, error: 'Le nom est requis' };
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      return { isValid: false, error: 'Minimum 3 caractères requis' };
    }

    if (trimmedName.length > 50) {
      return { isValid: false, error: 'Maximum 50 caractères autorisés' };
    }

    // Enhanced security: check for forbidden characters and patterns
    const forbiddenChars = /[<>\/\\&"'`]/;
    if (forbiddenChars.test(trimmedName)) {
      return { isValid: false, error: 'Caractères non autorisés détectés' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = /(script|javascript|eval|onclick|onerror)/i;
    if (suspiciousPatterns.test(trimmedName)) {
      return { isValid: false, error: 'Nom de ligue non autorisé' };
    }

    // Check for excessive whitespace
    if (trimmedName !== trimmedName.replace(/\s+/g, ' ')) {
      return { isValid: false, error: 'Espaces multiples non autorisés' };
    }

    return { isValid: true };
  }

  /**
   * Create a new league with enhanced validation and security
   */
  public async createLeague(formData: LeagueCreateFormData): Promise<LegacyApiResponse<ApiLeagueMessageResponse>> {
    try {
      const nameValidation = this.validateLeagueName(formData.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error);
      }

      if (!Number.isInteger(formData.maxMembers) || formData.maxMembers < 2 || formData.maxMembers > 200) {
        throw new Error('Le nombre de participants doit être entre 2 et 200');
      }

      if (!Number.isInteger(formData.entryFee) || formData.entryFee < 0 || formData.entryFee > 10000) {
        throw new Error("La mise d'entrée doit être entre 0 et 10000 BTL");
      }

      if (formData.description && formData.description.length > 500) {
        throw new Error('La description ne peut pas dépasser 500 caractères');
      }

      const payload: ApiLeagueCreateRequest = {
        name: formData.name.trim(),
        max_players: formData.maxMembers,
        is_private: formData.type === 'private',
        is_free: formData.entryFee === 0,
        nb_btl: formData.entryFee > 0 ? formData.entryFee : undefined,
      };

      const response = await apiCreateLeague(payload);

      return {
        success: true,
        data: response,
        message: response.message || 'Ligue créée avec succès !',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur lors de la création de la ligue',
      };
    }
  }

  /**
   * Nouvelle API paginée - Ligues disponibles
   */
  public async getAvailableLeaguesPage(page = 1, pageSize = 10): Promise<LegacyApiResponse<LeaguesPage>> {
    try {
      const data = await apiGetAvailableLeaguesPage(page, pageSize);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des ligues disponibles' };
    }
  }

  /** Nouvelle API paginée - Ligues créées */
  public async getCreatedLeaguesPage(page = 1, pageSize = 10): Promise<LegacyApiResponse<LeaguesPage>> {
    try {
      const data = await apiGetCreatedLeaguesPage(page, pageSize);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des ligues créées' };
    }
  }

  /** Nouvelle API paginée - Ligues rejointes */
  public async getParticipatedLeaguesPage(page = 1, pageSize = 10): Promise<LegacyApiResponse<LeaguesPage>> {
    try {
      const data = await apiGetParticipatedLeaguesPage(page, pageSize);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des ligues rejointes' };
    }
  }

  /**
   * Get available leagues (public leagues user can join)
   */
  public async getAvailableLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string }> {
    try {
      const res = await this.getAvailableLeaguesPage(1, 50);
      if (!res.success || !res.data) return { success: false, error: res.error };
      return { success: true, data: { leagues: res.data.leagues } };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors du chargement des ligues disponibles' };
    }
  }

  /**
   * Get leagues created by the user
   */
  public async getCreatedLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string }> {
    try {
      const res = await this.getCreatedLeaguesPage(1, 50);
      if (!res.success || !res.data) return { success: false, error: res.error };
      return { success: true, data: { leagues: res.data.leagues } };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors du chargement des ligues créées' };
    }
  }

  /** Compat: ligues rejointes (1ère page) */
  public async getParticipatedLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string }> {
    try {
      const res = await this.getParticipatedLeaguesPage(1, 50);
      if (!res.success || !res.data) return { success: false, error: res.error };
      return { success: true, data: { leagues: res.data.leagues } };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors du chargement des ligues rejointes' };
    }
  }

  /**
   * Join a league by ID
   */
  public async joinLeague(leagueId: number): Promise<LegacyApiResponse<ApiLeagueMessageResponse>> {
    try {
      const data = await apiJoinLeague(leagueId);
      return { success: true, data, message: data.message || 'Vous avez rejoint la ligue !' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors de la tentative de rejoindre la ligue' };
    }
  }

  /**
   * Get received invitations with enhanced error handling
   */
  public async getReceivedInvitations(): Promise<LegacyApiResponse<ApiInvitationReceived[]>> {
    try {
      const data = await apiGetReceivedInvitations();
      return { success: true, data, message: data.length ? `${data.length} invitation(s) reçue(s)` : 'Aucune invitation reçue' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors du chargement des invitations' };
    }
  }

  /**
   * Update invitation status (accept/decline) with enhanced validation
   */
  public async updateInvitation(invitationId: number, accept: boolean): Promise<LegacyApiResponse<InvitationActionResponse>> {
    try {
      const data = await apiUpdateInvitation(invitationId, accept);
      return { success: true, data, message: data.message };
    } catch (error: any) {
      return { success: false, error: error.message || `Erreur lors de la ${accept ? 'acceptation' : 'refus'} de l'invitation` };
    }
  }

  /**
   * Get league details by ID
   */
  public async getLeagueDetails(leagueId: number): Promise<LegacyApiResponse<any>> {
    try {
      const data = await apiGetLeagueDetails(leagueId);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors du chargement des détails de la ligue' };
    }
  }

  /**
   * Search users with enhanced validation and security
   */
  public async searchUsers(query: string): Promise<LegacyApiResponse<{ users: UserSearchResult[] }>> {
    try {
      const users = await apiSearchUsers(query);
      return { success: true, data: { users }, message: `${users.length} utilisateur(s) trouvé(s)` };
    } catch (error: any) {
      return { success: false, error: error.message || "Erreur lors de la recherche d'utilisateur" };
    }
  }

  /**
   * Invite a user to a league with enhanced validation
   */
  public async inviteUserToLeague(leagueId: number, userId: number): Promise<LegacyApiResponse<ApiLeagueMessageResponse>> {
    try {
      const data = await apiInviteUserToLeague(leagueId, userId);
      return { success: true, data, message: data.message || 'Utilisateur invité avec succès !' };
    } catch (error: any) {
      return { success: false, error: error.message || "Erreur lors de l'invitation de l'utilisateur" };
    }
  }

  /**
   * Récupérer le classement d'une ligue
   * Backend: GET /league/{league_id}/rank
   */
  public async getLeagueRanking(leagueId: number): Promise<LegacyApiResponse<ApiLeagueRankingRow[]>> {
    try {
      const data = await apiGetLeagueRanking(leagueId);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement du classement' };
    }
  }

  /**
   * Quitter une ligue (désinscription)
   * Backend conservé: DELETE /league/{id}/player/delete
   */
  public async leaveLeague(leagueId: number): Promise<LegacyApiResponse<{ message: string }>> {
    try {
      const data = await apiLeaveLeague(leagueId);
      return { success: true, data, message: data.message || 'Vous avez quitté la ligue avec succès' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors de la désinscription de la ligue' };
    }
  }

  /**
   * Bulk: récupérer les soldes BTL de l’utilisateur sur plusieurs ligues.
   * Backend: POST /leagues/balances { league_ids: number[] }
   */
  public async getLeaguesBalancesBulk(leagueIds: number[]): Promise<LegacyApiResponse<ApiLeagueBalancesBulkResponse>> {
    try {
      const data = await apiGetLeaguesBalancesBulk(leagueIds);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des soldes (bulk)' };
    }
  }

  /**
   * Récupérer le solde BTL de l’utilisateur dans une ligue.
   * Backend attendu: GET /league/{leagueId}/balance -> { nb_btl: number }
   */
  public async getLeagueBalance(leagueId: number): Promise<LegacyApiResponse<ApiLeagueBalanceResponse>> {
    try {
      const data = await apiGetLeagueBalance(leagueId);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement du solde de la ligue' };
    }
  }

  /**
   * Get user's leagues (compat)
   * Retourne les ligues participées (ancien comportement).
   */
  public async getUserLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string }> {
    return this.getParticipatedLeagues();
  }

  /**
   * Nouveau helper: récupère les 3 listes (available/created/participated) côté UI.
   * On s'aligne sur le back: /leagues, /leagues/created, /leagues/participated.
   */
  public async getUserLeaguesLists(page = 1, pageSize = 10): Promise<LegacyApiResponse<{ available: LeagueSummary[]; created: LeagueSummary[]; participated: LeagueSummary[] }>> {
    try {
      const [available, created, participated] = await Promise.all([
        this.getAvailableLeaguesPage(page, pageSize),
        this.getCreatedLeaguesPage(page, pageSize),
        this.getParticipatedLeaguesPage(page, pageSize),
      ]);

      if (!available.success || !available.data) return { success: false, error: available.error || 'Impossible de charger les ligues disponibles' };
      if (!created.success || !created.data) return { success: false, error: created.error || 'Impossible de charger les ligues créées' };
      if (!participated.success || !participated.data) return { success: false, error: participated.error || 'Impossible de charger les ligues participées' };

      return {
        success: true,
        data: {
          available: available.data.leagues,
          created: created.data.leagues,
          participated: participated.data.leagues,
        },
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Impossible de charger les ligues' };
    }
  }
}

// Export singleton instance
const leagueApiService = new LeagueApiService();
export default leagueApiService;

