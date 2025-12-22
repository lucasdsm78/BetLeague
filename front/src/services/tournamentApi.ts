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