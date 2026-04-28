export interface ApiMatchOddReadModel {
  id: number;
  bet_type: string;
  bet_name: string;
  value: string;
  odd: number;
  result?: string | null;
}

export interface ApiMatchReadModel {
  id: number;
  uuid?: string;
  home_team: string;
  away_team: string;
  time: string; // ISO
  created_at?: number;
  updated_at?: number;
  sport?: string;
  league_name?: string | null;
  logo_home?: string | null;
  logo_away?: string | null;
  score_home?: number | null;
  score_away?: number | null;
  status?: string;
  winner?: string | null;
  odds?: ApiMatchOddReadModel[];
}

export interface MatchesListResponse {
  matches: ApiMatchReadModel[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
