import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFinishedTickets, getInProgressTickets, getTicketDetail } from '../../services/api/tickets';
import type { TicketsFinishedResponse, TicketsInProgressResponse, TicketReadModel } from '../../types/entities/ticket';

export const ticketsKeys = {
  all: ['tickets'] as const,
  inProgress: () => [...ticketsKeys.all, 'in_progress'] as const,
  finished: () => [...ticketsKeys.all, 'finished'] as const,
  detail: (id: number | string) => [...ticketsKeys.all, 'detail', id] as const,
};

export function useInProgressTicketsQuery(options?: { refetchIntervalMs?: number }) {
  return useQuery<TicketReadModel[], Error>({
    queryKey: ticketsKeys.inProgress(),
    queryFn: async () => {
      const res: TicketsInProgressResponse = await getInProgressTickets();
      return Array.isArray(res.tickets) ? res.tickets : [];
    },
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useFinishedTicketsQuery(options?: { refetchIntervalMs?: number }) {
  return useQuery<TicketReadModel[], Error>({
    queryKey: ticketsKeys.finished(),
    queryFn: async () => {
      const res: TicketsFinishedResponse = await getFinishedTickets();
      return Array.isArray(res.tickets) ? res.tickets : [];
    },
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useTicketDetailQuery(ticketId: number | string | null | undefined) {
  return useQuery<TicketReadModel, Error>({
    queryKey: ticketsKeys.detail(ticketId ?? 'none'),
    enabled: ticketId !== null && ticketId !== undefined && `${ticketId}`.length > 0,
    queryFn: async () => {
      if (ticketId === null || ticketId === undefined) {
        throw new Error('Ticket invalide');
      }
      return getTicketDetail(ticketId);
    },
  });
}

export function useInvalidateTickets() {
  const qc = useQueryClient();
  return {
    invalidateAll: () => qc.invalidateQueries({ queryKey: ticketsKeys.all }),
    invalidateInProgress: () => qc.invalidateQueries({ queryKey: ticketsKeys.inProgress() }),
    invalidateFinished: () => qc.invalidateQueries({ queryKey: ticketsKeys.finished() }),
  };
}
