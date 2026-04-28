import { useInfiniteQuery } from '@tanstack/react-query';
import { getMatchesPage } from '../../services/api/matches';
import type { MatchesListResponse } from '../../types/api/matches';
import { matchesKeys } from './matchesKeys';

/**
 * Infinite query pour /matches paginé.
 * Hypothèse: l'API renvoie { page, total_pages }.
 */
export function useMatchesInfiniteQuery(pageSize: number, options?: { enabled?: boolean }) {
  return useInfiniteQuery<MatchesListResponse, Error>({
    queryKey: [...matchesKeys.all, 'infinite', pageSize],
    enabled: options?.enabled ?? true,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getMatchesPage(Number(pageParam), pageSize),
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.page ?? 1;
      const totalPages = lastPage.total_pages ?? 1;
      const next = currentPage + 1;
      return next <= totalPages ? next : undefined;
    },
    staleTime: 15_000,
  });
}
