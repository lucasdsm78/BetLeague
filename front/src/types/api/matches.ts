export interface ApiMatchReadModel {
  id: number;
  home_team: string;
  away_team: string;
  time: string; // ISO
  cote_home: number;
  cote_draw: number;
  cote_away: number;
}

export interface MatchesListResponse {
  matches: ApiMatchReadModel[];
  page: number;
  page_size: number;
  total_pages: number;
  total_count?: number;
}

