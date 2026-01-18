import { useQuery } from '@tanstack/react-query';
import { getLeagueBalance, getParticipatedLeagues, type LeagueSummaryApi } from '../../services/api/leagues';
import { leaguesLiteKeys } from './leaguesLiteKeys';

export function useParticipatedLeaguesQuery(options?: { enabled?: boolean }) {
  return useQuery<LeagueSummaryApi[], Error>({
    queryKey: leaguesLiteKeys.participated(),
    queryFn: () => getParticipatedLeagues(),
    enabled: options?.enabled ?? true,
  });
}

export function useLeagueBalanceQuery(leagueId: number | null, options?: { enabled?: boolean }) {
  return useQuery<number, Error>({
    queryKey: leaguesLiteKeys.balance(leagueId ?? -1),
    queryFn: () => {
      if (!leagueId) throw new Error('Ligue invalide');
      return getLeagueBalance(leagueId);
    },
    enabled: (options?.enabled ?? true) && !!leagueId,
  });
}

