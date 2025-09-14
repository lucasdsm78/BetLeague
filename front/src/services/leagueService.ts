/**
 * League Service - TypeScript version
 * Comprehensive league management with validation and error handling
 */

import { apiClient, ApiClientError } from './apiClient';
import type { 
  League, 
  LeagueDetails, 
  Invitation, 
  LeagueCreateForm,
  ApiResponse,
  PaginatedResponse 
} from '../types';

export interface LeagueCreatePayload {
  name: string;
  max_players: number;
  is_private: boolean;
  is_free: boolean;
  nb_btl?: number;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface LeagueJoinResponse {
  league: League;
  message: string;
  participant: {
    userId: number;
    joinedAt: string;
  };
}

export interface InvitationResponse {
  invitation: Invitation;
  message: string;
}

// League Service Error
export class LeagueServiceError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, status: number = 0, code?: string, details?: unknown) {
    super(message);
    this.name = 'LeagueServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static fromApiError(error: ApiClientError): LeagueServiceError {
    return new LeagueServiceError(
      error.message,
      error.status,
      error.code,
      error.details
    );
  }
}

// League validation utilities
class LeagueValidator {
  static validateName(name: string): string {
    const trimmed = name.trim();
    
    if (!trimmed) {
      throw new LeagueServiceError('Le nom de la ligue est requis', 400, 'NAME_REQUIRED');
    }

    if (trimmed.length < 3) {
      throw new LeagueServiceError('Le nom doit contenir au moins 3 caractères', 400, 'NAME_TOO_SHORT');
    }

    if (trimmed.length > 50) {
      throw new LeagueServiceError('Le nom ne peut pas dépasser 50 caractères', 400, 'NAME_TOO_LONG');
    }

    // Check for forbidden characters
    if (!/^[a-zA-Z0-9\s\-_À-ÿ]+$/.test(trimmed)) {
      throw new LeagueServiceError('Le nom contient des caractères non autorisés', 400, 'NAME_INVALID_CHARS');
    }

    return trimmed;
  }

  static validateMaxPlayers(maxPlayers: number): number {
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2) {
      throw new LeagueServiceError('Le nombre minimum de participants est 2', 400, 'MIN_PLAYERS_INVALID');
    }

    if (maxPlayers > 200) {
      throw new LeagueServiceError('Le nombre maximum de participants est 200', 400, 'MAX_PLAYERS_EXCEEDED');
    }

    return maxPlayers;
  }

  static validateEntryFee(entryFee: number): number {
    if (!Number.isInteger(entryFee) || entryFee < 0) {
      throw new LeagueServiceError('La mise d\'entrée doit être positive', 400, 'ENTRY_FEE_INVALID');
    }

    if (entryFee > 10000) {
      throw new LeagueServiceError('La mise d\'entrée ne peut pas dépasser 10000 BTL', 400, 'ENTRY_FEE_TOO_HIGH');
    }

    return entryFee;
  }

  static validateDescription(description?: string): string | undefined {
    if (!description) return undefined;

    const trimmed = description.trim();
    
    if (trimmed.length > 500) {
      throw new LeagueServiceError('La description ne peut pas dépasser 500 caractères', 400, 'DESCRIPTION_TOO_LONG');
    }

    // Basic content validation
    if (/<script|javascript:|on\w+\s*=/.test(trimmed)) {
      throw new LeagueServiceError('La description contient du contenu non autorisé', 400, 'DESCRIPTION_UNSAFE');
    }

    return trimmed;
  }
}

// League Service Class
export class LeagueService {
  private handleApiError(error: any): never {
    if (error instanceof ApiClientError) {
      throw LeagueServiceError.fromApiError(error);
    }

    if (error instanceof LeagueServiceError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new LeagueServiceError(error.message, 0, 'UNKNOWN_ERROR', error);
    }

    throw new LeagueServiceError('Une erreur inconnue s\'est produite', 0);
  }

