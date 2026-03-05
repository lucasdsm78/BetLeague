// services/api/leagues.ts
// API module: leagues (network + DTO typing)

import http, { type ApiResponse } from '../http';
import { mapLeaguesPage, type LeaguesPage } from '../mappers/leaguesPagingMapper';
import type {
  ApiLeaguesPage,
  ApiLeagueCreateRequest,
  ApiLeagueMessageResponse,
  ApiLeagueRankingRow,
  ApiLeagueBalancesBulkResponse,
  ApiLeagueBalanceResponse,
  ApiParticipatedLeaguesResponse,
  ApiLeagueUpdateRequest,
  ApiLeagueUpdateResponse,
  ApiLeagueNameAvailabilityResponse,
  ApiLeagueLeaveResponse,
  ApiLeagueJoinResponse,
} from '../../types/api';

// Compat API légère (utilisée dans quelques endroits)
export type LeagueSummaryApi = { id: number; name: string; start_date?: number; is_started?: boolean; nb_players_remaining?: number };

export async function createLeague(payload: ApiLeagueCreateRequest): Promise<ApiLeagueMessageResponse> {
  const res: ApiResponse<ApiLeagueMessageResponse> = await http.post('/league/create', payload);
  if (!res.success) throw new Error(res.error || 'Erreur lors de la création de la ligue');
  return res.data as ApiLeagueMessageResponse;
}

export async function getAvailableLeaguesPage(page = 1, pageSize = 10): Promise<LeaguesPage> {
  const res: ApiResponse<ApiLeaguesPage> = await http.get('/leagues', {
    // `secureApiClient` ne gère pas `params` nativement: ce champ est ignoré.
    // On encode explicitement dans l'URL.
  });

  // fallback: URL avec query
  if (!res.success) {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    const res2: ApiResponse<ApiLeaguesPage> = await http.get(`/leagues?${query.toString()}`);
    if (!res2.success) throw new Error(res2.error || 'Erreur lors du chargement des ligues disponibles');
    return mapLeaguesPage(res2.data as ApiLeaguesPage);
  }

  // si le back ignore la pagination, on mappe quand même
  return mapLeaguesPage(res.data as ApiLeaguesPage);
}

export async function getCreatedLeaguesPage(page = 1, pageSize = 10): Promise<LeaguesPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<ApiLeaguesPage> = await http.get(`/leagues/created?${query.toString()}`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des ligues créées');
  return mapLeaguesPage(res.data as ApiLeaguesPage);
}

export async function getParticipatedLeaguesPage(page = 1, pageSize = 10): Promise<LeaguesPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const res: ApiResponse<ApiLeaguesPage> = await http.get(`/leagues/participated?${query.toString()}`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des ligues rejointes');
  return mapLeaguesPage(res.data as ApiLeaguesPage);
}

export async function joinLeague(leagueId: number): Promise<ApiLeagueMessageResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueMessageResponse> = await http.post(`/league/${leagueId}/join`);
  if (!res.success) throw new Error(res.error || 'Erreur lors de la tentative de rejoindre la ligue');
  return (res.data ?? {}) as ApiLeagueMessageResponse;
}

export async function leaveLeague(leagueId: number): Promise<ApiLeagueLeaveResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueLeaveResponse> = await http.delete(`/league/${leagueId}/player/delete`);
  if (!res.success) throw new Error(res.error || 'Erreur lors de la désinscription de la ligue');
  return (res.data ?? { message: '' }) as ApiLeagueLeaveResponse;
}

export async function getLeagueRanking(leagueId: number): Promise<ApiLeagueRankingRow[]> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueRankingRow[]> = await http.get(`/league/${leagueId}/rank`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement du classement');
  if (!Array.isArray(res.data)) throw new Error('Format de réponse invalide');
  return res.data as ApiLeagueRankingRow[];
}

export async function getLeaguesBalancesBulk(leagueIds: number[]): Promise<ApiLeagueBalancesBulkResponse> {
  const ids = Array.from(new Set(leagueIds)).filter((id) => Number.isInteger(id) && id > 0);
  const res: ApiResponse<ApiLeagueBalancesBulkResponse> = await http.post('/leagues/balances', { league_ids: ids });
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des soldes (bulk)');
  return (res.data ?? { balances: {}, not_found: [], forbidden: [] }) as ApiLeagueBalancesBulkResponse;
}

export async function getLeagueBalanceResponse(leagueId: number): Promise<ApiLeagueBalanceResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<ApiLeagueBalanceResponse> = await http.get(`/league/${leagueId}/balance`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement du solde de la ligue');
  return { nb_btl: Number((res.data as any)?.nb_btl) || 0 };
}

