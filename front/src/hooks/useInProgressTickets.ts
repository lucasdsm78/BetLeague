import { useCallback, useEffect, useRef, useState } from 'react';
import { getInProgressTickets } from '../services/ticketsApi';
import type { TicketReadModel } from '../types/entities/ticket';
import { useTicketsRefreshStore } from '../store/ticketsStore';

export interface UseInProgressTicketsOptions {
  refreshIntervalMs?: number; // auto-refresh interval, disabled if undefined
}

export interface UseInProgressTicketsReturn {
  tickets: TicketReadModel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
}

export function useInProgressTickets(options: UseInProgressTicketsOptions = {}): UseInProgressTicketsReturn {
  const { refreshIntervalMs } = options;
  const [tickets, setTickets] = useState<TicketReadModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);

  const refreshSeq = useTicketsRefreshStore((s) => s.refreshSeq);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Annule la requête précédente
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const res = await getInProgressTickets();
      setTickets(Array.isArray(res.tickets) ? res.tickets : []);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement des tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchTickets();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchTickets, refreshSeq]);

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

  return { tickets, loading, error, refetch, lastUpdated };
}

export default useInProgressTickets;

