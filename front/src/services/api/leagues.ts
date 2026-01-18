// services/api/leagues.ts
// API module: leagues (network + DTO typing)

import http, { type ApiResponse } from '../http';
import { mapLeaguesPage, type LeaguesPage, type LeaguesPageApi } from '../leaguesPaging';
import type {
  ApiLeagueCreateRequest,
  ApiLeagueMessageResponse,
  ApiLeagueRankingRow,
  ApiLeagueBalancesBulkResponse,
  ApiLeagueBalanceResponse,
  ApiUserSearchResult,
  ApiInvitationReceived,
} from '../../types/api/leagues';
import type { UserSearchResult } from '../../types/entities/userSearch';
import { mapApiUserSearchResultToUi } from '../mappers/userSearchMapper';

// Compat API légère (utilisée dans quelques endroits)
export interface LeagueSummaryApi {
  id: number;
  name: string;
  start_date?: number;
  is_started?: boolean;
  nb_players_remaining?: number;
}

export interface ParticipatedLeaguesResponse {
  leagues: LeagueSummaryApi[];
}

export interface LeagueBalanceResponse {
  nb_btl: number;
}

// DTO local (réponse update invitation) : à migrer ensuite dans src/types/api/leagues.ts si on veut.
export interface InvitationActionResponse {
  message: string;
  success: boolean;
  error?: string;
}

export async function createLeague(payload: ApiLeagueCreateRequest): Promise<ApiLeagueMessageResponse> {
  const res: ApiResponse<ApiLeagueMessageResponse> = await http.post('/league/create', payload);
  if (!res.success) throw new Error(res.error || 'Erreur lors de la création de la ligue');
  return res.data as ApiLeagueMessageResponse;
}

export async function getAvailableLeaguesPage(page = 1, pageSize = 10): Promise<LeaguesPage> {
  const res: ApiResponse<LeaguesPageApi> = await http.get('/leagues', {
    // `secureApiClient` ne gère pas `params` nativement: ce champ est ignoré.
    // On encode explicitement dans l'URL.
  });

  // fallback: URL avec query
  if (!res.success) {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    const res2: ApiResponse<LeaguesPageApi> = await http.get(`/leagues?${query.toString()}`);
    if (!res2.success) throw new Error(res2.error || 'Erreur lors du chargement des ligues disponibles');
    return mapLeaguesPage(res2.data as LeaguesPageApi);
  }

  // si le back ignore la pagination, on mappe quand même
  return mapLeaguesPage(res.data as LeaguesPageApi);
}

export async function getCreatedLeaguesPage(page = 1, pageSize = 10): Promise<LeaguesPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<LeaguesPageApi> = await http.get(`/leagues/created?${query.toString()}`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des ligues créées');
  return mapLeaguesPage(res.data as LeaguesPageApi);
}

export async function getParticipatedLeaguesPage(page = 1, pageSize = 10): Promise<LeaguesPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<LeaguesPageApi> = await http.get(`/leagues/participated?${query.toString()}`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des ligues rejointes');
  return mapLeaguesPage(res.data as LeaguesPageApi);
}

export async function joinLeague(leagueId: number): Promise<ApiLeagueMessageResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueMessageResponse> = await http.post(`/league/${leagueId}/join`);
  if (!res.success) throw new Error(res.error || 'Erreur lors de la tentative de rejoindre la ligue');
  return (res.data ?? {}) as ApiLeagueMessageResponse;
}

export async function leaveLeague(leagueId: number): Promise<{ message: string }> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<{ message: string }> = await http.delete(`/league/${leagueId}/player/delete`);
  if (!res.success) throw new Error(res.error || 'Erreur lors de la désinscription de la ligue');
  return (res.data ?? { message: '' }) as { message: string };
}

export async function getLeagueRanking(leagueId: number): Promise<ApiLeagueRankingRow[]> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueRankingRow[]> = await http.get(`/league/${leagueId}/rank`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement du classement');
  if (!Array.isArray(res.data)) throw new Error('Format de réponse invalide');
  return res.data as ApiLeagueRankingRow[];
}

