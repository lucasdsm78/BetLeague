// Types UI / entités côté front (consommés par les composants)

export interface LeagueSummary {
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

export interface MatchChoiceSummary {
  id: number;
  match_summary: MatchSummary;
  choice: '1' | 'N' | '2';
  status: string;
}

export interface TicketReadModel {
  id: number;
  mise: number;
  uuid: string;
  gain: number;
  status: string;
  league_summary?: LeagueSummary | null;
  tournament_match_summary?: unknown | null;
  match_choice_summaries: MatchChoiceSummary[];
}

export interface TicketsInProgressResponse {
  tickets: TicketReadModel[];
}

export interface TicketsFinishedResponse {
  tickets: TicketReadModel[];
}

