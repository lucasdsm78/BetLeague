// services/api/tournament.ts
// API module: tournament (network + DTO typing)

import http, { type ApiResponse } from '../http';
import { ApiClientError } from '../secureApiClient';
import type {
  TournamentCreateRequest,
  TournamentCreateResponse,
  TournamentsResponse,
  Tournament,
  TournamentStagesResponse,
  MyTournamentsResponse,
  CreatedTournamentsResponse,
  StageMatchesResponse,
  TournamentsFinishedResponse,
  TournamentMatchOption,
  TournamentCreationAccess,
  TournamentInvitationsResponse,
  TournamentMatchOptionsResponse,
} from '../../types/api/tournament';

export class TournamentCreationError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly requiresSubscription: boolean;
  public readonly quota?: TournamentCreationAccess;

  constructor(message: string, opts: { status: number; code?: string; requiresSubscription?: boolean; quota?: TournamentCreationAccess }) {
    super(message);
    this.name = 'TournamentCreationError';
    this.status = opts.status;
    this.code = opts.code;
    this.requiresSubscription = opts.requiresSubscription ?? false;
    this.quota = opts.quota;
  }
}

function extractTournamentCreationQuota(details: unknown): TournamentCreationAccess | undefined {
  const root = typeof details === 'object' && details !== null ? (details as Record<string, any>) : null;
  const detail = root?.detail && typeof root.detail === 'object' ? root.detail : root;
  if (!detail) return undefined;
  if (typeof detail.monthly_free_tournaments_limit !== 'number') return undefined;
  return {
    monthly_free_tournaments_limit: Number(detail.monthly_free_tournaments_limit ?? 0),
    monthly_free_tournaments_used: Number(detail.monthly_free_tournaments_used ?? 0),
    monthly_free_tournaments_remaining: Number(detail.monthly_free_tournaments_remaining ?? 0),
    has_active_subscription: Boolean(detail.has_active_subscription ?? false),
    can_create_tournament: Boolean(detail.can_create_tournament ?? false),
    requires_tournament_subscription: Boolean(detail.requires_tournament_subscription ?? false),
  };
}

function getApiErrorMessage(error: ApiClientError, fallbackMessage: string): string {
  const detail = error.details as { detail?: string | { message?: string } } | undefined;
  if (typeof detail?.detail === 'string' && detail.detail.trim()) return detail.detail;
  if (typeof detail?.detail === 'object' && typeof detail.detail?.message === 'string') return detail.detail.message;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  return fallbackMessage;
}

export async function inviteUserToTournament(tournamentId: number, userId: number): Promise<{ message: string }> {
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) throw new Error('ID de tournoi invalide');
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("ID d'utilisateur invalide");

  try {
    const response: ApiResponse<{ message: string }> = await http.post(`/tournament/${tournamentId}/${userId}/invite`);
    return (response.data ?? { message: '' }) as { message: string };
  } catch (e) {
    if (e instanceof ApiClientError) {
      throw new Error(getApiErrorMessage(e, "Impossible d'envoyer l'invitation au tournoi."));
    }
    throw e;
  }
}

export async function getTournamentInvitations(tournamentId: number): Promise<TournamentInvitationsResponse> {
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) throw new Error('ID de tournoi invalide');

  try {
    const response: ApiResponse<TournamentInvitationsResponse> = await http.get(`/tournament/${tournamentId}/invitations`);
    return (response.data ?? { tournament_id: tournamentId, invitations: [] }) as TournamentInvitationsResponse;
  } catch (e) {
    if (e instanceof ApiClientError) {
      throw new Error(getApiErrorMessage(e, "Impossible de récupérer les invitations du tournoi."));
    }
    throw e;
  }
}

export async function deleteTournamentInvitation(invitationId: number): Promise<{ message: string }> {
  if (!Number.isInteger(invitationId) || invitationId <= 0) throw new Error("ID d'invitation invalide");

  try {
    const response: ApiResponse<{ message: string }> = await http.delete(`/tournament/invitation/${invitationId}`);
    return (response.data ?? { message: '' }) as { message: string };
  } catch (e) {
    if (e instanceof ApiClientError) {
      throw new Error(getApiErrorMessage(e, "Impossible de supprimer l'invitation du tournoi."));
    }
    throw e;
  }
}

