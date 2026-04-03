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
    playersRemaining:
      typeof (api as any).nb_players_remaining === 'number'
        ? (api as any).nb_players_remaining
        : typeof (api as any).playersRemaining === 'number'
          ? (api as any).playersRemaining
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
  };
}

