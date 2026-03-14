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

export type TicketsListParams = {
  page?: number;
  pageSize?: number;
  leagueId?: number | null;
  isTournament?: boolean | null;
};

function buildTicketsQuery(params?: TicketsListParams): string {
  const q = new URLSearchParams();
  if (!params) return '';
  if (typeof params.page === 'number') q.set('page', String(params.page));
  if (typeof params.pageSize === 'number') q.set('page_size', String(params.pageSize));
  if (typeof params.leagueId === 'number') q.set('league_id', String(params.leagueId));
  if (params.isTournament === true) q.set('is_tournament', 'true');
  return q.toString();
}

function normalizeInProgress(
  data: ApiTicketsInProgressResponse | { tickets?: ApiTicketReadModel[] } | ApiTicketReadModel[] | unknown
): TicketsInProgressResponse {
  const ticketsPayload = (data as any)?.tickets ?? (data as any)?.ticket ?? data;
  const tickets = Array.isArray(ticketsPayload) ? (ticketsPayload as ApiTicketReadModel[]) : [];

  const mapped: TicketReadModel[] = [];
  for (const t of tickets) {
    const ui = tryMapApiTicketToUi(t);
    if (ui) mapped.push(ui);
  }

  const total = typeof (data as any)?.total === 'number' ? (data as any).total : undefined;
  const page = typeof (data as any)?.page === 'number' ? (data as any).page : undefined;
  const page_size = typeof (data as any)?.page_size === 'number' ? (data as any).page_size : undefined;

  return { tickets: mapped, total, page, page_size };
}

function normalizeFinished(
  data: ApiTicketsFinishedResponse | { tickets?: ApiTicketReadModel[] } | ApiTicketReadModel[] | unknown
): TicketsFinishedResponse {
  const ticketsPayload = (data as any)?.tickets ?? (data as any)?.ticket ?? data;
  const tickets = Array.isArray(ticketsPayload) ? (ticketsPayload as ApiTicketReadModel[]) : [];

  const mapped: TicketReadModel[] = [];
  for (const t of tickets) {
    const ui = tryMapApiTicketToUi(t);
    if (ui) mapped.push(ui);
  }

  const total = typeof (data as any)?.total === 'number' ? (data as any).total : undefined;
  const page = typeof (data as any)?.page === 'number' ? (data as any).page : undefined;
  const page_size = typeof (data as any)?.page_size === 'number' ? (data as any).page_size : undefined;

  return { tickets: mapped, total, page, page_size };
}

export async function createTicket(leagueId: number, payload: ApiTicketCreateRequest): Promise<ApiTicketCreateResponse> {
  const query = new URLSearchParams({ league_id: String(leagueId) });
  const res: ApiResponse<ApiTicketCreateResponse> = await http.post(`/ticket/create?${query.toString()}`, payload);
  return res.data as ApiTicketCreateResponse;
}

export async function getInProgressTickets(params?: TicketsListParams): Promise<TicketsInProgressResponse> {
  const endpoints = ['/tickets/in-progress', '/ticket/in-progress', '/tickets/in_progress', '/ticket/in_progress'];
  const query = buildTicketsQuery(params);

  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const url = query ? `${endpoint}?${query}` : endpoint;
      const res: ApiResponse<ApiTicketsInProgressResponse | ApiTicketReadModel[]> = await http.get(url, {
        skipCache: true,
        cache: 'no-store',
      });

      if (process.env.NODE_ENV === 'development') {
        const raw = (res as any)?.data;
        const rawTickets = Array.isArray((raw as any)?.tickets)
          ? (raw as any).tickets
          : Array.isArray(raw)
            ? raw
            : [];
        // eslint-disable-next-line no-console
        console.log('[tickets][in-progress]', { endpoint, status: res.status, rawCount: rawTickets.length, query });
      }

      const normalized = normalizeInProgress(res.data);
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[tickets][in-progress][mapped]', { endpoint, mappedCount: normalized.tickets.length, total: normalized.total });
      }
      return normalized;
    } catch (e) {
      lastError = e;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Récupération des tickets en cours échouée'));
}

export async function getFinishedTickets(params?: TicketsListParams): Promise<TicketsFinishedResponse> {
  const query = buildTicketsQuery(params);

  try {
    const url = query ? `/tickets/finished?${query}` : '/tickets/finished';
    const res: ApiResponse<ApiTicketsFinishedResponse | ApiTicketReadModel[]> = await http.get(url, {
      skipCache: true,
      cache: 'no-store',
    });
    return normalizeFinished(res.data);
  } catch {
    // ignore pour tenter le fallback
  }

  const fallbackUrl = query ? `/ticket/finished?${query}` : '/ticket/finished';
  const fallback: ApiResponse<ApiTicketsFinishedResponse | ApiTicketReadModel[]> = await http.get(fallbackUrl, {
    skipCache: true,
    cache: 'no-store',
  });
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
    return tryParse(resPlural.data as ApiTicketDetailResponse);
  } catch {
    // ignore et tente le fallback
  }

  const resSingular: ApiResponse<ApiTicketDetailResponse> = await http.get(`/ticket/${ticketId}`, { signal: options?.signal });
  return tryParse(resSingular.data as ApiTicketDetailResponse);
}

export async function deleteTicket(ticketId: number | string): Promise<{ success: boolean; message?: string }> {
  const res: ApiResponse<{ message?: string }> = await http.delete(`/ticket/${ticketId}`);
  return { success: true, message: res.data?.message };
}

export async function createTournamentBet(
  tournamentId: number,
  matchId: number,
  payload: ApiTicketCreateRequest
): Promise<ApiTicketCreateResponse> {
  const res: ApiResponse<ApiTicketCreateResponse> = await http.post(`/tournament/${tournamentId}/match/${matchId}/bet`, payload);
  return res.data as ApiTicketCreateResponse;
}
