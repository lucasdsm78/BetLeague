/**
 * Types API - Tournament
 *
 * Convention:
 * - Ces types représentent les DTO renvoyés/attendus par l'API.
 * - Les transformations UI (formatage, labels, etc.) se font dans des hooks ou des helpers.
 */

export interface TournamentCreationAccess {
  monthly_free_tournaments_limit: number;
  monthly_free_tournaments_used: number;
  monthly_free_tournaments_remaining: number;
  has_active_subscription: boolean;
  can_create_tournament: boolean;
  requires_tournament_subscription: boolean;
}

export interface TournamentCreateRequest {
  name: string;
  is_private: boolean;
  max_players: number;
  start_date?: number;
}

export interface TournamentCreateResponse extends Omit<TournamentCreationAccess, 'has_active_subscription'> {
  message: string;
  tournament_id?: number;
  tournament_uuid?: string;
  name?: string;
  max_players?: number;
}

export interface Tournament {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  max_players: number;
  current_players: number;
  start_date: number;
  end_date: number;
}

export interface TournamentsResponse {
  tournaments: Tournament[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
}

export interface TournamentStage {
  id: number;
  tournament_id: number;
  type: string;
  user_summary: UserSummary;
  is_active: boolean;
  is_completed: boolean;
  created_at?: number;
  start_date?: number;
  end_date?: number;
}

export interface TournamentStagesResponse {
  stages: TournamentStage[];
}

export interface MyTournament {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  max_players: number;
}

export interface MyTournamentsResponse {
  tournaments: MyTournament[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface PlayerSummary {
  id: number;
  email: string;
  pseudo: string;
}

export interface StageMatch {
  id: number;
  tournament_id: number;
  stage: string;
  player1_summary: PlayerSummary;
  player2_summary: PlayerSummary;
  start_date: number; // timestamp in milliseconds
  end_date: number; // timestamp in milliseconds
  winner_id: number | null;
  loser_id: number | null;
}

export interface StageMatchesResponse {
  matches: StageMatch[];
}

export interface TournamentFinished {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  start_date: number; // timestamp in milliseconds
  end_date: number; // timestamp in milliseconds
}

export interface TournamentsFinishedResponse {
  tournaments: TournamentFinished[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface TournamentMatchOption {
  id: number;
  tournament_id: number;
  tournament_name: string;
  tournament_uuid: string;
  stage_type: string;
  stage_label: string;
  player1_name: string;
  player2_name: string;
  start_date: number;
  end_date: number;
  display_label: string;
}

export interface TournamentMatchOptionsResponse {
  matches: TournamentMatchOption[];
}

export interface TournamentPlayerBalance {
  tournament_id: number;
  nb_btl: number;
}

export interface CreatedTournament {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  start_date: number;
  end_date: number;
}

export interface CreatedTournamentsResponse {
  tournaments: CreatedTournament[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface TournamentInvitationUser {
  id: number;
  email: string;
  pseudo: string;
}

export interface TournamentInvitation {
  id: number;
  status: string;
  created_at: number;
  user: TournamentInvitationUser;
}

export interface TournamentInvitationsResponse {
  tournament_id: number;
  invitations: TournamentInvitation[];
}
