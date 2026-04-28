// services/api/matches.ts
// API module: matches (network + DTO typing)

import http, { type ApiResponse } from '../http';
import type { MatchesListResponse } from '../../types/api/matches';

export async function getMatchesPage(page: number, pageSize: number): Promise<MatchesListResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<MatchesListResponse> = await http.get(`/matches?${query.toString()}`);

  const data = res.data as MatchesListResponse | undefined;
  if (!data || !Array.isArray((data as any).matches)) {
    throw new Error('Format de réponse invalide');
  }

  return data;
}
