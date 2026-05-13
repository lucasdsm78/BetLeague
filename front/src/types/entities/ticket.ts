// Types UI / entités côté front (consommés par les composants)

export interface TicketLeagueSummary {
  id: number;
  name: string;
}

export interface MatchSummary {
  id: number;
  home_team: string;
  away_team: string;
  time: string; // ISO datetime string
  winner?: string | null;
}

export interface MatchOddSummary {
  bet_type: string;
  bet_name: string;
}

export interface MatchChoiceSummary {
  id: number;
  match_summary: MatchSummary;
  choice: string;
  status: string;
  match_odd_summary?: MatchOddSummary | null;
}

export interface TournamentMatchSummary {
  tournament_match_id: number;
  tournament_id: number;
  name?: string | null;
  stage_id: number;
  type: string;
}

export interface TicketReadModel {
  id: number;
  display_number: number;
  mise: number;
  uuid: string;
  gain: number;
  status: string;
  league_summary?: TicketLeagueSummary | null;
  tournament_match_summary?: TournamentMatchSummary | null;
  match_choice_summaries: MatchChoiceSummary[];
}

export interface SharedTicketReadModel {
  uuid: string;
  mise: number;
  gain: number;
  status: string;
  league_summary?: TicketLeagueSummary | null;
  tournament_match_summary?: TournamentMatchSummary | null;
  match_choice_summaries: MatchChoiceSummary[];
}

export interface TicketsInProgressResponse {
  tickets: TicketReadModel[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface TicketsFinishedResponse {
  tickets: TicketReadModel[];
  total?: number;
  page?: number;
  page_size?: number;
}
