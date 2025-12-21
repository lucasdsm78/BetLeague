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
}

export interface Tournament {
  id: number;
  name: string;
  is_private: boolean;
  max_players: number;
  current_players: number;
  start_date?: number;
  end_date?: number;
  status: 'pending' | 'active' | 'completed';
  creator_email: string;
}

/**
 * Create a new tournament
 * @param data Tournament creation data
 * @returns Tournament creation response
 */
export const createTournament = async (
  data: TournamentCreateRequest
): Promise<TournamentCreateResponse> => {
  const response = await apiClient.post<TournamentCreateResponse>(
    '/tournament/create',
    data
  );
  return response.data as TournamentCreateResponse;
};

/**
 * Get all tournaments
 * @returns List of tournaments
 */
export const getTournaments = async (): Promise<Tournament[]> => {
  const response = await apiClient.get<{ tournaments: Tournament[] }>(
    '/tournament/list'
  );
  return (response.data as { tournaments: Tournament[] }).tournaments;
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