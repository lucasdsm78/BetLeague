export const matchesKeys = {
  all: ['matches'] as const,
  list: (params: { page: number; pageSize: number; leagueId?: number }) => [...matchesKeys.all, 'list', params.page, params.pageSize, params.leagueId ?? 'all'] as const,
};

