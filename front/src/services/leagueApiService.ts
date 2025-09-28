/**
 * League API Service - Secure TypeScript integration with backend
 * Optimized for React, mobile-first, security, and performance
 */

import secureApiClient from './secureApiClient';
import { LeagueSummary } from '../types';

export interface LeagueCreateFormData {
  name: string;
  type: 'public' | 'private';
  maxMembers: number;
  entryFee: number;
  description?: string;
}

export interface LeagueCreateRequest {
  name: string;
  max_players: number;
  is_private: boolean;
  is_free: boolean;
  nb_btl?: number;
}

export interface LeagueResponse {
  message: string;
}

export interface League {
  id: number;
  name: string;
  type: 'public' | 'private';
  members: number;
  maxMembers: number;
  myRank: number;
  totalPot: number;
  endDate: string;
  status: 'active' | 'ended' | 'pending';
  admin: string;
}

export interface UserSummaryLeagueDetail {
  id: number;
  pseudo: string;
}

export interface LeagueInvitationSummary {
  id: number;
  name: string;
  max_players: number;
  start_date: number;
  user_creator: UserSummaryLeagueDetail;
  nb_players_remaining: number;
  is_started?: boolean;
}

export interface InvitationReceived {
  id: number;
  league: LeagueInvitationSummary;
  status: string;
}

export interface InvitationsResponse {
  pending?: InvitationReceived[];
}

export interface InvitationActionResponse {
  message: string;
  success: boolean;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface UserSearchResult {
  id: number;
  pseudo: string;
  email: string;
}

export interface InviteUserRequest {
  leagueId: number;
  userId: number;
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
  public async createLeague(formData: LeagueCreateFormData): Promise<ApiResponse<LeagueResponse>> {
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
      const payload: LeagueCreateRequest = {
        name: formData.name.trim(),
        max_players: formData.maxMembers,
        is_private: formData.type === 'private',
        is_free: formData.entryFee === 0,
        nb_btl: formData.entryFee > 0 ? formData.entryFee : undefined,
      };

      console.log('📤 Creating league with payload:', payload);

      const response = await this.makeRequest<LeagueResponse>('/league/create', {
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
   * Get available leagues (public leagues user can join)
   */
  public async getAvailableLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; }> {
    try {
      const raw = await this.makeRequest<any>('/leagues');

      const items = (raw?.leagues ?? raw ?? []) as any[];

      const toEpochMs = (ts: number | string | null | undefined): number | null => {
        if (ts === null || ts === undefined) return null;
        const n = typeof ts === 'string' ? Number(ts) : ts;
        if (!Number.isFinite(n)) return null;
        // Heuristique: si < 10^12, c'est en secondes -> convertir en ms
        return n < 1_000_000_000_000 ? n * 1000 : n;
      };

      const leagues: LeagueSummary[] = Array.isArray(items)
        ? items.map((l) => {
            const startMs = toEpochMs(l.start_date);
            return {
              id: Number(l.id),
              name: String(l.name ?? ''),
              startDate: startMs ? new Date(startMs).toISOString() : new Date().toISOString(),
              isStarted: Boolean(l.is_started ?? false),
              playersRemaining: typeof l.nb_players_remaining === 'number' ? l.nb_players_remaining : undefined,
            } as LeagueSummary;
          })
        : [];

      return {
        success: true,
        data: { leagues },
      };
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
      const raw = await this.makeRequest<any>('/leagues/created');

      const items = (raw?.leagues ?? raw ?? []) as any[];

      const toEpochMs = (ts: number | string | null | undefined): number | null => {
        if (ts === null || ts === undefined) return null;
        const n = typeof ts === 'string' ? Number(ts) : ts;
        if (!Number.isFinite(n)) return null;
        // Heuristique: si < 10^12, c'est en secondes -> convertir en ms
        return n < 1_000_000_000_000 ? n * 1000 : n;
      };

      const leagues: LeagueSummary[] = Array.isArray(items)
        ? items.map((l) => {
            const startMs = toEpochMs(l.start_date);
            return {
              id: Number(l.id),
              name: String(l.name ?? ''),
              startDate: startMs ? new Date(startMs).toISOString() : new Date().toISOString(),
              isStarted: Boolean(l.is_started ?? false),
              playersRemaining: typeof l.nb_players_remaining === 'number' ? l.nb_players_remaining : undefined,
            } as LeagueSummary;
          })
        : [];

      return {
        success: true,
        data: { leagues },
      };
    } catch (error: any) {
      console.error('❌ Failed to load created leagues:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des ligues créées',
      };
    }
  }

  /**
   * Get user's leagues (backward compatibility - now gets available leagues)
   */
  public async getLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; } > {
    return this.getAvailableLeagues();
  }

  /**
   * Join a league by ID
   */
  public async joinLeague(leagueId: number): Promise<ApiResponse<LeagueResponse>> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const response = await this.makeRequest<LeagueResponse>(`/league/${leagueId}/join`, {
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
  public async getReceivedInvitations(): Promise<ApiResponse<InvitationReceived[]>> {
    try {
      console.log('🔍 Fetching received invitations...');

      const response = await this.makeRequest<InvitationReceived[]>(
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
  public async updateInvitation(invitationId: number, accept: boolean): Promise<ApiResponse<InvitationActionResponse>> {
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
  public async getLeagueDetails(leagueId: number): Promise<ApiResponse<any>> {
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
  public async searchUsers(query: string): Promise<ApiResponse<{ users: UserSearchResult[] }>> {
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
      const response = await this.makeRequest<{ users: UserSearchResult[]; total: number; query: string }>(`/auth/users/search?q=${encodeURIComponent(trimmedQuery)}`);

      if (!response?.users || !Array.isArray(response.users)) {
        throw new Error('Format de réponse invalide');
      }

      // Map and validate the response
      const users = response.users.map((user: any) => ({
        id: Number(user.id),
        pseudo: String(user.pseudo || 'Utilisateur'),
        email: String(user.email || ''),
      }));

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
        error: error.message || 'Erreur lors de la recherche d\'utilisateurs',
      };
    }
  }

  /**
   * Invite a user to a league with enhanced validation
   */
  public async inviteUserToLeague(leagueId: number, userId: number): Promise<ApiResponse<LeagueResponse>> {
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

      const response = await this.makeRequest<LeagueResponse>(inviteEndpoint, {
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
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'invitation de l\'utilisateur',
      };
    }
  }
}

// Export singleton instance
const leagueApiService = new LeagueApiService();
export default leagueApiService;

