/**
 * League API Service - Secure TypeScript integration with backend
 * Optimized for React, mobile-first, security, and performance
 */

import secureApiClient from './secureApiClient';
import type { LeagueSummary } from '../types';
import { mapLeaguesPage, type LeaguesPage, type LeaguesPageApi } from './leaguesPaging';
import type {
  ApiLeagueCreateRequest,
  ApiLeagueMessageResponse,
  ApiLeagueBalancesBulkResponse,
  ApiLeagueBalanceResponse,
  ApiUserSearchResult,
  ApiLeagueRankingRow,
  ApiInvitationReceived,
  ApiLeagueSummary,
} from '../types/api/leagues';
import type { UserSearchResult } from '../types/entities/userSearch';
import { mapApiUserSearchResultToUi } from './mappers/userSearchMapper';

// DTO local (réponse update invitation) : à migrer ensuite dans src/types/api/leagues.ts si on veut.
export interface InvitationActionResponse {
  message: string;
  success: boolean;
  error?: string;
}

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
  private readonly baseURL: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
  }

  /**
   * This method is no longer needed as secureApiClient handles auth headers
   */
  private getAuthHeaders(): Record<string, string> {

    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Use the secure API client for all requests
   */
  private async makeRequest<T = any>(
    endpoint: string,
    options: any = {}
  ): Promise<T> {
    const method = options.method || 'GET';

    try {
      let response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await secureApiClient.get<T>(endpoint, options);
          break;
        case 'POST':
          const postData = options.body ? JSON.parse(options.body) : undefined;
          response = await secureApiClient.post<T>(endpoint, postData, options);
          break;
        case 'PUT':
          const putData = options.body ? JSON.parse(options.body) : undefined;
          response = await secureApiClient.put<T>(endpoint, putData, options);
          break;
        case 'DELETE':
          response = await secureApiClient.delete<T>(endpoint, options);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      if (!response.success) {
        throw new Error(response.error || 'Request failed');
      }

      return response.data as T;
    } catch (error: any) {
      console.error(`League API request failed: ${method} ${endpoint}`, error);

      // Better error handling for object errors
      let errorMessage = 'Request failed';
      if (error?.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail);
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Parse error messages from backend responses
   */
  private parseErrorMessage(status: number, errorData: any): string {
    switch (status) {
      case 400:
        return 'Données invalides';
      case 403:
        return 'Accès refusé';
      case 404:
        return 'Ressource non trouvée';
      case 409:
        return errorData.detail || 'Cette ligue existe déjà';
      case 422:
        // FastAPI validation errors
        if (errorData.detail && Array.isArray(errorData.detail)) {
          return errorData.detail
            .map((err: any) => err.msg || err.message)
            .join(', ');
        }
        return errorData.detail || 'Erreur de validation des données';
      case 500:
        return 'Erreur serveur interne. Veuillez réessayer plus tard.';
      default:
        return errorData.detail || `Erreur ${status}`;
    }
  }

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
      // Input validation with security checks
      const nameValidation = this.validateLeagueName(formData.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error);
      }

      if (!Number.isInteger(formData.maxMembers) || formData.maxMembers < 2 || formData.maxMembers > 200) {
        throw new Error('Le nombre de participants doit être entre 2 et 200');
      }

      if (!Number.isInteger(formData.entryFee) || formData.entryFee < 0 || formData.entryFee > 10000) {
        throw new Error('La mise d\'entrée doit être entre 0 et 10000 BTL');
      }

      // Validate description if provided
      if (formData.description && formData.description.length > 500) {
        throw new Error('La description ne peut pas dépasser 500 caractères');
      }

      // Transform and sanitize data to match LeagueCreateModel
      const payload: ApiLeagueCreateRequest = {
        name: formData.name.trim(),
        max_players: formData.maxMembers,
        is_private: formData.type === 'private',
        is_free: formData.entryFee === 0,
        nb_btl: formData.entryFee > 0 ? formData.entryFee : undefined,
      };

      console.log('📤 Creating league with payload:', payload);

      const response = await this.makeRequest<ApiLeagueMessageResponse>('/league/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('✅ League created successfully:', response);

      return {
        success: true,
        data: response,
        message: response.message || 'Ligue créée avec succès !',
      };
    } catch (error: any) {
      console.error('❌ League creation failed:', error);
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
      const data = await this.makeRequest<LeaguesPageApi>('/leagues', {
        method: 'GET',
        params: { page, page_size: pageSize },
      });
      return { success: true, data: mapLeaguesPage(data) };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des ligues disponibles' };
    }
  }

  /** Nouvelle API paginée - Ligues créées */
  public async getCreatedLeaguesPage(page = 1, pageSize = 10): Promise<LegacyApiResponse<LeaguesPage>> {
    try {
      const data = await this.makeRequest<LeaguesPageApi>('/leagues/created', {
        method: 'GET',
        params: { page, page_size: pageSize },
      });
      return { success: true, data: mapLeaguesPage(data) };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des ligues créées' };
    }
  }

  /** Nouvelle API paginée - Ligues rejointes */
  public async getParticipatedLeaguesPage(page = 1, pageSize = 10): Promise<LegacyApiResponse<LeaguesPage>> {
    try {
      const data = await this.makeRequest<LeaguesPageApi>('/leagues/participated', {
        method: 'GET',
        params: { page, page_size: pageSize },
      });
      return { success: true, data: mapLeaguesPage(data) };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erreur lors du chargement des ligues rejointes' };
    }
  }

  /**
   * Get available leagues (public leagues user can join)
   */
  public async getAvailableLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; }> {
    try {
      // Compat: prendre la 1ère page
      const res = await this.getAvailableLeaguesPage(1, 50);
      if (!res.success || !res.data) return { success: false, error: res.error };
      return { success: true, data: { leagues: res.data.leagues } };
    } catch (error: any) {
      console.error('❌ Failed to load available leagues:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des ligues disponibles',
      };
    }
  }

  /**
   * Get leagues created by the user
   */
  public async getCreatedLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; }> {
    try {
      const res = await this.getCreatedLeaguesPage(1, 50);
      if (!res.success || !res.data) return { success: false, error: res.error };
      return { success: true, data: { leagues: res.data.leagues } };
    } catch (error: any) {
      console.error('❌ Failed to load created leagues:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des ligues créées',
      };
    }
  }

  /** Compat: ligues rejointes (1ère page) */
  public async getParticipatedLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; }> {
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
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const response = await this.makeRequest<ApiLeagueMessageResponse>(`/league/${leagueId}/join`, {
        method: 'POST',
      });

      return {
        success: true,
        data: response,
        message: response.message || 'Vous avez rejoint la ligue !',
      };
    } catch (error: any) {
      console.error('❌ Failed to join league:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la tentative de rejoindre la ligue',
      };
    }
  }

  /**
   * Get received invitations with enhanced error handling
   */
  public async getReceivedInvitations(): Promise<LegacyApiResponse<ApiInvitationReceived[]>> {
    try {
      console.log('🔍 Fetching received invitations...');

      const response = await this.makeRequest<ApiInvitationReceived[]>(
        `/invitations?is_received=true`
      );

      // Handle empty response (204 No Content)
      if (!response || response === null || response === undefined) {
        return {
          success: true,
          data: [],
          message: 'Aucune invitation reçue',
        };
      }

      if (!Array.isArray(response)) {
        throw new Error('Format de réponse invalide');
      }

      // Validate and sanitize response data
      const invitations = response.map((invitation: any) => ({
        id: Number(invitation.id),
        league: {
          id: Number(invitation.league.id),
          name: String(invitation.league.name || 'Ligue sans nom'),
          max_players: Number(invitation.league.max_players || 0),
          start_date: Number(invitation.league.start_date || 0),
          user_creator: {
            id: Number(invitation.league.user_creator?.id || 0),
            pseudo: String(invitation.league.user_creator?.pseudo || 'Utilisateur'),
          },
          nb_players_remaining: Number(invitation.league.nb_players_remaining || 0),
          is_started: Boolean(invitation.league.is_started),
        },
        status: String(invitation.status || 'pending'),
      }));

      console.log(`✅ Found ${invitations.length} received invitations`);

      return {
        success: true,
        data: invitations,
        message: `${invitations.length} invitation(s) reçue(s)`,
      };
    } catch (error: any) {
      console.error('❌ Failed to load received invitations:', error);

      if (error.message?.includes('204') || error.message?.includes('No Content')) {
        return {
          success: true,
          data: [],
          message: 'Aucune invitation reçue',
        };
      }

      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        return {
          success: false,
          error: 'Vous devez être connecté pour voir vos invitations.',
        };
      }

      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des invitations',
      };
    }
  }

  /**
   * Update invitation status (accept/decline) with enhanced validation
   */
  public async updateInvitation(invitationId: number, accept: boolean): Promise<LegacyApiResponse<InvitationActionResponse>> {
    try {
      if (!Number.isInteger(invitationId) || invitationId <= 0) {
        throw new Error('ID d\'invitation invalide');
      }

      console.log(`🔄 ${accept ? 'Accepting' : 'Declining'} invitation ${invitationId}`);

      const response = await this.makeRequest<InvitationActionResponse>(
        `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`,
        { method: 'PUT' }
      );

      const actionText = accept ? 'acceptée' : 'refusée';
      const successMessage = response.message || `Invitation ${actionText} avec succès !`;

      console.log(`✅ Invitation ${actionText} successfully`);

      return {
        success: true,
        data: response,
        message: successMessage,
      };
    } catch (error: any) {
      console.error('❌ Failed to update invitation:', error);

      let errorMessage = `Erreur lors de la ${accept ? 'acceptation' : 'refus'} de l'invitation`;

      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        errorMessage = 'Invitation introuvable ou déjà traitée';
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        errorMessage = 'Vous n\'avez pas l\'autorisation de modifier cette invitation';
      } else if (error.message?.includes('409') || error.message?.includes('Conflict')) {
        errorMessage = 'Cette invitation a déjà été traitée';
      } else if (error.message?.includes('btl') || error.message?.includes('insufficient')) {
        errorMessage = 'Vous n\'avez pas assez de BTL pour rejoindre cette ligue';
      } else if (error.message?.includes('full') || error.message?.includes('max')) {
        errorMessage = 'Cette ligue est complète';
      } else if (error.message?.includes('started')) {
        errorMessage = 'Cette ligue a déjà commencé';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get league details by ID
   */
  public async getLeagueDetails(leagueId: number): Promise<LegacyApiResponse<any>> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const response = await this.makeRequest(`/league/${leagueId}`);
      return {
        success: true,
        data: response,
      };
    } catch (error: any) {
      console.error('❌ Failed to load league details:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des détails de la ligue',
      };
    }
  }

  /**
   * Search users with enhanced validation and security
   */
  public async searchUsers(query: string): Promise<LegacyApiResponse<{ users: UserSearchResult[] }>> {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error('Terme de recherche requis');
      }

      const trimmedQuery = query.trim();

      if (trimmedQuery.length < 2) {
        throw new Error('Minimum 2 caractères requis pour la recherche');
      }

      if (trimmedQuery.length > 50) {
        throw new Error('Maximum 50 caractères autorisés');
      }

      // Enhanced security: check for forbidden characters and patterns
      const forbiddenChars = /[<>\\/\\&\"'`]/;
      if (forbiddenChars.test(trimmedQuery)) {
        throw new Error('Caractères non autorisés détectés');
      }

      // Check for suspicious patterns
      const suspiciousPatterns = /(script|javascript|eval|onclick|onerror)/i;
      if (suspiciousPatterns.test(trimmedQuery)) {
        throw new Error('Terme de recherche non autorisé');
      }

      console.log('🔍 Searching users with query:', trimmedQuery);

      // Use the new dedicated search endpoint
      const response = await this.makeRequest<{ users: ApiUserSearchResult[]; total: number; query: string }>(`/auth/users/search?q=${encodeURIComponent(trimmedQuery)}`);

      if (!response?.users || !Array.isArray(response.users)) {
        throw new Error('Format de réponse invalide');
      }

      // Mapper + validation minimale
      const users: UserSearchResult[] = response.users.map((u: ApiUserSearchResult) => mapApiUserSearchResultToUi(u));

      console.log(`✅ Found ${users.length} users matching query:`, trimmedQuery);

      return {
        success: true,
        data: { users },
        message: `${users.length} utilisateur(s) trouvé(s)`,
      };
    } catch (error: any) {
      console.error('❌ User search failed:', error);

      // Handle specific error cases with better logging
      console.log('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        return {
          success: true,
          data: { users: [] },
          message: 'Aucun utilisateur trouvé',
        };
      }

      if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.message?.includes('Not authenticated')) {
        return {
          success: false,
          error: 'Vous devez être connecté pour rechercher des utilisateurs.',
        };
      }

      if (error.message?.includes('500') || error.message?.includes('Internal Server Error') || error.message?.includes('Erreur interne')) {
        return {
          success: false,
          error: 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.',
        };
      }

      if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
        return {
          success: false,
          error: 'Terme de recherche invalide. Utilisez au moins 2 caractères.',
        };
      }

      return {
        success: false,
        error: error.message || 'Erreur lors de la recherche d\'utilisateur',
      };
    }
  }

  /**
   * Invite a user to a league with enhanced validation
   */
  public async inviteUserToLeague(leagueId: number, userId: number): Promise<LegacyApiResponse<ApiLeagueMessageResponse>> {
    try {
      // Input validation
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('ID d\'utilisateur invalide');
      }

      console.log(`📤 Inviting user ${userId} to league ${leagueId}`);

      const inviteEndpoint = `/league/${leagueId}/${userId}/invite`;
      console.log(`🔗 Invite endpoint: ${inviteEndpoint}`);

      const response = await this.makeRequest<ApiLeagueMessageResponse>(inviteEndpoint, {
        method: 'POST',
      });

      console.log('✅ User invited successfully:', response);

      return {
        success: true,
        data: response,
        message: response.message || 'Utilisateur invité avec succès !',
      };
    } catch (error: any) {
      console.error('❌ User invitation failed:', error);

      const msg = String(error?.message || '');
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('owner')) {
        return { success: false, error: "Vous n'avez pas l'autorisation d'inviter dans cette ligue." };
      }
      if (msg.includes('409') || msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('already')) {
        return { success: false, error: "Cet utilisateur est déjà invité ou déjà participant." };
      }
      if (msg.includes('404') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('introuvable')) {
        return { success: false, error: 'Ligue ou utilisateur introuvable.' };
      }
      if (msg.toLowerCase().includes('started') || msg.toLowerCase().includes('commenc')) {
        return { success: false, error: 'Cette ligue a déjà commencé, invitation impossible.' };
      }

      return {
        success: false,
        error: error.message || 'Erreur lors de l\'invitation de l\'utilisateur',
      };
    }
  }

  /**
   * Récupérer le classement d'une ligue
   * Backend: GET /league/{league_id}/rank
   */
  public async getLeagueRanking(
    leagueId: number
  ): Promise<LegacyApiResponse<ApiLeagueRankingRow[]>> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const data = await this.makeRequest<ApiLeagueRankingRow[]>(`/league/${leagueId}/rank`, { method: 'GET' });

      if (!Array.isArray(data)) {
        throw new Error('Format de réponse invalide');
      }

      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du chargement du classement',
      };
    }
  }

  /**
   * Quitter une ligue (désinscription)
   * Backend conservé: DELETE /league/{id}/player/delete
   */
  public async leaveLeague(leagueId: number): Promise<LegacyApiResponse<{ message: string }>> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const data = await this.makeRequest<{ message: string }>(
        `/league/${leagueId}/player/delete`,
        { method: 'DELETE' }
      );

      return {
        success: true,
        data,
        message: data?.message || 'Vous avez quitté la ligue avec succès',
      };
    } catch (error: any) {
      // Mapping d'erreurs fréquent
      const msg = error?.message || 'Erreur lors de la désinscription de la ligue';
      if (msg.includes('already started') || msg.includes('déjà')) {
        return { success: false, error: 'Impossible de quitter cette ligue car elle a déjà commencé.' };
      }
      if (msg.includes('Not Found') || msg.includes('introuvable') || msg.includes('404')) {
        return { success: false, error: 'Ligue introuvable.' };
      }
      return { success: false, error: msg };
    }
  }

  /**
   * Bulk: récupérer les soldes BTL de l’utilisateur sur plusieurs ligues.
   * Backend: POST /leagues/balances { league_ids: number[] }
   */
  public async getLeaguesBalancesBulk(leagueIds: number[]): Promise<LegacyApiResponse<ApiLeagueBalancesBulkResponse>> {
    try {
      const ids = Array.from(new Set(leagueIds)).filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length === 0) {
        return { success: true, data: { balances: {}, not_found: [], forbidden: [] } };
      }

      const data = await this.makeRequest<ApiLeagueBalancesBulkResponse>(`/leagues/balances`, {
        method: 'POST',
        body: JSON.stringify({ league_ids: ids }),
      });

      const balances = (data as any)?.balances && typeof (data as any).balances === 'object' ? (data as any).balances : {};
      return {
        success: true,
        data: {
          balances: Object.fromEntries(
            Object.entries(balances).map(([k, v]) => [Number(k), Number(v) || 0])
          ),
          not_found: Array.isArray((data as any)?.not_found) ? (data as any).not_found : [],
          forbidden: Array.isArray((data as any)?.forbidden) ? (data as any).forbidden : [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du chargement des soldes (bulk)',
      };
    }
  }

  /**
   * Récupérer le solde BTL de l’utilisateur dans une ligue.
   * Backend attendu: GET /league/{leagueId}/balance -> { nb_btl: number }
   */
  public async getLeagueBalance(leagueId: number): Promise<LegacyApiResponse<ApiLeagueBalanceResponse>> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const data = await this.makeRequest<ApiLeagueBalanceResponse>(`/league/${leagueId}/balance`, {
        method: 'GET',
      });

      return {
        success: true,
        data: {
          nb_btl: Number((data as any)?.nb_btl) || 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du chargement du solde de la ligue',
      };
    }
  }

  /**
   * Get user's leagues (compat)
   * Retourne les ligues participées (ancien comportement).
   */
  public async getUserLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; }> {
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

