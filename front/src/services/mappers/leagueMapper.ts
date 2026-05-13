import type { ApiLeagueSummary } from '../../types/api/leagues';
import type { LeagueSummary } from '../../types/entities/league';

function toEpochMs(ts: number | string | null | undefined): number | null {
  if (ts === null || ts === undefined) return null;
  const n = typeof ts === 'string' ? Number(ts) : ts;
  if (!Number.isFinite(n)) return null;
  // < 10^12 means seconds, convert to ms
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

export function mapApiLeagueSummaryToUi(api: ApiLeagueSummary): LeagueSummary {
  const startMs = toEpochMs((api as any).start_date);

  return {
    id: Number((api as any).id),
    name: String((api as any).name ?? ''),
    startDate: startMs ? new Date(startMs).toISOString() : new Date().toISOString(),
    status: (api as any).status,
    isStarted: Boolean((api as any).is_started ?? (api as any).isStarted ?? false),
    maxPlayers:
      typeof (api as any).max_players === 'number'
        ? (api as any).max_players
        : typeof (api as any).maxPlayers === 'number'
          ? (api as any).maxPlayers
          : undefined,
    minPlayers:
      typeof (api as any).min_players === 'number'
        ? (api as any).min_players
        : typeof (api as any).minPlayers === 'number'
          ? (api as any).minPlayers
          : undefined,
    playersRemaining:
      typeof (api as any).nb_players_remaining === 'number'
        ? (api as any).nb_players_remaining
        : typeof (api as any).playersRemaining === 'number'
          ? (api as any).playersRemaining
          : undefined,
    currentPlayersCount:
      typeof (api as any).current_players_count === 'number'
        ? Math.max(0, (api as any).current_players_count)
        : typeof (api as any).currentPlayersCount === 'number'
          ? Math.max(0, (api as any).currentPlayersCount)
          : undefined,
    isFree:
      typeof (api as any).is_free === 'boolean'
        ? (api as any).is_free
        : typeof (api as any).isFree === 'boolean'
          ? (api as any).isFree
          : undefined,
    nbBtl:
      typeof (api as any).nb_btl === 'number' && (api as any).nb_btl > 0
        ? (api as any).nb_btl
        : typeof (api as any).nbBtl === 'number' && (api as any).nbBtl > 0
          ? (api as any).nbBtl
          : undefined,
    currentTotalPot:
      typeof (api as any).current_total_pot === 'number' && Number.isFinite((api as any).current_total_pot)
        ? Math.max(0, (api as any).current_total_pot)
        : (api as any).current_total_pot === null
          ? null
        : typeof (api as any).currentTotalPot === 'number' && Number.isFinite((api as any).currentTotalPot)
          ? Math.max(0, (api as any).currentTotalPot)
          : (api as any).currentTotalPot === null
            ? null
            : undefined,
    userCreator:
      (api as any).user_creator && typeof (api as any).user_creator.id === 'number'
        ? {
            id: Number((api as any).user_creator.id),
            pseudo: String((api as any).user_creator.pseudo ?? ''),
          }
        : (api as any).userCreator && typeof (api as any).userCreator.id === 'number'
          ? {
              id: Number((api as any).userCreator.id),
              pseudo: String((api as any).userCreator.pseudo ?? ''),
            }
          : undefined,
  };
}

