export const matchesKeys = {
  all: ['matches'] as const,
  list: (params: { page: number; pageSize: number }) => [...matchesKeys.all, 'list', params.page, params.pageSize] as const,
};

