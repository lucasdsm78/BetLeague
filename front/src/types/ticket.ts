// Types alignés avec le backend pour les tickets en cours

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
  status: string; // backend values (e.g., pending/correct/wrong)
}

export interface TicketReadModel {
  id: number;
  mise: number; // stake
  uuid: string;
  gain: number; // potential or actual depending on status
  status: string; // 'pending' | 'correct' | 'wrong' | ...
  league_summary?: LeagueSummary | null;
  tournament_match_summary?: unknown | null; // kept generic for now
  match_choice_summaries: MatchChoiceSummary[];
}

export interface TicketsInProgressResponse {
  tickets: TicketReadModel[];
}

