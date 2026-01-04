import type { LeagueSummary } from '../types';

export interface LeaguesPageApi {
  leagues: Array<{
    id: number;
    name: string;
    start_date?: number;
    is_started?: boolean;
    nb_players_remaining?: number;
    is_free?: boolean;
    nb_btl?: number;
  }>;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface LeaguesPage {
  leagues: LeagueSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toEpochMs(ts: number | string | null | undefined): number | null {
  if (ts === null || ts === undefined) return null;
  const n = typeof ts === 'string' ? Number(ts) : ts;
  if (!Number.isFinite(n)) return null;
  // < 10^12 means seconds, convert to ms
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

export function mapLeaguesPage(api: LeaguesPageApi): LeaguesPage {
  const leagues: LeagueSummary[] = (api.leagues ?? []).map((l) => {
    const startMs = toEpochMs(l.start_date);
    return {
      id: Number(l.id),
      name: String(l.name ?? ''),
      startDate: startMs ? new Date(startMs).toISOString() : new Date().toISOString(),
      isStarted: Boolean(l.is_started ?? false),
      playersRemaining: typeof l.nb_players_remaining === 'number' ? l.nb_players_remaining : undefined,
      isFree: typeof l.is_free === 'boolean' ? l.is_free : true,
      nbBtl: typeof l.nb_btl === 'number' && l.nb_btl > 0 ? l.nb_btl : undefined,
    } as LeagueSummary;
  });

  return {
    leagues,
    page: Number(api.page ?? 1),
    pageSize: Number(api.page_size ?? 10),
    total: Number(api.total ?? leagues.length),
    totalPages: Number(api.total_pages ?? 1),
  };
}

