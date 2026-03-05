export const leaguesLiteKeys = {
  all: ['leagues'] as const,
  mine: () => [...leaguesLiteKeys.all, 'mine'] as const,
  participated: () => [...leaguesLiteKeys.all, 'participated'] as const,
  balance: (leagueId: number) => [...leaguesLiteKeys.all, 'balance', leagueId] as const,
};
