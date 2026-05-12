export const leaguesKeys = {
  all: ['leagues'] as const,
  list: (tab: 'participated' | 'created' | 'available', page: number, pageSize: number) =>
    [...leaguesKeys.all, 'list', tab, page, pageSize] as const,
  count: (tab: 'participated' | 'created' | 'available') =>
    [...leaguesKeys.all, 'count', tab] as const,
  ranking: (leagueId: number) => [...leaguesKeys.all, 'ranking', leagueId] as const,
};

