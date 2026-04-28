import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFinishedTickets, getInProgressTickets, getTicketDetail } from '../../services/api/tickets';
import type { TicketsFinishedResponse, TicketsInProgressResponse, TicketReadModel } from '../../types/entities/ticket';

export type TicketsServerFilter = {
  leagueId?: number | null;
  isTournament?: boolean | null;
};

export type TicketsListQueryArgs = {
  page?: number;
  pageSize?: number;
  filter?: TicketsServerFilter;
};

export type TicketsQueryOptions = {
  refetchIntervalMs?: number;
  enabled?: boolean;
};

function stableFilter(filter?: TicketsServerFilter) {
  return {
    leagueId: typeof filter?.leagueId === 'number' ? filter!.leagueId : null,
    isTournament: filter?.isTournament === true ? true : null,
  };
}

export const ticketsKeys = {
  all: ['tickets'] as const,
  inProgress: (args?: TicketsListQueryArgs) => [
    ...ticketsKeys.all,
    'in_progress',
    {
      page: args?.page ?? 1,
      pageSize: args?.pageSize ?? 20,
      filter: stableFilter(args?.filter),
    },
  ] as const,
  finished: (args?: TicketsListQueryArgs) => [
    ...ticketsKeys.all,
    'finished',
    {
      page: args?.page ?? 1,
      pageSize: args?.pageSize ?? 20,
      filter: stableFilter(args?.filter),
    },
  ] as const,
  inProgressMeta: () => [...ticketsKeys.all, 'in_progress', 'meta'] as const,
  finishedMeta: () => [...ticketsKeys.all, 'finished', 'meta'] as const,
  detail: (id: number | string) => [...ticketsKeys.all, 'detail', id] as const,
};

/**
 * Query "meta": récupère uniquement le total (page_size=1) pour décider si on bascule en mode serveur.
 */
export function useInProgressTicketsMetaQuery(options?: TicketsQueryOptions) {
  return useQuery<TicketsInProgressResponse, Error>({
    queryKey: ticketsKeys.inProgressMeta(),
    queryFn: async () => getInProgressTickets({ page: 1, pageSize: 1 }),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useFinishedTicketsMetaQuery(options?: TicketsQueryOptions) {
  return useQuery<TicketsFinishedResponse, Error>({
    queryKey: ticketsKeys.finishedMeta(),
    queryFn: async () => getFinishedTickets({ page: 1, pageSize: 1 }),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useInProgressTicketsQuery(args?: TicketsListQueryArgs, options?: TicketsQueryOptions) {
  return useQuery<TicketsInProgressResponse, Error>({
    queryKey: ticketsKeys.inProgress(args),
    queryFn: async () => {
      return getInProgressTickets({
        page: args?.page ?? 1,
        pageSize: args?.pageSize ?? 20,
        leagueId: stableFilter(args?.filter).leagueId,
        isTournament: stableFilter(args?.filter).isTournament,
      });
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useFinishedTicketsQuery(args?: TicketsListQueryArgs, options?: TicketsQueryOptions) {
  return useQuery<TicketsFinishedResponse, Error>({
    queryKey: ticketsKeys.finished(args),
    queryFn: async () => {
      return getFinishedTickets({
        page: args?.page ?? 1,
        pageSize: args?.pageSize ?? 20,
        leagueId: stableFilter(args?.filter).leagueId,
        isTournament: stableFilter(args?.filter).isTournament,
      });
    },
    enabled: options?.enabled ?? true,
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
    invalidateInProgress: () => qc.invalidateQueries({ queryKey: [...ticketsKeys.all, 'in_progress'] }),
    invalidateFinished: () => qc.invalidateQueries({ queryKey: [...ticketsKeys.all, 'finished'] }),
  };
}
