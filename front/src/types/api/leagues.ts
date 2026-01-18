import type { ApiPaginatedResponse } from './common';

// --------------------
// DTOs (Backend API)
// --------------------

export interface ApiLeagueSummary {
  id: number;
  name: string;
  max_players: number;
  is_private?: boolean;
  is_free?: boolean;
  nb_btl?: number;
  // Le back semble exposer aussi des champs pluss selon endpoints.
  // On les garde optionnels pour migration progressive.
  start_date?: string | number;
  end_date?: string | number;
  user_creator?: {
    id: number;
    pseudo: string;
  };
  nb_players_remaining?: number;
  is_started?: boolean;
}

export type ApiLeaguesPage = ApiPaginatedResponse<ApiLeagueSummary>;

export interface ApiLeagueCreateRequest {
  name: string;
  max_players: number;
  is_private: boolean;
  is_free: boolean;
  nb_btl?: number;
}

export interface ApiLeagueMessageResponse {
  message: string;
}

export interface ApiInvitationReceived {
  id: number;
  league: ApiLeagueSummary;
  status: string;
}

export interface ApiLeagueBalanceResponse {
  nb_btl: number;
}

export interface ApiLeagueBalancesBulkResponse {
  balances: Record<number, number>;
  not_found: number[];
  forbidden: number[];
}

export interface ApiUserSearchResult {
  id: number;
  pseudo: string;
  email: string;
}

export interface ApiLeagueRankingRow {
  position: number;
  pseudo: string;
  nb_btl: number;
  nb_win: number;
  nb_lose: number;
}
