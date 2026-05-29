import { useQuery } from '@tanstack/react-query';
import { getMatchesPage } from '../../services/api/matches';
import type { MatchesListResponse } from '../../types/api/matches';
import { matchesKeys } from './matchesKeys';

export function useMatchesPageQuery(
  page: number,
  pageSize: number,
  options?: { enabled?: boolean; leagueId?: number }
) {
  return useQuery<MatchesListResponse, Error>({
    queryKey: matchesKeys.list({ page, pageSize, leagueId: options?.leagueId }),
    queryFn: () => getMatchesPage({ page, pageSize, leagueId: options?.leagueId }),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

