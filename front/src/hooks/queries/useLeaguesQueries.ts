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

function mapLeagueTab(tab: LeagueTab): 'participated' | 'created' | 'available' {
  return tab === 'participatedLeagues' ? 'participated' : tab === 'myLeagues' ? 'created' : 'available';
}

async function fetchLeaguesPage(
  tab: 'participated' | 'created' | 'available',
  page: number,
  pageSize: number,
) {
  if (tab === 'participated') {
    return getParticipatedLeaguesPage(page, pageSize);
  }
  if (tab === 'created') {
    return getCreatedLeaguesPage(page, pageSize);
  }
  return getAvailableLeaguesPage(page, pageSize);
}

export function useLeaguesListQuery(
  tab: LeagueTab,
  options?: { enabled?: boolean; page?: number; pageSize?: number }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const mappedTab = mapLeagueTab(tab);

  return useQuery<LeagueSummary[], Error>({
    queryKey: leaguesKeys.list(mappedTab, page, pageSize),
    queryFn: async () => (await fetchLeaguesPage(mappedTab, page, pageSize)).leagues,
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useLeagueCountQuery(
  tab: LeagueTab,
  options?: { enabled?: boolean }
) {
  const mappedTab = mapLeagueTab(tab);

  return useQuery<number, Error>({
    queryKey: leaguesKeys.count(mappedTab),
    queryFn: async () => (await fetchLeaguesPage(mappedTab, 1, 1)).total,
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
