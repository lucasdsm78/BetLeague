import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import secureApiClient from '../../services/secureApiClient';
import { leaguesKeys } from './leaguesKeys';
import type { LeagueSummary } from '../../types';
import {
  getAvailableLeaguesPage,
  getCreatedLeaguesPage,
  getParticipatedLeaguesPage,
  getLeagueRanking,
} from '../../services/api/leagues';

type LeagueTab = 'participatedLeagues' | 'myLeagues' | 'availableLeagues';

export function useLeaguesListQuery(
  tab: LeagueTab,
  options?: { enabled?: boolean; page?: number; pageSize?: number }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;

  const mappedTab: 'participated' | 'created' | 'available' =
    tab === 'participatedLeagues' ? 'participated' : tab === 'myLeagues' ? 'created' : 'available';

  return useQuery<LeagueSummary[], Error>({
    queryKey: leaguesKeys.list(mappedTab, page, pageSize),
    queryFn: async () => {
      if (mappedTab === 'participated') {
        const pageData = await getParticipatedLeaguesPage(page, pageSize);
        return pageData.leagues;
      }
      if (mappedTab === 'created') {
        const pageData = await getCreatedLeaguesPage(page, pageSize);
        return pageData.leagues;
      }
      const pageData = await getAvailableLeaguesPage(page, pageSize);
      return pageData.leagues;
    },
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useJoinLeagueMutation() {
  const qc = useQueryClient();

  return useMutation<{ message?: string }, Error, { leagueId: number }>({
    mutationFn: async ({ leagueId }) => {
      if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
      // Backend: POST /league/{id}/join
      const res = await secureApiClient.post<{ message?: string }>(`/league/${leagueId}/join`);
      return res.data ?? {};
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leaguesKeys.all });
    },
  });
}

export function useLeagueRankingQuery(leagueId: number | null, options?: { enabled?: boolean }) {
  return useQuery<Array<{ position: number; pseudo: string; nb_btl: number; nb_win: number; nb_lose: number }>, Error>({
    queryKey: leaguesKeys.ranking(leagueId ?? -1),
    queryFn: async () => {
      if (!leagueId) throw new Error('Ligue invalide');
      return getLeagueRanking(leagueId);
    },
    enabled: (options?.enabled ?? true) && !!leagueId,
    staleTime: 10_000,
  });
}
