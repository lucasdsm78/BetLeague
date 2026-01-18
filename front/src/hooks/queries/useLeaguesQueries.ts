import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import leagueApiService from '../../services/leagueApiService';
import secureApiClient from '../../services/secureApiClient';
import { leaguesKeys } from './leaguesKeys';
import type { LeagueSummary } from '../../types';

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
        const res = await leagueApiService.getParticipatedLeaguesPage(page, pageSize);
        if (!res.success || !res.data) throw new Error(res.error || 'Impossible de charger les ligues participées');
        return res.data.leagues;
      }
      if (mappedTab === 'created') {
        const res = await leagueApiService.getCreatedLeaguesPage(page, pageSize);
        if (!res.success || !res.data) throw new Error(res.error || 'Impossible de charger les ligues créées');
        return res.data.leagues;
      }
      const res = await leagueApiService.getAvailableLeaguesPage(page, pageSize);
      if (!res.success || !res.data) throw new Error(res.error || 'Impossible de charger les ligues disponibles');
      return res.data.leagues;
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
      if (!res.success) throw new Error(res.error || 'Impossible de rejoindre la ligue');
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
      const res = await leagueApiService.getLeagueRanking(leagueId);
      if (!res.success || !res.data) throw new Error(res.error || 'Impossible de charger le classement');
      return res.data;
    },
    enabled: (options?.enabled ?? true) && !!leagueId,
    staleTime: 10_000,
  });
}
