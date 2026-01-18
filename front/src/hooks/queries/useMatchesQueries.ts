import { useQuery } from '@tanstack/react-query';
import { getMatchesPage, type MatchesListResponse } from '../../services/matchesApi';
import { matchesKeys } from './matchesKeys';

export function useMatchesPageQuery(page: number, pageSize: number, options?: { enabled?: boolean }) {
  return useQuery<MatchesListResponse, Error>({
    queryKey: matchesKeys.page(page, pageSize),
    queryFn: () => getMatchesPage(page, pageSize),
    enabled: options?.enabled ?? true,
    // UX pagination fluide (évite flash)
    placeholderData: (prev) => prev,
  });
}

