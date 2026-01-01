// ticketsApi.ts - service pour la création et gestion des tickets
import secureApiClient, { ApiResponse } from './secureApiClient';
import type { TicketsInProgressResponse, TicketsFinishedResponse, TicketReadModel } from 'types/ticket';

export interface MatchChoiceData {
  match_id: number;
  choice: '1' | 'N' | '2';
}

export interface TicketCreatePayload {
  match_choices: MatchChoiceData[];
  mise: number;
  gain?: number | null;
}

export interface TicketCreateResponse {
  message: string;
  ticket_id?: number;
}

export async function createTicket(leagueId: number, payload: TicketCreatePayload): Promise<TicketCreateResponse> {
  const query = new URLSearchParams({ league_id: String(leagueId) });
  const res: ApiResponse<TicketCreateResponse> = await secureApiClient.post(`/ticket/create?${query.toString()}`, payload);
  if (!res.success) {
    throw new Error(res.error || 'Création du ticket échouée');
  }
  return res.data as TicketCreateResponse;
}

export async function getInProgressTickets(): Promise<TicketsInProgressResponse> {
  // 1) Essaye l’endpoint documenté côté backend (/tickets/in-progress)
  let res: ApiResponse<TicketsInProgressResponse> = await secureApiClient.get('/tickets/in-progress');
  if (!res.success) {
    // 2) Fallback: certaines docs mentionnent /ticket/in-progress
    const fallback: ApiResponse<TicketsInProgressResponse> = await secureApiClient.get('/ticket/in-progress');
    if (!fallback.success) {
      throw new Error(fallback.error || res.error || 'Récupération des tickets en cours échouée');
    }
    const data = fallback.data as TicketsInProgressResponse;
    return { tickets: Array.isArray(data?.tickets) ? data.tickets : [] };
  }
  const data = res.data as TicketsInProgressResponse;
  return { tickets: Array.isArray(data?.tickets) ? data.tickets : [] };
}

export async function getFinishedTickets(): Promise<TicketsFinishedResponse> {
  // 1) Essai plural
  try {
    const res: ApiResponse<TicketsFinishedResponse> = await secureApiClient.get('/tickets/finished');
    if (res.success) {
      const data = res.data as TicketsFinishedResponse;
      return { tickets: Array.isArray(data?.tickets) ? data.tickets : [] };
    }
  } catch (e) {
    // ignore pour tenter le fallback
  }
  // 2) Fallback singulier
  const fallback: ApiResponse<TicketsFinishedResponse> = await secureApiClient.get('/ticket/finished');
  if (!fallback.success) {
    throw new Error(fallback.error || 'Récupération des tickets terminés échouée');
  }
  const data = fallback.data as TicketsFinishedResponse;
  return { tickets: Array.isArray(data?.tickets) ? data.tickets : [] };
}

export async function getTicketDetail(ticketId: number | string): Promise<TicketReadModel> {
  const tryParse = (data: any): TicketReadModel => {
    const ticket = data?.ticket ?? data;
    if (ticket && typeof ticket === 'object' && 'id' in ticket) return ticket as TicketReadModel;
    throw new Error('Format de réponse invalide pour le ticket');
  };

  // 1) Essai plural: /tickets/:id
  try {
    const resPlural: ApiResponse<any> = await secureApiClient.get(`/tickets/${ticketId}`);
    if (resPlural.success) {
      return tryParse(resPlural.data);
    }
    // si non succès, on tente le fallback
  } catch (e) {
    // ignore et tente le fallback
  }

  // 2) Fallback singulier: /ticket/:id
  const resSingular: ApiResponse<any> = await secureApiClient.get(`/ticket/${ticketId}`);
  if (!resSingular.success) {
    throw new Error(resSingular.error || 'Récupération du ticket échouée');
  }
  return tryParse(resSingular.data);
}

export async function deleteTicket(ticketId: number | string): Promise<{ success: boolean; message?: string }> {
  // 1) Endpoint documenté: /ticket/:id
  try {
    const res: ApiResponse<any> = await secureApiClient.delete(`/ticket/${ticketId}`);
    if (res.success) return { success: true, message: (res.data as any)?.message };
  } catch (e) {
    // ignore et tente le fallback
  }
  // 2) Fallback éventuel: /tickets/:id
  const fallback = await secureApiClient.delete(`/tickets/${ticketId}`);
  if (!fallback.success) {
    throw new Error(fallback.error || 'Suppression du ticket échouée');
  }
  return { success: true, message: (fallback.data as any)?.message };
}

/**
 * Create a bet on a tournament match
 * @param tournamentId Tournament ID
 * @param matchId Tournament match ID
 * @param payload Ticket creation payload
 * @returns Ticket creation response
 *
 * Backend error cases:
 * - 404: User not found, Tournament not found, Match not found
 * - 400: Mise superior to balance, Tournament already started, User not in tournament
 * - 500: Internal server error
 */
export async function createTournamentBet(
  tournamentId: number,
  matchId: number,
  payload: TicketCreatePayload
): Promise<TicketCreateResponse> {
  const res: ApiResponse<TicketCreateResponse> = await secureApiClient.post(
    `/tournament/${tournamentId}/match/${matchId}/bet`,
    payload
  );
  if (!res.success) {
    throw new Error(res.error || 'Création du pari de tournoi échouée');
  }
  return res.data as TicketCreateResponse;
}

export default { createTicket, getInProgressTickets, getFinishedTickets, getTicketDetail, deleteTicket, createTournamentBet };
