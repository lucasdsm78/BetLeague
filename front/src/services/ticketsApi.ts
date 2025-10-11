// ticketsApi.ts - service pour la création et gestion des tickets
import secureApiClient, { ApiResponse } from './secureApiClient';

export interface MatchChoiceData {
  match_id: number;
  choice: 'home' | 'draw' | 'away';
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

export default { createTicket };
