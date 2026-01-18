// services/api/users.ts
// API module: users

import http, { type ApiResponse } from '../http';
import type { ApiUserSearchResult } from '../../types/api/leagues';
import type { UserSearchResult } from '../../types/entities/userSearch';
import { mapApiUserSearchResultToUi } from '../mappers/userSearchMapper';

export interface ApiUsersSearchResponse {
  users: ApiUserSearchResult[];
  total: number;
  query: string;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const trimmed = String(query ?? '').trim();
  if (trimmed.length < 2) return [];

  const res: ApiResponse<ApiUsersSearchResponse> = await http.get(
    `/auth/users/search?q=${encodeURIComponent(trimmed)}`
  );

  if (!res.success) throw new Error(res.error || 'Erreur lors de la recherche utilisateur');
  const users = Array.isArray(res.data?.users) ? res.data!.users : [];
  return users.map(mapApiUserSearchResultToUi);
}

export default { searchUsers };

