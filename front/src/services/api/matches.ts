// services/api/matches.ts
// API module: matches (network + DTO typing)

import http, { type ApiResponse } from '../http';
import type { MatchesListResponse } from '../../types/api/matches';
import type { ApiMatchOddReadModel } from '../../types/api/matches';

export interface MatchOddsByMatchIdsResponse {
  odds_by_match_id: Record<number, ApiMatchOddReadModel[]>;
}

export async function getMatchesPage(page: number, pageSize: number): Promise<MatchesListResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<MatchesListResponse> = await http.get(`/matches?${query.toString()}`);

  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les matchs');
  }

  const data = res.data as MatchesListResponse | undefined;
  if (!data || !Array.isArray((data as any).matches)) {
    throw new Error('Format de réponse invalide');
  }

  return data;
}

export async function getMatchOddsByMatchIds(matchIds: number[], betType?: string): Promise<Record<number, ApiMatchOddReadModel[]>> {
  const uniq = Array.from(new Set(matchIds.filter((x) => Number.isFinite(x) && x > 0)));
  if (uniq.length === 0) return {};

  // URL-safe: ids séparés par des virgules
  const query = new URLSearchParams();
  query.set('match_ids', uniq.join(','));
  if (betType) query.set('bet_type', betType);

  const res: ApiResponse<MatchOddsByMatchIdsResponse> = await http.get(`/match-odds?${query.toString()}`);
  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les cotes');
  }

  const data = res.data as MatchOddsByMatchIdsResponse | undefined;
  if (!data || typeof (data as any).odds_by_match_id !== 'object') {
    throw new Error('Format de réponse invalide');
  }
  return (data as any).odds_by_match_id as Record<number, ApiMatchOddReadModel[]>;
}
