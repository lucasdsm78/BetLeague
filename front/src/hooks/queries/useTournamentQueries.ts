import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTournament,
  getFinishedTournaments,
  getMyCreatedTournaments,
  getMyTournaments,
  getStageMatches,
  getTournamentStages,
  getTournaments,
  joinTournament,
} from '../../services/api/tournament';
import type {
  CreatedTournamentsResponse,
  MyTournamentsResponse,
  StageMatchesResponse,
  TournamentCreateRequest,
  TournamentCreateResponse,
  TournamentStagesResponse,
  TournamentsFinishedResponse,
  TournamentsResponse,
} from '../../types/api/tournament';
import { tournamentKeys } from './tournamentKeys';

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

export function useTournamentLists() {
  const qc = useQueryClient();
  return {
    invalidateAll: () => qc.invalidateQueries({ queryKey: tournamentKeys.all }),
  };
}
