// ticketsApi.ts - service pour la création et gestion des tickets
import secureApiClient, { ApiResponse } from './secureApiClient';
import type { TicketsInProgressResponse } from '../types/ticket';

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

export default { createTicket, getInProgressTickets };
