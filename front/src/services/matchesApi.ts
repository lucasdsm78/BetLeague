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

export interface GetMatchesApiResponse {
  matches: ApiMatchReadModel[];
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
}

export async function getMatches(): Promise<ApiMatchReadModel[]> {
  const res: ApiResponse<GetMatchesApiResponse> = await secureApiClient.get('/matches');

  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les matchs');
  }

  return res.data?.matches ?? [];
}

export async function getMatchesPage(page: number, pageSize: number): Promise<GetMatchesApiResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<GetMatchesApiResponse> = await secureApiClient.get(`/matches?${query.toString()}`);

  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les matchs');
  }

  return res.data as GetMatchesApiResponse;
}

export default {
  getMatches,
  getMatchesPage,
};
