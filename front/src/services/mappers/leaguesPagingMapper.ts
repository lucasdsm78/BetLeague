import type { LeagueSummary } from '../../types/entities/league';
import type { ApiLeaguesPage, ApiLeagueSummary } from '../../types/api/leagues';
import { mapApiLeagueSummaryToUi } from './leagueMapper';

export interface LeaguesPage {
  leagues: LeagueSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/**
 * Mapper de pagination (API -> UI)
 */
export function mapLeaguesPage(api: ApiLeaguesPage): LeaguesPage {
  const leagues: LeagueSummary[] = (api.items ?? []).map((l: ApiLeagueSummary) => mapApiLeagueSummaryToUi(l));

  const page = Number(api.page) || 1;
  const pageSize = Number(api.page_size) || leagues.length || 10;
  const total = Number(api.total) || 0;
  const hasMore = page * pageSize < total;

  return {
    leagues,
    page,
    pageSize,
    total,
    hasMore,
  };
}
