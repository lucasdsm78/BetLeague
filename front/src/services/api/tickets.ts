// services/api/tickets.ts
// API module: tickets (network + DTO typing). UI mapping reste dans mappers/entities.

import http, { type ApiResponse } from '../http';
import type {
  ApiMatchChoiceCreate,
  ApiTicketCreateRequest,
  ApiTicketCreateResponse,
  ApiTicketsInProgressResponse,
  ApiTicketsFinishedResponse,
  ApiTicketDetailResponse,
  ApiTicketReadModel,
} from '../../types/api/tickets';
import type { TicketsInProgressResponse, TicketsFinishedResponse, TicketReadModel } from '../../types/entities/ticket';
import { mapApiTicketToUi, tryMapApiTicketToUi } from '../mappers/ticketMapper';

function normalizeInProgress(
  data: ApiTicketsInProgressResponse | { tickets?: ApiTicketReadModel[] } | ApiTicketReadModel[] | unknown
): TicketsInProgressResponse {
  const payload = (data as any)?.tickets ?? (data as any)?.ticket ?? data;
  const tickets = Array.isArray(payload) ? (payload as ApiTicketReadModel[]) : [];

  const mapped: TicketReadModel[] = [];
  for (const t of tickets) {
    const ui = tryMapApiTicketToUi(t);
    if (ui) mapped.push(ui);
  }

  return { tickets: mapped };
}

function normalizeFinished(
  data: ApiTicketsFinishedResponse | { tickets?: ApiTicketReadModel[] } | ApiTicketReadModel[] | unknown
): TicketsFinishedResponse {
  const payload = (data as any)?.tickets ?? (data as any)?.ticket ?? data;
  const tickets = Array.isArray(payload) ? (payload as ApiTicketReadModel[]) : [];

  const mapped: TicketReadModel[] = [];
  for (const t of tickets) {
    const ui = tryMapApiTicketToUi(t);
    if (ui) mapped.push(ui);
  }

  return { tickets: mapped };
}

export async function createTicket(leagueId: number, payload: ApiTicketCreateRequest): Promise<ApiTicketCreateResponse> {
  const query = new URLSearchParams({ league_id: String(leagueId) });
  const res: ApiResponse<ApiTicketCreateResponse> = await http.post(`/ticket/create?${query.toString()}`, payload);
  if (!res.success) {
    throw new Error(res.error || 'Création du ticket échouée');
  }
  return res.data as ApiTicketCreateResponse;
}

export async function getInProgressTickets(): Promise<TicketsInProgressResponse> {
  const endpoints = ['/tickets/in-progress', '/ticket/in-progress', '/tickets/in_progress', '/ticket/in_progress'];

  let lastError: string | undefined;
  for (const endpoint of endpoints) {
    const res: ApiResponse<ApiTicketsInProgressResponse | ApiTicketReadModel[]> = await http.get(endpoint);
    if (res.success) {
      return normalizeInProgress(res.data);
    }
    lastError = res.error;
  }

  throw new Error(lastError || 'Récupération des tickets en cours échouée');
}

export async function getFinishedTickets(): Promise<TicketsFinishedResponse> {
  try {
    const res: ApiResponse<ApiTicketsFinishedResponse | ApiTicketReadModel[]> = await http.get('/tickets/finished');
    if (res.success) {
      return normalizeFinished(res.data);
    }
  } catch {
    // ignore pour tenter le fallback
  }

  const fallback: ApiResponse<ApiTicketsFinishedResponse | ApiTicketReadModel[]> = await http.get('/ticket/finished');
  if (!fallback.success) {
    throw new Error(fallback.error || 'Récupération des tickets terminés échouée');
  }
  return normalizeFinished(fallback.data);
}

export async function getTicketDetail(
  ticketId: number | string,
  options?: { signal?: AbortSignal }
): Promise<TicketReadModel> {
  if (ticketId === null || ticketId === undefined || `${ticketId}`.trim() === '') {
    throw new Error('Ticket invalide');
  }

  const tryParse = (data: ApiTicketDetailResponse): TicketReadModel => {
    const ticket = (data as any)?.ticket ?? data;
    if (!ticket || typeof ticket !== 'object') {
      throw new Error('Format de réponse invalide pour le ticket');
    }
    return mapApiTicketToUi(ticket as ApiTicketReadModel);
  };

  try {
    const resPlural: ApiResponse<ApiTicketDetailResponse> = await http.get(`/tickets/${ticketId}`, { signal: options?.signal });
    if (resPlural.success) {
      return tryParse(resPlural.data as ApiTicketDetailResponse);
    }
  } catch {
    // ignore et tente le fallback
  }

  const resSingular: ApiResponse<ApiTicketDetailResponse> = await http.get(`/ticket/${ticketId}`, { signal: options?.signal });
  if (!resSingular.success) {
    throw new Error(resSingular.error || 'Récupération du ticket échouée');
  }
  return tryParse(resSingular.data as ApiTicketDetailResponse);
}

export async function deleteTicket(ticketId: number | string): Promise<{ success: boolean; message?: string }> {
  const res: ApiResponse<{ message?: string }> = await http.delete(`/ticket/${ticketId}`);
  if (!res.success) {
    throw new Error(res.error || 'Suppression du ticket échouée');
  }
  return { success: true, message: res.data?.message };
}

export async function createTournamentBet(
  tournamentId: number,
  matchId: number,
  payload: ApiTicketCreateRequest
): Promise<ApiTicketCreateResponse> {
  const res: ApiResponse<ApiTicketCreateResponse> = await http.post(`/tournament/${tournamentId}/match/${matchId}/bet`, payload);
  if (!res.success) {
    throw new Error(res.error || 'Création du pari de tournoi échouée');
  }
  return res.data as ApiTicketCreateResponse;
}
