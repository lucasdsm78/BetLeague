import { useCallback, useEffect, useRef, useState } from 'react';
import { getTicketDetail } from 'services/ticketsApi';
import type { TicketReadModel } from 'types/ticket';

export interface UseTicketDetailReturn {
  ticket: TicketReadModel | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: number | null;
}

export function useTicketDetail(ticketId: number | string): UseTicketDetailReturn {
  const [ticket, setTicket] = useState<TicketReadModel | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDetail = useCallback(async () => {
    if (ticketId === undefined || ticketId === null || ticketId === '') return;
    try {
      setLoading(true);
      setError(null);
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const data = await getTicketDetail(ticketId);
      setTicket(data);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement du ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const refetch = useCallback(async () => {
    await fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetchDetail();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchDetail]);

  return { ticket, loading, error, refetch, lastUpdated };
}

