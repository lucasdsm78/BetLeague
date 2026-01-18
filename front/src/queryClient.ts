import { QueryClient } from '@tanstack/react-query';

// Un QueryClient unique pour toute l'app.
// Defaults pensés mobile/perf: cache court, retry modéré.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000, // 15s: l'UI reste fluide, les refresh restent fréquents
      gcTime: 5 * 60_000, // 5 min
      retry: 2,
      refetchOnWindowFocus: false, // mobile friendly + évite spam
    },
    mutations: {
      retry: 0,
    },
  },
});