export async function getLeaguesBalancesBulk(leagueIds: number[]): Promise<ApiLeagueBalancesBulkResponse> {
  const ids = Array.from(new Set(leagueIds)).filter((id) => Number.isInteger(id) && id > 0);
  const res: ApiResponse<ApiLeagueBalancesBulkResponse> = await http.post('/leagues/balances', { league_ids: ids });
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des soldes (bulk)');
  return (res.data ?? { balances: {}, not_found: [], forbidden: [] }) as ApiLeagueBalancesBulkResponse;
}

export async function getLeagueBalanceResponse(leagueId: number): Promise<ApiLeagueBalanceResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueBalanceResponse> = await http.get(`/league/${leagueId}/balance`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement du solde de la ligue');
  return { nb_btl: Number((res.data as any)?.nb_btl) || 0 };
}

// Compat: la plupart des composants attendent un number.
export async function getLeagueBalance(leagueId: number): Promise<number> {
  const dto = await getLeagueBalanceResponse(leagueId);
  return dto.nb_btl;
}

export async function getLeagueDetails(leagueId: number): Promise<any> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<any> = await http.get(`/league/${leagueId}`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des détails de la ligue');
  return res.data;
}

export async function getReceivedInvitations(): Promise<ApiInvitationReceived[]> {
  const res: ApiResponse<ApiInvitationReceived[]> = await http.get('/invitations?is_received=true');
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des invitations');

  const data = res.data;
  if (!data) return [];
  if (!Array.isArray(data)) throw new Error('Format de réponse invalide');
  return data;
}

export async function updateInvitation(invitationId: number, accept: boolean): Promise<InvitationActionResponse> {
  if (!Number.isInteger(invitationId) || invitationId <= 0) throw new Error("ID d'invitation invalide");
  const endpoint = `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`;
  const res: ApiResponse<InvitationActionResponse> = await http.put(endpoint);
  if (!res.success) throw new Error(res.error || "Erreur lors de la mise à jour de l'invitation");
  return (res.data ?? { message: '', success: true }) as InvitationActionResponse;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const trimmed = String(query ?? '').trim();
  if (trimmed.length < 2) return [];

  const res: ApiResponse<{ users: ApiUserSearchResult[]; total: number; query: string }> = await http.get(
    `/auth/users/search?q=${encodeURIComponent(trimmed)}`
  );

  if (!res.success) throw new Error(res.error || 'Erreur lors de la recherche utilisateur');
  const users = Array.isArray(res.data?.users) ? res.data!.users : [];
  return users.map((u) => mapApiUserSearchResultToUi(u));
}

export async function inviteUserToLeague(leagueId: number, userId: number): Promise<ApiLeagueMessageResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("ID d'utilisateur invalide");

  const res: ApiResponse<ApiLeagueMessageResponse> = await http.post(`/league/${leagueId}/${userId}/invite`);
  if (!res.success) throw new Error(res.error || "Erreur lors de l'invitation de l'utilisateur");
  return (res.data ?? {}) as ApiLeagueMessageResponse;
}

// Fonctions API "lite" existantes
export async function getParticipatedLeagues(): Promise<LeagueSummaryApi[]> {
  const res: ApiResponse<ParticipatedLeaguesResponse> = await http.get('/leagues/participated');
  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les ligues');
  }
  return (res.data?.leagues ?? []);
}

export async function getLeagueBalanceAmount(leagueId: number): Promise<number> {
  return getLeagueBalance(leagueId);
}

export default {
  createLeague,
  getAvailableLeaguesPage,
  getCreatedLeaguesPage,
  getParticipatedLeaguesPage,
  joinLeague,
  leaveLeague,
  getLeagueRanking,
  getLeaguesBalancesBulk,
  getLeagueBalance: getLeagueBalanceResponse,
  getLeagueDetails,
  getReceivedInvitations,
  updateInvitation,
  searchUsers,
  inviteUserToLeague,
  getParticipatedLeagues,
  getLeagueBalanceAmount,
};