export async function createTournament(data: TournamentCreateRequest): Promise<TournamentCreateResponse> {
  const payload: TournamentCreateRequest = {
    name: String(data.name ?? '').trim(),
    is_private: Boolean(data.is_private),
    max_players: Number(data.max_players),
    ...(typeof data.start_date === 'number' ? { start_date: data.start_date } : {}),
  };

  try {
    const response: ApiResponse<TournamentCreateResponse> = await http.post('/tournament/create', payload);
    return response.data as TournamentCreateResponse;
  } catch (e) {
    if (e instanceof ApiClientError) {
      const quota = extractTournamentCreationQuota(e.details);
      if (e.status === 402) {
        throw new TournamentCreationError(
          quota?.requires_tournament_subscription
            ? "Vous avez utilisé vos 2 tournois gratuits du mois. Passez à l'abonnement pour créer sans limite."
            : "Vous ne pouvez pas créer de tournoi pour le moment.",
          {
            status: 402,
            code: e.code,
            requiresSubscription: Boolean(quota?.requires_tournament_subscription),
            quota,
          }
        );
      }
      if (e.status === 409) throw new Error('Ce nom de tournoi est déjà utilisé.');
      if (e.status === 400 || e.status === 422) throw new Error('Données invalides.');
    }
    throw e;
  }
}

export async function getTournamentCreationAccess(): Promise<TournamentCreationAccess> {
  const response: ApiResponse<TournamentCreationAccess> = await http.get('/tournaments/creation-access');
  return response.data as TournamentCreationAccess;
}

export async function getTournaments(page = 1, pageSize = 10): Promise<TournamentsResponse> {
  const response: ApiResponse<TournamentsResponse> = await http.get(`/tournaments?page=${page}&page_size=${pageSize}`);
  return response.data as TournamentsResponse;
}

export async function joinTournament(tournamentId: number): Promise<{ message: string }> {
  const response: ApiResponse<{ message: string }> = await http.post(`/tournament/${tournamentId}/join`);
  return response.data as { message: string };
}

export async function getTournamentDetails(tournamentId: number): Promise<Tournament> {
  const response: ApiResponse<Tournament> = await http.get(`/tournament/${tournamentId}`);
  return response.data as Tournament;
}

export async function getTournamentStages(tournamentId: number): Promise<TournamentStagesResponse> {
  const response: ApiResponse<TournamentStagesResponse> = await http.get(`/tournament/${tournamentId}/stages`);
  return response.data as TournamentStagesResponse;
}

export async function getMyTournaments(page = 1, pageSize = 10): Promise<MyTournamentsResponse> {
  const response: ApiResponse<MyTournamentsResponse> = await http.get(`/tournaments/my?page=${page}&page_size=${pageSize}`);
  return response.data as MyTournamentsResponse;
}

export async function getStageMatches(tournamentId: number, stageType: string): Promise<StageMatchesResponse> {
  const response: ApiResponse<StageMatchesResponse> = await http.get(`/tournament/${tournamentId}/stage/${stageType}/matches`);
  return response.data as StageMatchesResponse;
}

export async function getMyCreatedTournaments(page = 1, pageSize = 10): Promise<CreatedTournamentsResponse> {
  try {
    const response: ApiResponse<CreatedTournamentsResponse> = await http.get(
      `/tournaments/my/created?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`
    );
    return response.data as CreatedTournamentsResponse;
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 402) {
      throw new Error("Abonnement tournoi requis pour accéder à vos tournois créés.");
    }
    throw e;
  }
}

export async function leaveTournament(tournamentId: number): Promise<{ message: string }> {
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    throw new Error('ID de tournoi invalide');
  }

  try {
    const response: ApiResponse<{ message: string }> = await http.delete(
      `/tournament/${tournamentId}/player/me`
    );
    return (response.data ?? { message: '' }) as { message: string };
  } catch (e) {
    if (e instanceof ApiClientError) {
      if (e.status === 403) throw new Error(getApiErrorMessage(e, 'Vous ne pouvez pas quitter ce tournoi.'));
      if (e.status === 409) throw new Error(getApiErrorMessage(e, 'Le tournoi a déjà commencé.'));
      if (e.status === 401) throw new Error('Session expirée.');
      if (e.status === 402) throw new Error('Abonnement tournoi requis.');
      if (e.status === 404) throw new Error(getApiErrorMessage(e, 'Tournoi ou utilisateur introuvable.'));
    }
    throw e;
  }
}

export async function getFinishedTournaments(page = 1, pageSize = 10): Promise<TournamentsFinishedResponse> {
  const response: ApiResponse<TournamentsFinishedResponse> = await http.get(`/tournaments/my/finished?page=${page}&page_size=${pageSize}`);
  return response.data as TournamentsFinishedResponse;
}

export async function getUserTournamentMatches(): Promise<TournamentMatchOption[]> {
  const response: ApiResponse<TournamentMatchOptionsResponse> = await http.get('/tournaments/my/match-options');
  return (response.data?.matches ?? []).sort((a, b) => a.start_date - b.start_date);
}

/** Legacy helper: en attendant un vrai endpoint back, on renvoie un placeholder. */
export async function getTournamentPlayerBalance(tournamentId: number): Promise<number> {
  console.warn(`getTournamentPlayerBalance(${tournamentId}): Temporary implementation. Backend endpoint needed.`);
  return 1000;
}
