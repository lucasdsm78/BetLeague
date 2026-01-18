export const leaguesLiteKeys = {
  all: ['leagues'] as const,
  participated: () => [...leaguesLiteKeys.all, 'participated'] as const,
  balance: (leagueId: number) => [...leaguesLiteKeys.all, 'balance', leagueId] as const,
};

