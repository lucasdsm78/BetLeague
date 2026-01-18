import { useCallback, useEffect, useRef, useState } from 'react';
import { getFinishedTickets } from 'services/api/tickets';
import type { TicketReadModel } from 'types/entities/ticket';

export interface UseFinishedTicketsOptions {
  refreshIntervalMs?: number; // auto-refresh interval, disabled if undefined
}

export interface UseFinishedTicketsReturn {
  tickets: TicketReadModel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
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

      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const res = await getFinishedTickets();
      setTickets(Array.isArray(res.tickets) ? res.tickets : []);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement des tickets terminés');
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
  }, [fetchTickets]);

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
