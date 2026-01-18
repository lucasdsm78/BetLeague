import { getLeagueBalanceResponse } from './api/leagues';

/**
 * Cache léger en mémoire des soldes par ligue pour l’utilisateur courant.
 * - Key: leagueId
 * - Value: nb_btl
 */
const balanceCache = new Map<number, number>();

export function clearLeagueBalanceCache(): void {
  balanceCache.clear();
}

async function fetchLeagueBalance(leagueId: number): Promise<number> {
  try {
    const dto = await getLeagueBalanceResponse(leagueId);
    const nb = Number(dto?.nb_btl);
    return Number.isFinite(nb) ? nb : 0;
  } catch {
    // Silencieux: pas bloquant pour l’UI
    return 0;
  }
}

/**
 * Récupère le solde BTL de l’utilisateur dans une ligue.
 * - Utilise un cache en mémoire pour éviter de spammer l’API.
 * - `force=true` permet de bypass le cache.
 */
export async function getLeagueBalance(leagueId: number, force = false): Promise<number> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) return 0;
  if (!force && balanceCache.has(leagueId)) return balanceCache.get(leagueId) as number;

  const nb = await fetchLeagueBalance(leagueId);
  balanceCache.set(leagueId, nb);
  return nb;
}
