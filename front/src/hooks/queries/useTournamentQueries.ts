import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelSubscription, getCurrentTournamentSubscription, getSubscriptionPlans } from '../../services/api/subscription';
import {
  createTournament,
  deleteTournamentInvitation,
  getTournamentInvitations,
  getFinishedTournaments,
  getMyCreatedTournaments,
  getMyTournaments,
  getStageMatches,
  getTournamentCreationAccess,
  getTournamentStages,
  getTournaments,
  inviteUserToTournament,
  joinTournament,
  leaveTournament,
} from '../../services/api/tournament';
import { secureApiClient } from '../../services/secureApiClient';
import type {
  ApiCancelSubscriptionResponse,
  ApiCurrentTournamentSubscription,
  ApiSubscriptionPlansResponse,
} from '../../types/api/subscription';
import type {
  CreatedTournamentsResponse,
  MyTournamentsResponse,
  StageMatchesResponse,
  TournamentInvitation,
  TournamentInvitationsResponse,
  TournamentCreateRequest,
  TournamentCreateResponse,
  TournamentStagesResponse,
  TournamentsFinishedResponse,
  TournamentsResponse,
  TournamentCreationAccess,
} from '../../types/api/tournament';
import { profileKeys } from './profileKeys';
import { tournamentKeys } from './tournamentKeys';

export function useTournamentCreationAccessQuery(options?: { enabled?: boolean }) {
  return useQuery<TournamentCreationAccess, Error>({
    queryKey: tournamentKeys.creationAccess,
    queryFn: () => getTournamentCreationAccess(),
    enabled: options?.enabled ?? true,
  });
}

export function useAvailableTournamentsQuery(page: number, pageSize: number, options?: { enabled?: boolean }) {
  return useQuery<TournamentsResponse, Error>({
    queryKey: tournamentKeys.available(page, pageSize),
    queryFn: () => getTournaments(page, pageSize),
    enabled: options?.enabled ?? true,
  });
}

export function useMyTournamentsQuery(page: number, pageSize: number, options?: { enabled?: boolean }) {
  return useQuery<MyTournamentsResponse, Error>({
    queryKey: tournamentKeys.my(page, pageSize),
    queryFn: () => getMyTournaments(page, pageSize),
    enabled: options?.enabled ?? true,
  });
}

export function useMyCreatedTournamentsQuery(page: number, pageSize: number, options?: { enabled?: boolean }) {
  return useQuery<CreatedTournamentsResponse, Error>({
    queryKey: tournamentKeys.myCreated(page, pageSize),
    queryFn: () => getMyCreatedTournaments(page, pageSize),
    enabled: options?.enabled ?? true,
  });
}

export function useFinishedTournamentsQuery(page: number, pageSize: number, options?: { enabled?: boolean }) {
  return useQuery<TournamentsFinishedResponse, Error>({
    queryKey: tournamentKeys.finished(page, pageSize),
    queryFn: () => getFinishedTournaments(page, pageSize),
    enabled: options?.enabled ?? true,
  });
}

export function useTournamentStagesQuery(tournamentId: number | null, options?: { enabled?: boolean }) {
  return useQuery<TournamentStagesResponse, Error>({
    queryKey: tournamentKeys.stages(tournamentId ?? -1),
    queryFn: () => {
      if (tournamentId === null) throw new Error('Tournament invalide');
      return getTournamentStages(tournamentId);
    },
    enabled: (options?.enabled ?? true) && tournamentId !== null,
  });
}

export function useTournamentInvitationsQuery(tournamentId: number | null, options?: { enabled?: boolean }) {
  return useQuery<TournamentInvitationsResponse, Error>({
    queryKey: tournamentKeys.invitations(tournamentId ?? -1),
    queryFn: () => {
      if (tournamentId === null) throw new Error('Tournament invalide');
      return getTournamentInvitations(tournamentId);
    },
    enabled: (options?.enabled ?? true) && tournamentId !== null,
  });
}

export function useInviteUserToTournamentMutation(tournamentId: number | null) {
  const qc = useQueryClient();

  return useMutation<{ message: string }, Error, { userId: number }>({
    mutationFn: ({ userId }) => {
      if (tournamentId === null) throw new Error('Tournament invalide');
      return inviteUserToTournament(tournamentId, userId);
    },
    onSuccess: () => {
      if (tournamentId !== null) {
        qc.invalidateQueries({ queryKey: tournamentKeys.invitations(tournamentId) });
      }
    },
  });
}

