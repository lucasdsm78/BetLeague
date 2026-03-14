export type TicketsFilterMode = 'client' | 'server';

export type TicketsFilterModeReason = 'default' | 'threshold' | 'query_param' | 'env';

export type TicketsFilterModeState = {
  mode: TicketsFilterMode;
  reason: TicketsFilterModeReason;
};

export function parseBooleanQueryParam(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Décide si on utilise le filtrage serveur.
 * Priorité: query param > env > threshold > default.
 */
export function resolveTicketsFilterMode(args: {
  total: number | null | undefined;
  threshold: number;
  locationSearch?: string;
  envForceServer?: boolean;
}): TicketsFilterModeState {
  const { total, threshold, locationSearch, envForceServer } = args;

  const search = typeof locationSearch === 'string' ? locationSearch : (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const forceByQuery = parseBooleanQueryParam(params.get('server_filter'));

  if (forceByQuery) return { mode: 'server', reason: 'query_param' };
  if (envForceServer) return { mode: 'server', reason: 'env' };

  const n = typeof total === 'number' ? total : 0;
  if (n > threshold) return { mode: 'server', reason: 'threshold' };

  return { mode: 'client', reason: 'default' };
}

