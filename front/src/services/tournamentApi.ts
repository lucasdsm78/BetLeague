/**
 * Tournament API Service
 * Secure and optimized API calls for tournament management
 */

import http, { type ApiResponse } from './http';
import type {
  TournamentCreateRequest,
  TournamentCreateResponse,
  TournamentsResponse,
  Tournament,
  TournamentStagesResponse,
  MyTournamentsResponse,
  StageMatchesResponse,
  TournamentsFinishedResponse,
  TournamentMatchOption,
  TournamentStage,
  StageMatch,
  TournamentFinished,
  MyTournament,
} from '../types/api/tournament';

// Re-export des types pour compatibilité (migration progressive)
export type {
  TournamentCreateRequest,
  TournamentCreateResponse,
  TournamentsResponse,
  Tournament,
  TournamentStagesResponse,
  MyTournamentsResponse,
  StageMatchesResponse,
  TournamentsFinishedResponse,
  TournamentMatchOption,
  TournamentStage,
  StageMatch,
  TournamentFinished,
  MyTournament,
};

export const createTournament = async (
  data: TournamentCreateRequest
): Promise<TournamentCreateResponse> => {
  const payload: TournamentCreateRequest = {
    name: String(data.name ?? '').trim(),
    is_private: Boolean(data.is_private),
    max_players: 16,
    ...(typeof data.start_date === 'number' ? { start_date: data.start_date } : {}),
  };

  const response: ApiResponse<TournamentCreateResponse> = await http.post(
    '/tournament/create',
    payload
  );

  if (!response.success) {
    // Mapping UX friendly (statuts utilisés par le backend)
    const status = response.status;
    const detail = response.error || response.message;

    if (status === 402) {
      throw new Error(detail || "Vous devez être abonné à l'option tournoi pour créer un tournoi.");
    }
    if (status === 409) {
      throw new Error(detail || 'Ce nom de tournoi est déjà utilisé.');
    }
    if (status === 400 || status === 422) {
      throw new Error(detail || 'Données invalides.');
    }

    throw new Error(detail || 'Création du tournoi échouée');
  }

  return response.data as TournamentCreateResponse;
};

export const getTournaments = async (
  page: number = 1,
  pageSize: number = 10
): Promise<TournamentsResponse> => {
  const response: ApiResponse<TournamentsResponse> = await http.get(
    `/tournaments?page=${page}&page_size=${pageSize}`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de récupérer les tournois');
  }
  return response.data as TournamentsResponse;
};

export const joinTournament = async (tournamentId: number): Promise<{ message: string }> => {
  const response: ApiResponse<{ message: string }> = await http.post(
    `/tournament/${tournamentId}/join`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de rejoindre le tournoi');
  }
  return response.data as { message: string };
};

export const getTournamentDetails = async (tournamentId: number): Promise<Tournament> => {
  const response: ApiResponse<Tournament> = await http.get(
    `/tournament/${tournamentId}`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de récupérer le tournoi');
  }
  return response.data as Tournament;
};

export const getTournamentStages = async (tournamentId: number): Promise<TournamentStagesResponse> => {
  const response: ApiResponse<TournamentStagesResponse> = await http.get(
    `/tournament/${tournamentId}/stages`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de récupérer les phases du tournoi');
  }
  return response.data as TournamentStagesResponse;
};

export const getMyTournaments = async (
  page: number = 1,
  pageSize: number = 10
): Promise<MyTournamentsResponse> => {
  const response: ApiResponse<MyTournamentsResponse> = await http.get(
    `/tournaments/my?page=${page}&page_size=${pageSize}`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de récupérer vos tournois');
  }
  return response.data as MyTournamentsResponse;
};

export const getStageMatches = async (
  tournamentId: number,
  stageType: string
): Promise<StageMatchesResponse> => {
  const response: ApiResponse<StageMatchesResponse> = await http.get(
    `/tournament/${tournamentId}/stage/${stageType}/matches`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de récupérer les matchs de tournoi');
  }
  return response.data as StageMatchesResponse;
};

export const getFinishedTournaments = async (
  page: number = 1,
  pageSize: number = 10
): Promise<TournamentsFinishedResponse> => {
  const response: ApiResponse<TournamentsFinishedResponse> = await http.get(
    `/tournaments/my/finished?page=${page}&page_size=${pageSize}`
  );
  if (!response.success) {
    throw new Error(response.error || 'Impossible de récupérer les tournois terminés');
  }
  return response.data as TournamentsFinishedResponse;
};

export interface TournamentMatchOptionExport extends TournamentMatchOption {}

export const getUserTournamentMatches = async (): Promise<TournamentMatchOption[]> => {
  // (On laisse ici une implémentation simple; la version performante arrivera via React Query + batching)
  const myTournamentsResponse = await getMyTournaments(1, 100);
  const tournaments = myTournamentsResponse.tournaments;

  if (!tournaments || tournaments.length === 0) {
    return [];
  }

  const allMatches: TournamentMatchOption[] = [];

  for (const tournament of tournaments) {
    const stagesResponse = await getTournamentStages(tournament.id);
    const stages: TournamentStage[] = stagesResponse.stages || [];

    for (const stage of stages) {
      const matchesResponse = await getStageMatches(tournament.id, stage.type);
      const matches: StageMatch[] = matchesResponse.matches || [];

      const matchOptions: TournamentMatchOption[] = matches.map(match => ({
        id: match.id,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        stage_label: getStageLabelFromType(stage.type),
        player1_name: match.player1_summary.pseudo,
        player2_name: match.player2_summary.pseudo,
        start_date: match.start_date,
        end_date: match.end_date,
        display_label: `${tournament.name} - ${getStageLabelFromType(stage.type)} - ${match.player1_summary.pseudo} vs ${match.player2_summary.pseudo}`
      }));

      allMatches.push(...matchOptions);
    }
  }

  return allMatches.sort((a, b) => a.start_date - b.start_date);
};

const getStageLabelFromType = (type: string): string => {
  const labels: Record<string, string> = {
    'final': 'Finale',
    'semi_final': 'Demi-finale',
    'quarter_final': 'Quart de finale',
    'eighth_final': 'Huitième de finale',
    'round_16': '1/16ème',
    'group': 'Groupes',
    'qualifying': 'Qualifications',
  };
  return labels[type] || type;
};

export interface TournamentPlayerBalance {
  tournament_id: number;
  nb_btl: number;
}

/**
 * Get tournament player balance for a specific tournament
 * @param tournamentId Tournament ID
 * @returns Tournament player balance
 * @note This is a temporary implementation. A dedicated backend endpoint may be needed.
 */
export const getTournamentPlayerBalance = async (tournamentId: number): Promise<number> => {
  try {
    // TODO: Replace with actual backend endpoint when available
    // For now, we'll fetch tournament details and check if there's balance info
    // Or this could be extended to call a dedicated /tournament/{id}/player/balance endpoint

    // Temporary: Return a default balance
    // In production, this should call a backend endpoint like:
    // const response = await apiClient.get<TournamentPlayerBalance>(`/tournament/${tournamentId}/player/balance`);
    // return response.data.nb_btl;

    console.warn(`getTournamentPlayerBalance(${tournamentId}): Using temporary implementation. Backend endpoint needed.`);
    return 1000; // Temporary default balance
  } catch (err) {
    console.error('Error fetching tournament player balance:', err);
    throw err;
  }
};