export function useDeleteTournamentInvitationMutation(tournamentId: number | null) {
  const qc = useQueryClient();

  type Context = {
    previousInvitations?: TournamentInvitationsResponse;
  };

  return useMutation<{ message: string }, Error, { invitationId: number }, Context>({
    mutationFn: ({ invitationId }) => deleteTournamentInvitation(invitationId),
    onMutate: async ({ invitationId }) => {
      if (tournamentId === null) return {};

      await qc.cancelQueries({ queryKey: tournamentKeys.invitations(tournamentId) });
      const previousInvitations = qc.getQueryData<TournamentInvitationsResponse>(tournamentKeys.invitations(tournamentId));

      qc.setQueryData<TournamentInvitationsResponse>(
        tournamentKeys.invitations(tournamentId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            invitations: old.invitations.filter((invitation: TournamentInvitation) => invitation.id !== invitationId),
          };
        },
      );

      return { previousInvitations };
    },
    onError: (_error, _variables, context) => {
      if (tournamentId !== null && context?.previousInvitations) {
        qc.setQueryData(tournamentKeys.invitations(tournamentId), context.previousInvitations);
      }
    },
    onSettled: () => {
      if (tournamentId !== null) {
        qc.invalidateQueries({ queryKey: tournamentKeys.invitations(tournamentId) });
      }
    },
  });
}

export function useStageMatchesQuery(tournamentId: number, stageType: string, options?: { enabled?: boolean }) {
  return useQuery<StageMatchesResponse, Error>({
    queryKey: tournamentKeys.stageMatches(tournamentId, stageType),
    queryFn: () => getStageMatches(tournamentId, stageType),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateTournamentMutation() {
  const qc = useQueryClient();
  return useMutation<TournamentCreateResponse, Error, TournamentCreateRequest>({
    mutationFn: (payload) => createTournament(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.availableList });
      qc.invalidateQueries({ queryKey: tournamentKeys.myList });
      qc.invalidateQueries({ queryKey: tournamentKeys.myCreatedList });
      qc.invalidateQueries({ queryKey: tournamentKeys.finishedList });
      qc.invalidateQueries({ queryKey: tournamentKeys.creationAccess });
    },
  });
}

export function useJoinTournamentMutation() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, { tournamentId: number }>({
    mutationFn: ({ tournamentId }) => joinTournament(tournamentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.availableList });
      qc.invalidateQueries({ queryKey: tournamentKeys.myList });
    },
  });
}

export function useLeaveTournamentMutation() {
  const qc = useQueryClient();

  type Context = {
    previousData: [readonly unknown[], MyTournamentsResponse | undefined][];
  };

  return useMutation<{ message: string }, Error, { tournamentId: number }, Context>({
    mutationFn: ({ tournamentId }) => leaveTournament(tournamentId),
    onMutate: async ({ tournamentId }) => {
      await qc.cancelQueries({ queryKey: tournamentKeys.myList });

      const previousData = qc.getQueriesData<MyTournamentsResponse>({
        queryKey: tournamentKeys.myList,
      });

      qc.setQueriesData<MyTournamentsResponse>(
        { queryKey: tournamentKeys.myList },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tournaments: old.tournaments.filter((t) => t.id !== tournamentId),
            total_count: Math.max(0, old.total_count - 1),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          if (data) qc.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      secureApiClient.clearCache();
      qc.invalidateQueries({ queryKey: tournamentKeys.myList });
      qc.invalidateQueries({ queryKey: tournamentKeys.availableList });
    },
  });
}

export function useTournamentSubscriptionPlansQuery(options?: { enabled?: boolean }) {
  return useQuery<ApiSubscriptionPlansResponse, Error>({
    queryKey: tournamentKeys.subscriptionPlans,
    queryFn: () => getSubscriptionPlans(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCurrentTournamentSubscriptionQuery(options?: { enabled?: boolean }) {
  return useQuery<ApiCurrentTournamentSubscription, Error>({
    queryKey: tournamentKeys.subscriptionCurrent,
    queryFn: () => getCurrentTournamentSubscription(),
    enabled: options?.enabled ?? true,
  });
}

export function useCancelTournamentSubscriptionMutation() {
  const qc = useQueryClient();

  return useMutation<ApiCancelSubscriptionResponse, Error>({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      secureApiClient.clearCache();
      qc.invalidateQueries({ queryKey: profileKeys.me() });
      qc.invalidateQueries({ queryKey: tournamentKeys.creationAccess });
      qc.invalidateQueries({ queryKey: tournamentKeys.subscriptionCurrent });
    },
  });
}

export function useTournamentLists() {
  const qc = useQueryClient();
  return {
    invalidateAll: () => qc.invalidateQueries({ queryKey: tournamentKeys.all }),
    invalidateInvitations: (tournamentId: number) => qc.invalidateQueries({ queryKey: tournamentKeys.invitations(tournamentId) }),
  };
}
