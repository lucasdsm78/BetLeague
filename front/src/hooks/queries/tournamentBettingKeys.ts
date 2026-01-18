export const tournamentBettingKeys = {
  all: ['tournament_betting'] as const,
  matchOptions: () => [...tournamentBettingKeys.all, 'match_options'] as const,
  playerBalance: (tournamentId: number) => [...tournamentBettingKeys.all, 'player_balance', tournamentId] as const,
};

