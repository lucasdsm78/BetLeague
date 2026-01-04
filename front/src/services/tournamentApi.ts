/**
 * Tournament API Service
 * Secure and optimized API calls for tournament management
 */

import apiClient from './apiClient';

export interface TournamentCreateRequest {
  name: string;
  is_private: boolean;
  max_players: number;
}

export interface TournamentCreateResponse {
  message: string;
  tournament_id?: number;
  tournament_uuid?: string;
  name?: string;
}

export interface Tournament {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  max_players: number;
  current_players: number;
  start_date: number;
  end_date: number;
}

export interface TournamentsResponse {
  tournaments: Tournament[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
}

export interface TournamentStage {
  id: number;
  tournament_id: number;
  type: string;
  user_summary: UserSummary;
  is_active: boolean;
  is_completed: boolean;
  created_at?: number;
  start_date?: number;
  end_date?: number;
}

export interface TournamentStagesResponse {
  stages: TournamentStage[];
}

export interface MyTournament {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  max_players: number;
}

export interface MyTournamentsResponse {
  tournaments: MyTournament[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface PlayerSummary {
  id: number;
  email: string;
  pseudo: string;
}

export interface StageMatch {
  id: number;
  tournament_id: number;
  stage: string;
  player1_summary: PlayerSummary;
  player2_summary: PlayerSummary;
  start_date: number; // timestamp in milliseconds
  end_date: number; // timestamp in milliseconds
  winner_id: number | null;
  loser_id: number | null;
}

export interface StageMatchesResponse {
  matches: StageMatch[];
}

export interface TournamentFinished {
  id: number;
  uuid: string;
  name: string;
  is_private: boolean;
  start_date: number; // timestamp in milliseconds
  end_date: number; // timestamp in milliseconds
}

export interface TournamentsFinishedResponse {
  tournaments: TournamentFinished[];
  total_count: number;
  page: number;
  page_size: number;
}

/**
 * Create a new tournament
 * @param data Tournament creation data
 * @returns Tournament creation response
 */
export const createTournament = async (
  data: TournamentCreateRequest
): Promise<TournamentCreateResponse> => {
  const payload: TournamentCreateRequest = {
    name: String(data.name ?? '').trim(),
    is_private: Boolean(data.is_private),
    max_players: 16,
  };

  try {
    const response = await apiClient.post<TournamentCreateResponse>(
      '/tournament/create',
      payload
    );
    return response.data as TournamentCreateResponse;
  } catch (err: any) {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    if (status === 402) {
      throw new Error(detail || "Vous devez être abonné à l'option tournoi pour créer un tournoi.");
    }
    if (status === 409) {
      throw new Error(detail || 'Ce nom de tournoi est déjà utilisé.');
    }
    if (status === 400 || status === 422) {
      throw new Error(detail || 'Données invalides.');
    }
    throw err;
  }
};

/**
 * Get available public tournaments with pagination
 * @param page Page number (starts at 1)
 * @param pageSize Number of items per page
 * @returns Tournaments response with pagination
 */
export const getTournaments = async (
  page: number = 1,
  pageSize: number = 10
): Promise<TournamentsResponse> => {
  const response = await apiClient.get<TournamentsResponse>(
    `/tournaments?page=${page}&page_size=${pageSize}`
  );
  return response.data as TournamentsResponse;
};

/**
 * Join a tournament
 * @param tournamentId Tournament ID
 * @returns Join response
 */
export const joinTournament = async (tournamentId: number): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(
    `/tournament/${tournamentId}/join`
  );
  return response.data as { message: string };
};

/**
 * Get tournament details
 * @param tournamentId Tournament ID
 * @returns Tournament details
 */
export const getTournamentDetails = async (tournamentId: number): Promise<Tournament> => {
  const response = await apiClient.get<Tournament>(
    `/tournament/${tournamentId}`
  );
  return response.data as Tournament;
};

/**
 * Get tournament stages
 * @param tournamentId Tournament ID
 * @returns Tournament stages with bracket information
 */
export const getTournamentStages = async (tournamentId: number): Promise<TournamentStagesResponse> => {
  const response = await apiClient.get<TournamentStagesResponse>(
    `/tournament/${tournamentId}/stages`
  );
  return response.data as TournamentStagesResponse;
};

/**
 * Get my tournaments (tournaments user is registered in)
 * @param page Page number (starts at 1)
 * @param pageSize Number of items per page
 * @returns My tournaments response with pagination
 */
export const getMyTournaments = async (
  page: number = 1,
  pageSize: number = 10
): Promise<MyTournamentsResponse> => {
  const response = await apiClient.get<MyTournamentsResponse>(
    `/tournaments/my?page=${page}&page_size=${pageSize}`
  );
  return response.data as MyTournamentsResponse;
};

/**
 * Get matches for a specific tournament stage
 * @param tournamentId Tournament ID
 * @param stageType Stage type (e.g., 'eighth_final', 'quarter_final', 'semi_final', 'final')
 * @returns Stage matches response
 */
export const getStageMatches = async (
  tournamentId: number,
  stageType: string
): Promise<StageMatchesResponse> => {
  const response = await apiClient.get<StageMatchesResponse>(
    `/tournament/${tournamentId}/stage/${stageType}/matches`
  );
  return response.data as StageMatchesResponse;
};

/**
 * Get finished tournaments for the current user
 * @param page - Page number (starts at 1)
 * @param pageSize - Number of tournaments per page (1-100)
 * @returns Finished tournaments response with pagination
 */
export const getFinishedTournaments = async (
  page: number = 1,
  pageSize: number = 10
): Promise<TournamentsFinishedResponse> => {
  const response = await apiClient.get<TournamentsFinishedResponse>(
    `/tournaments/my/finished?page=${page}&page_size=${pageSize}`
  );
  return response.data as TournamentsFinishedResponse;
};

/**
 * Tournament match option for dropdown (simplified)
 */
export interface TournamentMatchOption {
  id: number;
  tournament_id: number;
  tournament_name: string;
  stage_label: string;
  player1_name: string;
  player2_name: string;
  start_date: number;
  end_date: number;
  display_label: string; // For dropdown display
}

/**
 * Get all tournament matches for the current user (simplified for dropdown)
 * Returns only necessary data for match selection
 * @returns Array of tournament match options
 */
export const getUserTournamentMatches = async (): Promise<TournamentMatchOption[]> => {
  try {
    const myTournamentsResponse = await getMyTournaments(1, 100);
    const tournaments = myTournamentsResponse.tournaments;

    if (!tournaments || tournaments.length === 0) {
      return [];
    }

    const allMatches: TournamentMatchOption[] = [];

    for (const tournament of tournaments) {
      try {
        const stagesResponse = await getTournamentStages(tournament.id);
        const stages = stagesResponse.stages || [];

        for (const stage of stages) {
          try {
            const matchesResponse = await getStageMatches(tournament.id, stage.type);
            const matches = matchesResponse.matches || [];

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
          } catch (err) {
            console.error(`Error fetching matches for tournament ${tournament.id}, stage ${stage.type}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error fetching stages for tournament ${tournament.id}:`, err);
      }
    }

    return allMatches.sort((a, b) => a.start_date - b.start_date);
  } catch (err) {
    console.error('Error fetching user tournament matches:', err);
    throw err;
  }
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
