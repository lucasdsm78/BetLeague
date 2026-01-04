// filepath: /Users/lucasdasilvamarques/BetLeague/front/src/services/matchesApi.ts
import secureApiClient, { ApiResponse } from './secureApiClient';

// Modèle de réponse API backend (MatchReadModel)
export interface ApiMatchReadModel {
  id: number;
  uuid: string;
  home_team: string;
  away_team: string;
  cote_home: number;
  cote_draw: number;
  cote_away: number;
  time: string; // ISO datetime string
  created_at: number;
  updated_at: number;
}

export interface MatchesListResponse {
  matches: ApiMatchReadModel[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export async function getMatches(): Promise<ApiMatchReadModel[]> {
  const res: ApiResponse<MatchesListResponse> = await secureApiClient.get('/matches');

  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les matchs');
  }

  return res.data?.matches ?? [];
}

export async function getMatchesPage(page: number, pageSize: number): Promise<MatchesListResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<MatchesListResponse> = await secureApiClient.get(`/matches?${query.toString()}`);

  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les matchs');
  }

  const data = res.data as MatchesListResponse | undefined;
  if (!data || !Array.isArray(data.matches)) {
    throw new Error('Format de réponse invalide');
  }
  return data;
}

export default {
  getMatches,
  getMatchesPage,
};
