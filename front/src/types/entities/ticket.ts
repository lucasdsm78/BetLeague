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

export interface TicketReadModel {
  id: number;
  mise: number;
  uuid: string;
  gain: number;
  status: string;
  league_summary?: TicketLeagueSummary | null;
  tournament_match_summary?: unknown | null;
  match_choice_summaries: MatchChoiceSummary[];
}

export interface TicketsInProgressResponse {
  tickets: TicketReadModel[];
}

export interface TicketsFinishedResponse {
  tickets: TicketReadModel[];
}
