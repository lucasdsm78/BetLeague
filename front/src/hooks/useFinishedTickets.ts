import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFinishedTickets } from '../services/ticketsApi';
import type { TicketReadModel } from '../types/ticket';

export interface UseFinishedTicketsOptions {
  refreshIntervalMs?: number; // auto-refresh interval, disabled if undefined
}

export interface UseFinishedTicketsReturn {
  tickets: TicketReadModel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
  // Statistiques dérivées
  wonTickets: TicketReadModel[];
  lostTickets: TicketReadModel[];
  totalStake: number;
  totalWinnings: number;
  netProfit: number;
  winRate: number;
}

export function useFinishedTickets(options: UseFinishedTicketsOptions = {}): UseFinishedTicketsReturn {
  const { refreshIntervalMs } = options;
  const [tickets, setTickets] = useState<TicketReadModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Annule la requête précédente
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const res = await getFinishedTickets();
      setTickets(Array.isArray(res.tickets) ? res.tickets : []);
      setLastUpdated(Date.now());
    } catch (e: any) {
      // Ne pas traiter les erreurs d'annulation
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Erreur lors du chargement des tickets terminés');
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchTickets();
  }, [fetchTickets]);

  // Calcul des statistiques avec useMemo pour optimisation
  const stats = useMemo(() => {
    const wonTickets = tickets.filter(t => t.status === 'correct');
    const lostTickets = tickets.filter(t => t.status === 'wrong');
    const totalStake = tickets.reduce((sum, t) => sum + (t.mise || 0), 0);
    const totalWinnings = wonTickets.reduce((sum, t) => sum + (t.gain || 0), 0);
    const netProfit = totalWinnings - totalStake;
    const winRate = tickets.length > 0 ? (wonTickets.length / tickets.length) * 100 : 0;

    return {
      wonTickets,
      lostTickets,
      totalStake,
      totalWinnings,
      netProfit,
      winRate,
    };
  }, [tickets]);

  // Chargement initial
  useEffect(() => {
    fetchTickets();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchTickets]);

  // Auto-refresh optionnel
  useEffect(() => {
    if (!refreshIntervalMs) return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      fetchTickets();
    }, refreshIntervalMs);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [refreshIntervalMs, fetchTickets]);

  return {
    tickets,
    loading,
    error,
    refetch,
    lastUpdated,
    ...stats,
  };
}

export default useFinishedTickets;
