// leaguesApi.ts - service pour ligues participées et solde BTL
import secureApiClient, { ApiResponse } from './secureApiClient';

export interface LeagueSummaryApi {
  id: number;
  name: string;
  start_date?: number;
  is_started?: boolean;
  nb_players_remaining?: number;
}

export interface ParticipatedLeaguesResponse {
  leagues: LeagueSummaryApi[];
}

export interface LeagueBalanceResponse {
  nb_btl: number;
}

export async function getParticipatedLeagues(): Promise<LeagueSummaryApi[]> {
  const res: ApiResponse<ParticipatedLeaguesResponse> = await secureApiClient.get('/leagues/participated');
  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les ligues');
  }
  return (res.data?.leagues ?? []);
}

export async function getLeagueBalance(leagueId: number): Promise<number> {
  const res: ApiResponse<LeagueBalanceResponse> = await secureApiClient.get(`/league/${leagueId}/balance`);
  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer le solde BTL');
  }
  return (res.data?.nb_btl ?? 0);
}

export default { getParticipatedLeagues, getLeagueBalance };

