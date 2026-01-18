export const matchesKeys = {
  all: ['matches'] as const,
  page: (page: number, pageSize: number) => [...matchesKeys.all, 'page', page, pageSize] as const,
};

