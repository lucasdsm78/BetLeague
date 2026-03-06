// Types API (DTO) pour les endpoints tickets

import type { ApiLeagueSummary } from './leagues';

export interface ApiMatchSummary {
  id: number;
  home_team: string;
  away_team: string;
  time: string; // ISO datetime string
  winner?: string | null;
}

export interface ApiMatchOddSummary {
  bet_type: string;
  bet_name: string;
}

export interface ApiMatchChoiceSummary {
  id: number;
  match_summary: ApiMatchSummary;
  choice: string;
  status: string;
  match_odd_summary?: ApiMatchOddSummary;
}

// Read model tel que renvoyé par l'API
export interface ApiTicketReadModel {
  id: number;
  mise: number;
  uuid: string;
  gain: number;
  status: string;
  league_summary?: ApiLeagueSummary | null;
  tournament_match_summary?: unknown | null;
  match_choice_summaries: ApiMatchChoiceSummary[];
}

// --- Réponses API ---

export interface ApiTicketsInProgressResponse {
  tickets: ApiTicketReadModel[];
}

export interface ApiTicketsFinishedResponse {
  tickets: ApiTicketReadModel[];
}

// Le backend varie souvent entre { ticket: ... } et ...
export type ApiTicketDetailResponse = { ticket: ApiTicketReadModel } | ApiTicketReadModel;

// --- Payloads API (existants) ---

export interface ApiMatchChoiceCreate {
  match_id: number;
  match_odd_id: number;
}

export interface ApiTicketCreateRequest {
  mise: number;
  match_choices: ApiMatchChoiceCreate[];
  // Certains écrans historiques envoyaient encore ce champ.
  // On le garde optionnel pour compatibilité durant la migration.
  gain?: number | null;
}

export interface ApiTicketCreateResponse {
  success: boolean;
  ticket_id?: number;
  message?: string;
}
