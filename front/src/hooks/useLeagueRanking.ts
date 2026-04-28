/**
 * Hook personnalisé pour la gestion du classement des ligues
 * Optimisé pour React, TypeScript et mobile avec sécurité renforcée
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLeagueRanking } from '../services/api/leagues';
import type { RankingEntry, RankingData } from '../types/ranking';

interface UseLeagueRankingReturn {
  ranking: RankingData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getPlayerStats: (pseudo: string) => {
    winRate: number;
    totalBets: number;
    position: number;
  } | null;
}

export const useLeagueRanking = (leagueId: number | null): UseLeagueRankingReturn => {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Empêche les appels concurrents
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Abort controller pour annuler en cas de changement rapide
  const abortRef = useRef<AbortController | null>(null);

  const fetchRanking = useCallback(async () => {
    if (!leagueId || leagueId <= 0) {
      setError('ID de ligue invalide');
      return;
    }

    // Empêche plusieurs fetch simultanés
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    setIsLoading(true);
    setError(null);

    // Annule une requête précédente si encore active
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const task = (async () => {
      try {
        const data = await getLeagueRanking(leagueId);

        if (!Array.isArray(data)) {
          throw new Error('Format de données invalide');
        }

        // Validation et sécurisation des données
        const validatedEntries: RankingEntry[] = data.map((entry: any, index: number) => ({
          position: typeof entry.position === 'number' ? entry.position : index + 1,
          pseudo: String(entry.pseudo || 'Joueur anonyme').slice(0, 50),
          nb_btl: Math.max(0, Number(entry.nb_btl) || 0),
          nb_win: Math.max(0, Number(entry.nb_win) || 0),
          nb_lose: Math.max(0, Number(entry.nb_lose) || 0),
        }));

        validatedEntries.sort((a, b) => a.position - b.position);

        const rankingData: RankingData = {
          entries: validatedEntries,
          totalPlayers: validatedEntries.length,
          leagueId,
          lastUpdated: new Date().toISOString(),
        };

        setRanking(rankingData);
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // ignoré
        const errorMessage = err.message || 'Erreur inconnue lors du chargement du classement';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = task;
    return task;
  }, [leagueId]);

  // Fonction pour obtenir les statistiques d'un joueur spécifique
  const getPlayerStats = useCallback((pseudo: string) => {
    if (!ranking || !pseudo) return null;

    const player = ranking.entries.find(entry => entry.pseudo === pseudo);
    if (!player) return null;

    const totalBets = player.nb_win + player.nb_lose;
    const winRate = totalBets > 0 ? (player.nb_win / totalBets) * 100 : 0;

    return {
      winRate: Math.round(winRate * 100) / 100, // 2 décimales
      totalBets,
      position: player.position,
    };
  }, [ranking]);

  // Fonction de rafraîchissement
  const refresh = useCallback(async () => {
    await fetchRanking();
  }, [fetchRanking]);

  // Chargement automatique au changement de leagueId
  useEffect(() => {
    let mounted = true;
    if (leagueId && leagueId > 0) {
      fetchRanking();
    } else {
      if (!mounted) return;
      setRanking(null);
      setError(null);
    }
    return () => {
      mounted = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [leagueId, fetchRanking]);

  return useMemo(() => ({
    ranking,
    isLoading,
    error,
    refresh,
    getPlayerStats,
  }), [ranking, isLoading, error, refresh, getPlayerStats]);
};

export default useLeagueRanking;
