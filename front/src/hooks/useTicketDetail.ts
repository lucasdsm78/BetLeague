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
  const mountedRef = useRef<boolean>(false);

  const fetchDetail = useCallback(async () => {
    if (ticketId === undefined || ticketId === null || ticketId === '') return;
    const isMounted = () => mountedRef.current;
    try {
      setLoading(true);
      setError(null);
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const data = await getTicketDetail(ticketId, { signal: abortRef.current.signal });
      if (!isMounted()) return;
      setTicket(data);
      setLastUpdated(Date.now());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (!isMounted()) return;
      setError(e?.message || 'Erreur lors du chargement du ticket');
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [ticketId]);

  const refetch = useCallback(async () => {
    await fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    mountedRef.current = true;
    fetchDetail();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchDetail]);

  return { ticket, loading, error, refetch, lastUpdated };
}
