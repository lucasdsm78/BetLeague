import { useQuery } from '@tanstack/react-query';
import { getTournamentPlayerBalance, getUserTournamentMatches, type TournamentMatchOption } from '../../services/api/tournament';
import { tournamentBettingKeys } from './tournamentBettingKeys';

export function useUserTournamentMatchesQuery(options?: { enabled?: boolean }) {
  return useQuery<TournamentMatchOption[], Error>({
    queryKey: tournamentBettingKeys.matchOptions(),
    queryFn: () => getUserTournamentMatches(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTournamentPlayerBalanceQuery(tournamentId: number | null, options?: { enabled?: boolean }) {
  return useQuery<number, Error>({
    queryKey: tournamentBettingKeys.playerBalance(tournamentId ?? -1),
    queryFn: () => {
      if (!tournamentId) throw new Error('Tournoi invalide');
      return getTournamentPlayerBalance(tournamentId);
    },
    enabled: (options?.enabled ?? true) && !!tournamentId,
    staleTime: 10_000,
  });
}