// Compat: la plupart des composants attendent un number.
export async function getLeagueBalance(leagueId: number): Promise<number> {
  const dto = await getLeagueBalanceResponse(leagueId);
  return dto.nb_btl;
}

export async function getLeagueDetails(leagueId: number): Promise<any> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  const res: ApiResponse<any> = await http.get(`/league/${leagueId}`);
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des détails de la ligue');
  return res.data;
}

export async function inviteUserToLeague(leagueId: number, userId: number): Promise<ApiLeagueMessageResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("ID d'utilisateur invalide");

  const res: ApiResponse<ApiLeagueMessageResponse> = await http.post(`/league/${leagueId}/${userId}/invite`);
  if (!res.success) throw new Error(res.error || "Erreur lors de l'invitation de l'utilisateur");
  return (res.data ?? {}) as ApiLeagueMessageResponse;
}

// Fonctions API "lite" existantes
export async function getParticipatedLeagues(): Promise<LeagueSummaryApi[]> {
  const res: ApiResponse<any> = await http.get('/leagues/participated');
  if (!res.success) {
    throw new Error(res.error || 'Impossible de récupérer les ligues');
  }

  const data: any = res.data ?? {};

  // 1) Nouveau format (paginé) : { leagues: [...], total_count, page, page_size }
  if (Array.isArray(data?.leagues)) {
    return data.leagues as LeagueSummaryApi[];
  }

  // 2) Format alternatif rencontré : { items: [...] }
  if (Array.isArray(data?.items)) {
    return data.items as LeagueSummaryApi[];
  }

  // 3) Legacy: backend renvoyait parfois directement un array
  if (Array.isArray(data)) {
    return data as LeagueSummaryApi[];
  }

  return [];
}

export async function getLeagueBalanceAmount(leagueId: number): Promise<number> {
  return getLeagueBalance(leagueId);
}

export function validateLeagueUpdateData(data: ApiLeagueUpdateRequest): void {
  const name = String((data as any)?.name ?? '').trim();
  if (!name) throw new Error('Le nom de la ligue est requis');
  if (name.length < 3) throw new Error('Le nom doit contenir au moins 3 caractères');
  if (name.length > 50) throw new Error('Le nom ne peut pas dépasser 50 caractères');
  if (!/^[A-Za-z0-9\s\-_.]+$/.test(name)) {
    throw new Error(
      'Le nom contient des caractères non autorisés. Utilisez uniquement lettres, chiffres, espaces, tirets, underscores et points.'
    );
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

export async function updateLeague(leagueId: number, data: ApiLeagueUpdateRequest): Promise<ApiLeagueUpdateResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');
  // validation conservée (UI locale)
  validateLeagueUpdateData(data);

  const response: ApiResponse<ApiLeagueUpdateResponse> = await http.put(`/league/${leagueId}`, data);

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

  return response.data as ApiLeagueUpdateResponse;
}

export async function checkLeagueNameAvailability(name: string): Promise<boolean> {
  try {
    const response: ApiResponse<ApiLeagueNameAvailabilityResponse> = await http.get(
      `/league/check-name?name=${encodeURIComponent(name)}`
    );

    if (!response.success) return true;
    return response.data?.available ?? true;
  } catch {
    return true;
  }
}

export async function getMyLeagues(): Promise<LeagueSummaryApi[]> {
  // Nouveau endpoint performant (1 seule requête)
  try {
    const query = new URLSearchParams({ page: '1', page_size: '50' });
    const res: ApiResponse<any> = await http.get(`/leagues/mine?${query.toString()}`);
    if (res.success) {
      const data: any = res.data ?? {};
      const leagues = (Array.isArray(data?.leagues) ? data.leagues : Array.isArray(data?.items) ? data.items : []) as any[];
      return leagues
        .filter((l) => l && typeof l.id === 'number')
        .map((l) => ({ id: Number(l.id), name: String(l.name ?? '') }))
        .filter((l) => !!l.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    // fallback plus bas
  }

  // Fallback compat: 2 requêtes
  const [createdPage, participatedPage] = await Promise.all([
    getCreatedLeaguesPage(1, 50),
    getParticipatedLeaguesPage(1, 50),
  ]);

  const created = (createdPage.leagues ?? []).map((l) => ({ id: l.id, name: l.name })) as LeagueSummaryApi[];
  const participated = (participatedPage.leagues ?? []).map((l) => ({ id: l.id, name: l.name })) as LeagueSummaryApi[];

  const map = new Map<number, LeagueSummaryApi>();
  for (const l of [...created, ...participated]) {
    if (!l || typeof l.id !== 'number') continue;
    if (!map.has(l.id)) map.set(l.id, l);
  }

  return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
