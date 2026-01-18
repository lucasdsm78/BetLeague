import type { ApiResponse } from './secureApiClient';
import {
  updateLeague as apiUpdateLeague,
  checkLeagueNameAvailability as apiCheckLeagueNameAvailability,
  validateLeagueUpdateData,
  type UpdateLeagueData,
  type UpdateLeagueResponse,
} from './api/leagueUpdate';

export type { UpdateLeagueData, UpdateLeagueResponse };

export async function updateLeague(leagueId: number, data: UpdateLeagueData): Promise<ApiResponse<UpdateLeagueResponse>> {
  // Compat: on renvoie un shape similaire à secureApiClient.ApiResponse
  try {
    validateLeagueUpdateData(data);
    const res = await apiUpdateLeague(leagueId, data);
    return { success: true, data: res, status: 200, headers: {} };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Une erreur est survenue lors de la mise à jour de la ligue', status: 500, headers: {} };
  }
}

export async function checkLeagueNameAvailability(name: string): Promise<boolean> {
  return apiCheckLeagueNameAvailability(name);
}

// Compat export (ancien singleton)
export const leagueUpdateService = {
  updateLeague,
  checkLeagueNameAvailability,
};

export default leagueUpdateService;
