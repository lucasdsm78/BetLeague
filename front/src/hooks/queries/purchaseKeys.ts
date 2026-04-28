export const purchaseKeys = {
  all: ['purchases'] as const,
  mine: () => [...purchaseKeys.all, 'mine'] as const,
};

