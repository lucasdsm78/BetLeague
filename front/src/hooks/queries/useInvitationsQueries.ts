import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReceivedInvitations,
  getInvitationCounts,
  getSentLeagueInvitations,
  getSentInvitations,
  type InvitationCounts,
} from '../../services/api/invitations';
import type { InvitationsReceivedResponse, InvitationsSentResponse, LeagueSentInvitationsResponse } from '../../types/entities/invitation';

export type InvitationsServerFilter = {
  status?: InvitationStatusFilter | null;
};

export type InvitationStatusFilter = 'PENDING' | 'ACCEPTED' | 'REFUSED';

export type InvitationsListQueryArgs = {
  page?: number;
  pageSize?: number;
  filter?: InvitationsServerFilter;
};

export type InvitationsQueryOptions = {
  refetchIntervalMs?: number;
  enabled?: boolean;
};

function stableFilter(filter?: InvitationsServerFilter) {
  return {
    status: typeof filter?.status === 'string' ? filter.status : null,
  };
}

export const invitationsKeys = {
  all: ['invitations'] as const,
  received: (args?: InvitationsListQueryArgs) => [
    ...invitationsKeys.all,
    'received',
    {
      page: args?.page ?? 1,
      pageSize: args?.pageSize ?? 20,
      filter: stableFilter(args?.filter),
    },
  ] as const,
  sent: (args?: InvitationsListQueryArgs) => [
    ...invitationsKeys.all,
    'sent',
    {
      page: args?.page ?? 1,
      pageSize: args?.pageSize ?? 20,
      filter: stableFilter(args?.filter),
    },
  ] as const,
  leagueSent: (leagueId: number) => [...invitationsKeys.all, 'league-sent', leagueId] as const,
  counts: (isReceived: boolean = true) => [...invitationsKeys.all, 'counts', isReceived ? 'received' : 'sent'] as const,
};

export function useReceivedInvitationsQuery(
  args?: InvitationsListQueryArgs,
  options?: InvitationsQueryOptions,
) {
  return useQuery<InvitationsReceivedResponse, Error>({
    queryKey: invitationsKeys.received(args),
    queryFn: async () => {
      return getReceivedInvitations({
        page: args?.page ?? 1,
        pageSize: args?.pageSize ?? 20,
        status: stableFilter(args?.filter).status,
      });
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useInvitationCountsQuery(options?: InvitationsQueryOptions) {
  return useQuery<InvitationCounts, Error>({
    queryKey: invitationsKeys.counts(true),
    queryFn: () => getInvitationCounts({ isReceived: true }),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useSentInvitationCountsQuery(options?: InvitationsQueryOptions) {
  return useQuery<InvitationCounts, Error>({
    queryKey: invitationsKeys.counts(false),
    queryFn: () => getInvitationCounts({ isReceived: false }),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useSentInvitationsQuery(
  args?: InvitationsListQueryArgs,
  options?: InvitationsQueryOptions,
) {
  return useQuery<InvitationsSentResponse, Error>({
    queryKey: invitationsKeys.sent(args),
    queryFn: async () => {
      return getSentInvitations({
        page: args?.page ?? 1,
        pageSize: args?.pageSize ?? 20,
        status: stableFilter(args?.filter).status,
      });
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useLeagueSentInvitationsQuery(
  leagueId: number | null,
  options?: InvitationsQueryOptions,
) {
  return useQuery<LeagueSentInvitationsResponse, Error>({
    queryKey: invitationsKeys.leagueSent(leagueId ?? -1),
    queryFn: () => {
      if (leagueId === null) throw new Error('Ligue invalide');
      return getSentLeagueInvitations(leagueId);
    },
    enabled: (options?.enabled ?? true) && leagueId !== null,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useInvalidateInvitations() {
  const qc = useQueryClient();
  return {
    invalidateAll: () => qc.invalidateQueries({ queryKey: invitationsKeys.all }),
    invalidateReceived: () => qc.invalidateQueries({ queryKey: [...invitationsKeys.all, 'received'] }),
    invalidateSent: () => qc.invalidateQueries({ queryKey: [...invitationsKeys.all, 'sent'] }),
    invalidateLeagueSent: (leagueId: number) => qc.invalidateQueries({ queryKey: invitationsKeys.leagueSent(leagueId) }),
    invalidateCounts: () => qc.invalidateQueries({ queryKey: [...invitationsKeys.all, 'counts'] }),
  };
}
