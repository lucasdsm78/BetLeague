import type { LeagueSummary } from 'types/entities/league';
import { mapApiLeagueSummaryToUi } from './mappers/leagueMapper';

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

export function mapLeaguesPage(api: LeaguesPageApi): LeaguesPage {
  const leagues: LeagueSummary[] = (api.leagues ?? []).map((l) => mapApiLeagueSummaryToUi(l as any));

  return {
    leagues,
    page: Number((api as any).page ?? 1),
    pageSize: Number((api as any).page_size ?? 10),
    total: Number((api as any).total ?? leagues.length),
    totalPages: Number((api as any).total_pages ?? 1),
  };
}
