import { useEffect, useMemo, useRef, useState } from 'react';
import { getMatchOddsByMatchIds } from 'services/api/matches';
import type { ApiMatchOddReadModel } from 'types/api/matches';

// Cache process-local (réutilisé entre écrans)
const ODDS_CACHE: Record<number, ApiMatchOddReadModel[]> = {};

/**
 * Hook utilitaire pour récupérer les odds d'un ensemble de matchs.
 *
 * Implémentation: appelle l'endpoint back /api/match-odds?match_ids=... (1 requête par chunk) et garde
 * un cache in-memory pour éviter les re-fetch lors de la navigation.
 */
export function useMatchOddsByMatchIds(matchIds: number[]) {
  const [oddsByMatchId, setOddsByMatchId] = useState<Record<number, ApiMatchOddReadModel[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>('');

  const uniqIds = useMemo(() => Array.from(new Set(matchIds.filter((x) => Number.isFinite(x)))), [matchIds]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (uniqIds.length === 0) {
        setOddsByMatchId({});
        return;
      }

      // Si on a déjà tout en cache, pas de fetch.
      const cachedMap: Record<number, ApiMatchOddReadModel[]> = {};
      let missing = 0;
      for (const id of uniqIds) {
        if (ODDS_CACHE[id]) cachedMap[id] = ODDS_CACHE[id];
        else missing += 1;
      }
      const key = `${uniqIds.sort((a, b) => a - b).join(',')}|missing:${missing}`;
      if (key === lastKeyRef.current && missing === 0) {
        setOddsByMatchId(cachedMap);
        return;
      }
      lastKeyRef.current = key;
      if (missing === 0) {
        setOddsByMatchId(cachedMap);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const map: Record<number, ApiMatchOddReadModel[]> = { ...cachedMap };
        const missingIds = uniqIds.filter((id) => !map[id]);

        // chunk pour limiter taille URL (et éviter 414)
        const chunkSize = 200;
        for (let i = 0; i < missingIds.length; i += chunkSize) {
          const chunk = missingIds.slice(i, i + chunkSize);
          const oddsByMid = await getMatchOddsByMatchIds(chunk);
          if (cancelled) return;
          for (const [k, v] of Object.entries(oddsByMid)) {
            const mid = Number(k);
            if (!Number.isFinite(mid)) continue;
            map[mid] = Array.isArray(v) ? v : [];
            ODDS_CACHE[mid] = map[mid];
          }
        }

        setOddsByMatchId(map);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Impossible de charger les cotes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uniqIds]);

  return { oddsByMatchId, loading, error };
}
