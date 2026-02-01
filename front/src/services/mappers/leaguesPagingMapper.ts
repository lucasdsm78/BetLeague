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
  const anyApi: any = api as any;

  // Backend actuel: { leagues: [...] }
  // Ancien/compat: { items: [...] }
  const rawLeagues = (anyApi.leagues ?? anyApi.items ?? []) as ApiLeagueSummary[];
  const leagues: LeagueSummary[] = rawLeagues.map((l: ApiLeagueSummary) => mapApiLeagueSummaryToUi(l));

  const page = Number(anyApi.page) || 1;
  const pageSize = Number(anyApi.page_size ?? anyApi.pageSize) || leagues.length || 10;
  const total = Number(anyApi.total_count ?? anyApi.total ?? anyApi.totalCount) || 0;
  const hasMore = page * pageSize < total;

  return {
    leagues,
    page,
    pageSize,
    total,
    hasMore,
  };
}
