// services/api/tournament.ts
// API module: tournament (network + DTO typing)

import http, { type ApiResponse } from '../http';
import { ApiClientError } from '../secureApiClient';
import type {
  TournamentCreateRequest,
  TournamentCreateResponse,
  TournamentsResponse,
  Tournament,
  TournamentStagesResponse,
  MyTournamentsResponse,
  CreatedTournamentsResponse,
  StageMatchesResponse,
  TournamentsFinishedResponse,
  TournamentMatchOption,
  TournamentStage,
  StageMatch,
} from '../../types/api/tournament';

export async function createTournament(data: TournamentCreateRequest): Promise<TournamentCreateResponse> {
  const payload: TournamentCreateRequest = {
    name: String(data.name ?? '').trim(),
    is_private: Boolean(data.is_private),
    max_players: 16,
    ...(typeof data.start_date === 'number' ? { start_date: data.start_date } : {}),
  };

  try {
    const response: ApiResponse<TournamentCreateResponse> = await http.post('/tournament/create', payload);
    return response.data as TournamentCreateResponse;
  } catch (e) {
    if (e instanceof ApiClientError) {
      if (e.status === 402) throw new Error("Vous devez être abonné à l'option tournoi pour créer un tournoi.");
      if (e.status === 409) throw new Error('Ce nom de tournoi est déjà utilisé.');
      if (e.status === 400 || e.status === 422) throw new Error('Données invalides.');
    }
    throw e;
  }
}

export async function getTournaments(page = 1, pageSize = 10): Promise<TournamentsResponse> {
  const response: ApiResponse<TournamentsResponse> = await http.get(`/tournaments?page=${page}&page_size=${pageSize}`);
  return response.data as TournamentsResponse;
}

export async function joinTournament(tournamentId: number): Promise<{ message: string }> {
  const response: ApiResponse<{ message: string }> = await http.post(`/tournament/${tournamentId}/join`);
  return response.data as { message: string };
}

export async function getTournamentDetails(tournamentId: number): Promise<Tournament> {
  const response: ApiResponse<Tournament> = await http.get(`/tournament/${tournamentId}`);
  return response.data as Tournament;
}

export async function getTournamentStages(tournamentId: number): Promise<TournamentStagesResponse> {
  const response: ApiResponse<TournamentStagesResponse> = await http.get(`/tournament/${tournamentId}/stages`);
  return response.data as TournamentStagesResponse;
}

export async function getMyTournaments(page = 1, pageSize = 10): Promise<MyTournamentsResponse> {
  const response: ApiResponse<MyTournamentsResponse> = await http.get(`/tournaments/my?page=${page}&page_size=${pageSize}`);
  return response.data as MyTournamentsResponse;
}

export async function getStageMatches(tournamentId: number, stageType: string): Promise<StageMatchesResponse> {
  const response: ApiResponse<StageMatchesResponse> = await http.get(`/tournament/${tournamentId}/stage/${stageType}/matches`);
  return response.data as StageMatchesResponse;
}

export async function getMyCreatedTournaments(page = 1, pageSize = 10): Promise<CreatedTournamentsResponse> {
  try {
    const response: ApiResponse<CreatedTournamentsResponse> = await http.get(
      `/tournaments/my/created?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`
    );
    return response.data as CreatedTournamentsResponse;
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 402) {
      throw new Error("Abonnement tournoi requis pour accéder à vos tournois créés.");
    }
    throw e;
  }
}

export async function leaveTournament(tournamentId: number): Promise<{ message: string }> {
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    throw new Error('ID de tournoi invalide');
  }

  try {
    const response: ApiResponse<{ message: string }> = await http.delete(
      `/tournament/${tournamentId}/player/me`
    );
    return (response.data ?? { message: '' }) as { message: string };
  } catch (e) {
    if (e instanceof ApiClientError) {
      if (e.status === 401) throw new Error('Le tournoi a déjà commencé ou session expirée.');
      if (e.status === 402) throw new Error('Abonnement tournoi requis.');
      if (e.status === 404) throw new Error('Tournoi ou utilisateur introuvable.');
    }
    throw e;
  }
}

export async function getFinishedTournaments(page = 1, pageSize = 10): Promise<TournamentsFinishedResponse> {
  const response: ApiResponse<TournamentsFinishedResponse> = await http.get(`/tournaments/my/finished?page=${page}&page_size=${pageSize}`);
  return response.data as TournamentsFinishedResponse;
}

function getStageLabelFromType(type: string): string {
  const labels: Record<string, string> = {
    final: 'Finale',
    semi_final: 'Demi-finale',
    quarter_final: 'Quart de finale',
    eighth_final: 'Huitième de finale',
    round_16: '1/16ème',
    group: 'Groupes',
    qualifying: 'Qualifications',
  };
  return labels[type] || type;
}

// Note: cette méthode est pratique côté UI mais peut être optimisée (batching + RQ).
export async function getUserTournamentMatches(): Promise<TournamentMatchOption[]> {
  const myTournamentsResponse = await getMyTournaments(1, 100);
  const tournaments = myTournamentsResponse.tournaments;

  if (!tournaments || tournaments.length === 0) return [];

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
}

/** Legacy helper: en attendant un vrai endpoint back, on renvoie un placeholder. */
export async function getTournamentPlayerBalance(tournamentId: number): Promise<number> {
  console.warn(`getTournamentPlayerBalance(${tournamentId}): Temporary implementation. Backend endpoint needed.`);
  return 1000;
}
