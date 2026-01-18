// filepath: /Users/lucasdasilvamarques/BetLeague/front/src/services/matchesApi.ts
import secureApiClient, { type ApiResponse } from './secureApiClient';
import type { ApiMatchReadModel, MatchesListResponse } from '../types/api/matches';

// Ré-exports temporaires pour compat pendant la migration (à retirer quand tout importe depuis src/types/api)
export type { ApiMatchReadModel, MatchesListResponse };

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
