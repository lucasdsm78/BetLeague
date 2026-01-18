import type { ApiUserSearchResult } from '../../types/api/leagues';
import type { UserSearchResult } from '../../types/entities/userSearch';

export function mapApiUserSearchResultToUi(api: ApiUserSearchResult): UserSearchResult {
  return {
    id: Number((api as any).id),
    pseudo: String((api as any).pseudo || 'Utilisateur'),
    email: String((api as any).email || ''),
  };
}

