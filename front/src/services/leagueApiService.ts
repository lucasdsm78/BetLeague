/**
 * League API Service - Secure TypeScript integration with backend
 * Optimized for React, mobile-first, security, and performance
 */

import secureApiClient from './secureApiClient';
import { LeagueSummary } from '../types';

// Types matching backend models
export interface LeagueCreateRequest {
  name: string;
  max_players: number;
  is_private: boolean;
  is_free?: boolean;
  nb_btl?: number;
}

export interface LeagueCreateFormData {
  name: string;
  type: 'public' | 'private';
  maxMembers: number;
  entryFee: number;
  description?: string;
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

export interface Invitation {
  id: number;
  leagueName: string;
  inviterName: string;
  inviteDate: string;
  members: number;
  maxMembers: number;
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
      throw error;
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
  public async getAvailableLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; } > {
    try {
      // Le backend retourne { leagues: LeagueReadModel[] } ou 204 sans contenu
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
   * Get user's created leagues
   */
  public async getCreatedLeagues(): Promise<{ success: boolean; data?: { leagues: LeagueSummary[] }; error?: string; } > {
    try {
      // Le backend retourne { leagues: LeagueReadModel[] } ou 204 sans contenu
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
   * Get invitations
   */
  public async getInvitations(isReceived = true): Promise<ApiResponse<{ invitations: Invitation[] }>> {
    try {
      const response = await this.makeRequest<{ invitations: Invitation[] }>(
        `/invitations?is_received=${isReceived}`
      );
      return {
        success: true,
        data: response,
      };
    } catch (error: any) {
      console.error('❌ Failed to load invitations:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des invitations',
      };
    }
  }

  /**
   * Update invitation status (accept/decline)
   */
  public async updateInvitation(invitationId: number, accept: boolean): Promise<ApiResponse<LeagueResponse>> {
    try {
      if (!Number.isInteger(invitationId) || invitationId <= 0) {
        throw new Error('ID d\'invitation invalide');
      }

      const response = await this.makeRequest<LeagueResponse>(
        `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`,
        { method: 'PUT' }
      );

      return {
        success: true,
        data: response,
        message: response.message || (accept ? 'Invitation acceptée' : 'Invitation refusée'),
      };
    } catch (error: any) {
      console.error('❌ Failed to update invitation:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la mise à jour de l\'invitation',
      };
    }
  }

  /**
   * Get league ranking
   */
  public async getLeagueRanking(leagueId: number): Promise<ApiResponse<any>> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('ID de ligue invalide');
      }

      const response = await this.makeRequest(`/league/${leagueId}/rank`);
      return {
        success: true,
        data: response,
      };
    } catch (error: any) {
      console.error('❌ Failed to load league ranking:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement du classement',
      };
    }
  }
}

// Export singleton instance
const leagueApiService = new LeagueApiService();
export default leagueApiService;

