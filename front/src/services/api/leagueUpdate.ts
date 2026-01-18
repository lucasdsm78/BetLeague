// services/api/leagueUpdate.ts
// API module: league update

import http, { type ApiResponse } from '../http';

export interface UpdateLeagueData {
  name: string;
  max_players: number;
  start_date: number; // timestamp ms
}

export interface UpdateLeagueResponse {
  message: string;
  league?: {
    id: number;
    name: string;
    max_players: number;
    is_private: boolean;
    is_free: boolean;
    nb_btl?: number;
    start_date: number;
    is_started: boolean;
  };
}

export function validateLeagueUpdateData(data: UpdateLeagueData): void {
  const name = String(data.name ?? '').trim();
  if (!name) throw new Error('Le nom de la ligue est requis');
  if (name.length < 3) throw new Error('Le nom doit contenir au moins 3 caractères');
  if (name.length > 50) throw new Error('Le nom ne peut pas dépasser 50 caractères');
  if (!/^[A-Za-z0-9\s\-_.]+$/.test(name)) {
    throw new Error('Le nom contient des caractères non autorisés. Utilisez uniquement lettres, chiffres, espaces, tirets, underscores et points.');
  }

  if (!Number.isInteger(data.max_players) || data.max_players < 2) {
    throw new Error('Le nombre minimum de participants est 2');
  }
  if (data.max_players > 200) {
    throw new Error('Le nombre maximum de participants est 200');
  }

  if (!Number.isInteger(data.start_date) || data.start_date < 1_000_000_000_000) {
    throw new Error('La date de début doit être un timestamp en millisecondes');
  }
}

export async function updateLeague(leagueId: number, data: UpdateLeagueData): Promise<UpdateLeagueResponse> {
  validateLeagueUpdateData(data);

  const response: ApiResponse<UpdateLeagueResponse> = await http.put(`/league/${leagueId}`, data);

  if (!response.success) {
    let errorMessage = 'Échec de la mise à jour de la ligue';
    const err: any = response.error;

    if (err) {
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (Array.isArray(err)) {
        errorMessage = err
          .map((e: any) => {
            if (typeof e === 'string') return e;
            if (e?.msg) {
              const field = e?.loc ? e.loc.join('.') : '';
              return field ? `${field}: ${e.msg}` : e.msg;
            }
            if (e?.message) return e.message;
            return JSON.stringify(e);
          })
          .join(', ');
      } else if (typeof err === 'object') {
        errorMessage = err.message || err.detail || JSON.stringify(err);
      }
    }

    throw new Error(errorMessage);
  }

  return response.data as UpdateLeagueResponse;
}

export async function checkLeagueNameAvailability(name: string): Promise<boolean> {
  try {
    const response: ApiResponse<{ available: boolean }> = await http.get(
      `/league/check-name?name=${encodeURIComponent(name)}`
    );

    if (!response.success) return true;
    return response.data?.available ?? true;
  } catch {
    return true;
  }
}

