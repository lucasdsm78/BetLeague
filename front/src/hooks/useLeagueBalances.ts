/**
 * useLeagueBalances
 * Hook pour récupérer les soldes BTL (par ligue) de l’utilisateur connecté.
 *
 * Objectifs:
 * - Perf: cache en mémoire + batching + limite de concurrence
 * - UX: état loading global + soldes disponibles au fil de l’eau
 * - Robustesse: annulation via AbortController + pas de setState après unmount
 * - Sécurité: aucune info sensible dans l’URL; on s’appuie sur le backend + auth JWT
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import leagueApiService from '../services/leagueApiService';

export type LeagueBalances = Record<number, number>;

interface UseLeagueBalancesOptions {
  /** auto-fetch au montage / changement des IDs */
  autoFetch?: boolean;
  /** nombre max de requêtes concurrentes */
  concurrency?: number;
  /** soldes par défaut quand l’API échoue */
  defaultBalance?: number;
}

export interface UseLeagueBalancesReturn {
  balances: LeagueBalances;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getBalance: (leagueId: number) => number | undefined;
  isBalanceLoading: (leagueId: number) => boolean;
}

// Cache process-wide (onglet) - évite de re-fetch quand on navigue.
const balanceCache = new Map<number, number>();

export function clearLeagueBalancesCache(): void {
  balanceCache.clear();
}

function sanitizeLeagueIds(raw: number[]): number[] {
  const ids = raw
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => Number(id));
  return Array.from(new Set(ids));
}

/**
 * Hook
 */
export function useLeagueBalances(
  leagueIds: number[],
  options: UseLeagueBalancesOptions = {}
): UseLeagueBalancesReturn {
  const {
    autoFetch = true,
    concurrency = 6,
    defaultBalance = 0,
  } = options;

  const ids = useMemo(() => sanitizeLeagueIds(leagueIds), [leagueIds]);

  const [balances, setBalances] = useState<LeagueBalances>(() => {
    const initial: LeagueBalances = {};
    for (const id of ids) {
      if (balanceCache.has(id)) initial[id] = balanceCache.get(id) as number;
    }
    return initial;
  });

  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const isBalanceLoading = useCallback(
    (leagueId: number) => loadingIds.has(leagueId) && balances[leagueId] === undefined,
    [loadingIds, balances]
  );

  const getBalance = useCallback(
    (leagueId: number) => balances[leagueId],
    [balances]
  );

  const fetchOne = useCallback(async (leagueId: number): Promise<number> => {
    // cache hit
    if (balanceCache.has(leagueId)) return balanceCache.get(leagueId) as number;

    const res = await leagueApiService.getLeagueBalance(leagueId);
    if (!res.success) {
      return defaultBalance;
    }
    const nb = Number(res.data?.nb_btl);
    return Number.isFinite(nb) ? nb : defaultBalance;
  }, [defaultBalance]);

  const refetch = useCallback(async () => {
    if (ids.length === 0) {
      if (!mountedRef.current) return;
      setBalances({});
      setLoadingIds(new Set());
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    // On ne fetch que les IDs manquants du cache/state.
    const missing = ids.filter((id) => !balanceCache.has(id));
    // Marquer en loading uniquement ceux-là.
    setLoadingIds(new Set(missing));

    try {
      // Limitation de concurrence simple.
      const queue = [...missing];
      const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) });

      await Promise.all(
        workers.map(async () => {
          while (queue.length > 0) {
            if (abortRef.current?.signal.aborted) return;
            const leagueId = queue.shift();
            if (!leagueId) return;

            try {
              const nb = await fetchOne(leagueId);
              balanceCache.set(leagueId, nb);
              if (!mountedRef.current) return;

              setBalances((prev) => ({ ...prev, [leagueId]: nb }));
            } catch {
              balanceCache.set(leagueId, defaultBalance);
              if (!mountedRef.current) return;
              setBalances((prev) => ({ ...prev, [leagueId]: defaultBalance }));
            } finally {
              if (mountedRef.current) {
                setLoadingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(leagueId);
                  return next;
                });
              }
            }
          }
        })
      );
    } catch (e: any) {
      if (!mountedRef.current) return;
      if (String(e?.name) === 'AbortError') return;
      setError(e?.message || 'Erreur lors du chargement des soldes');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [ids, concurrency, defaultBalance, fetchOne]);

  useEffect(() => {
    // À chaque changement d’IDs, on hydrate depuis le cache.
    setBalances((prev) => {
      const next: LeagueBalances = { ...prev };
      for (const id of ids) {
        if (balanceCache.has(id)) next[id] = balanceCache.get(id) as number;
      }
      // Option: on enlève les ids qui ne sont plus nécessaires
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!ids.includes(id)) delete next[id];
      }
      return next;
    });

    if (autoFetch) {
      // best-effort
      refetch().catch(() => {});
    }
  }, [ids, autoFetch, refetch]);

  return {
    balances,
    isLoading,
    error,
    refetch,
    getBalance,
    isBalanceLoading,
  };
}