  // Create a new league
  async createLeague(form: LeagueCreateForm): Promise<League> {
    try {
      // Validate input
      const name = LeagueValidator.validateName(form.name);
      const maxPlayers = LeagueValidator.validateMaxPlayers(form.maxMembers);
      const entryFee = LeagueValidator.validateEntryFee(form.entryFee);
      const description = LeagueValidator.validateDescription(form.description);

      // Prepare payload
      const payload: LeagueCreatePayload = {
        name,
        max_players: maxPlayers,
        is_private: form.type === 'private',
        is_free: entryFee === 0,
        nb_btl: entryFee > 0 ? entryFee : undefined,
        description,
      };

      // Add dates if provided
      if (form.startDate) {
        const startDate = new Date(form.startDate);
        if (startDate < new Date()) {
          throw new LeagueServiceError('La date de début ne peut pas être dans le passé', 400, 'START_DATE_PAST');
        }
        payload.start_date = startDate.toISOString();
      }

      if (form.endDate) {
        const endDate = new Date(form.endDate);
        if (form.startDate && endDate <= new Date(form.startDate)) {
          throw new LeagueServiceError('La date de fin doit être après la date de début', 400, 'END_DATE_INVALID');
        }
        payload.end_date = endDate.toISOString();
      }

      const response = await apiClient.post<{ league: League }>('/league/create', payload);

      if (!response.success || !response.data?.league) {
        throw new LeagueServiceError('Réponse invalide du serveur', 500, 'INVALID_RESPONSE');
      }

      return response.data.league;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Get user's leagues
  async getLeagues(page: number = 1, pageSize: number = 10): Promise<PaginatedResponse<League>> {
    try {
      const response = await apiClient.get<PaginatedResponse<League>>(
        `/leagues?page=${page}&page_size=${pageSize}`
      );

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible de récupérer les ligues', 500, 'FETCH_LEAGUES_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Get league details
  async getLeagueDetails(leagueId: number): Promise<LeagueDetails> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      const response = await apiClient.get<{ league: LeagueDetails }>(`/league/${leagueId}`);

      if (!response.success || !response.data?.league) {
        throw new LeagueServiceError('Ligue non trouvée', 404, 'LEAGUE_NOT_FOUND');
      }

      return response.data.league;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Join a league
  async joinLeague(leagueId: number): Promise<LeagueJoinResponse> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      const response = await apiClient.post<LeagueJoinResponse>(`/league/${leagueId}/join`);

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible de rejoindre la ligue', 500, 'JOIN_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Leave a league
  async leaveLeague(leagueId: number): Promise<{ message: string }> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      const response = await apiClient.post<{ message: string }>(`/league/${leagueId}/leave`);

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible de quitter la ligue', 500, 'LEAVE_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Search public leagues
  async searchLeagues(
    query: string, 
    filters: {
      minPlayers?: number;
      maxPlayers?: number;
      isFree?: boolean;
      minEntryFee?: number;
      maxEntryFee?: number;
    } = {},
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<League>> {
    try {
      const searchParams = new URLSearchParams({
        q: query.trim(),
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await apiClient.get<PaginatedResponse<League>>(
        `/leagues/search?${searchParams.toString()}`
      );

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Recherche échouée', 500, 'SEARCH_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Get invitations
  async getInvitations(isReceived: boolean = true): Promise<Invitation[]> {
    try {
      const response = await apiClient.get<{ invitations: Invitation[] }>(
        `/invitations?is_received=${isReceived}`
      );

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible de récupérer les invitations', 500, 'FETCH_INVITATIONS_FAILED');
      }

      return response.data.invitations || [];

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Send invitation
  async sendInvitation(leagueId: number, receiverEmail: string, message?: string): Promise<InvitationResponse> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(receiverEmail.trim())) {
        throw new LeagueServiceError('Format d\'email invalide', 400, 'INVALID_EMAIL');
      }

      const payload = {
        league_id: leagueId,
        receiver_email: receiverEmail.trim().toLowerCase(),
        message: message?.trim(),
      };

      const response = await apiClient.post<InvitationResponse>('/invitation/send', payload);

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible d\'envoyer l\'invitation', 500, 'SEND_INVITATION_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Respond to invitation
  async respondToInvitation(invitationId: number, accept: boolean): Promise<{ message: string }> {
    try {
      if (!Number.isInteger(invitationId) || invitationId <= 0) {
        throw new LeagueServiceError('ID d\'invitation invalide', 400, 'INVALID_INVITATION_ID');
      }

      const response = await apiClient.put<{ message: string }>(
        `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`
      );

      if (!response.success || !response.data) {
        throw new LeagueServiceError(
          `Impossible de ${accept ? 'accepter' : 'refuser'} l\'invitation`, 
          500, 
          'RESPOND_INVITATION_FAILED'
        );
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Update league settings (for league owners)
  async updateLeague(leagueId: number, updates: Partial<LeagueCreateForm>): Promise<League> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      const payload: Partial<LeagueCreatePayload> = {};

      // Validate and transform updates
      if (updates.name !== undefined) {
        payload.name = LeagueValidator.validateName(updates.name);
      }

      if (updates.maxMembers !== undefined) {
        payload.max_players = LeagueValidator.validateMaxPlayers(updates.maxMembers);
      }

      if (updates.description !== undefined) {
        payload.description = LeagueValidator.validateDescription(updates.description);
      }

      if (updates.type !== undefined) {
        payload.is_private = updates.type === 'private';
      }

      const response = await apiClient.put<{ league: League }>(`/league/${leagueId}`, payload);

      if (!response.success || !response.data?.league) {
        throw new LeagueServiceError('Impossible de mettre à jour la ligue', 500, 'UPDATE_FAILED');
      }

      return response.data.league;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Delete league (for league owners)
  async deleteLeague(leagueId: number): Promise<{ message: string }> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      const response = await apiClient.delete<{ message: string }>(`/league/${leagueId}`);

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible de supprimer la ligue', 500, 'DELETE_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Get league leaderboard
  async getLeaderboard(leagueId: number): Promise<any[]> {
    try {
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new LeagueServiceError('ID de ligue invalide', 400, 'INVALID_LEAGUE_ID');
      }

      const response = await apiClient.get<{ leaderboard: any[] }>(`/league/${leagueId}/leaderboard`);

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Impossible de récupérer le classement', 500, 'LEADERBOARD_FAILED');
      }

      return response.data.leaderboard || [];

    } catch (error) {
      this.handleApiError(error);
    }
  }

  // Validate league name availability
  async checkNameAvailability(name: string): Promise<{ available: boolean; suggestions?: string[] }> {
    try {
      const validatedName = LeagueValidator.validateName(name);
      
      const response = await apiClient.get<{ available: boolean; suggestions?: string[] }>(
        `/league/check-name?name=${encodeURIComponent(validatedName)}`
      );

      if (!response.success || !response.data) {
        throw new LeagueServiceError('Vérification du nom échouée', 500, 'NAME_CHECK_FAILED');
      }

      return response.data;

    } catch (error) {
      this.handleApiError(error);
    }
  }
}

// Create and export singleton instance
export const leagueService = new LeagueService();

export default leagueService;