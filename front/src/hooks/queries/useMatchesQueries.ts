import { useQuery } from '@tanstack/react-query';
import { getMatchesPage } from '../../services/matchesApi';
import type { MatchesListResponse } from '../../types/api/matches';
import { matchesKeys } from './matchesKeys';

export function useMatchesPageQuery(
  page: number,
  pageSize: number,
  options?: { enabled?: boolean }
) {
  return useQuery<MatchesListResponse, Error>({
    queryKey: matchesKeys.list({ page, pageSize }),
    queryFn: () => getMatchesPage(page, pageSize),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

