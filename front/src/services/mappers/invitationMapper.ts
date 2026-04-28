import type {
  ApiInvitationReceivedItem,
  ApiInvitationLeagueSummary,
  ApiInvitationTournamentSummary,
} from '../../types/api/invitations';
import type {
  InvitationLeagueSummary,
  InvitationReceivedReadModel,
  InvitationTournamentSummary,
} from '../../types/entities/invitation';
import { createLogger } from '../../utils/logger';

const logger = createLogger('invitationMapper');

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Champ numérique invalide');
  }
  return value;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Champ string invalide');
  }
  return value;
}

function mapApiLeagueSummaryToUi(api: ApiInvitationLeagueSummary): InvitationLeagueSummary {
  return {
    id: asNumber(api.id),
    name: asString(api.name),
    max_players: asNumber(api.max_players),
    start_date: api.start_date ?? undefined,
    user_creator: api.user_creator
      ? { id: asNumber(api.user_creator.id), pseudo: asString(api.user_creator.pseudo) }
      : undefined,
    nb_players_remaining: typeof api.nb_players_remaining === 'number' ? api.nb_players_remaining : undefined,
    is_started: typeof api.is_started === 'boolean' ? api.is_started : undefined,
  };
}

function mapApiTournamentSummaryToUi(api: ApiInvitationTournamentSummary): InvitationTournamentSummary {
  return {
    id: asNumber(api.id),
    name: asString(api.name),
    max_players: asNumber(api.max_players),
    current_players: asNumber(api.current_players),
    start_date: api.start_date ?? undefined,
    end_date: api.end_date ?? undefined,
    user_creator: api.user_creator
      ? { id: asNumber(api.user_creator.id), pseudo: asString(api.user_creator.pseudo) }
      : undefined,
    is_private: typeof api.is_private === 'boolean' ? api.is_private : undefined,
    status: typeof api.status === 'string' ? api.status : undefined,
  };
}

/**
 * Mapper "hard" (strict) : valide le shape minimal attendu côté UI.
 */
export function mapApiInvitationToUi(api: ApiInvitationReceivedItem): InvitationReceivedReadModel {
  if (!isObject(api)) {
    throw new Error('Invitation API invalide');
  }

  const raw = api as any;
  const type = asString(raw.type) as InvitationReceivedReadModel['type'];
  const league = raw?.league;
  const tournament = raw?.tournament;

  if (type === 'league') {
    if (!isObject(league)) {
      throw new Error('Invitation API invalide: league manquant');
    }

    return {
      id: asNumber(raw.id),
      type,
      league: mapApiLeagueSummaryToUi(league as unknown as ApiInvitationLeagueSummary),
      status: asString(raw.status),
    };
  }
  if (type === 'tournament') {
    if (!isObject(tournament)) {
      throw new Error('Invitation API invalide: tournament manquant');
    }

    return {
      id: asNumber(raw.id),
      type,
      tournament: mapApiTournamentSummaryToUi(tournament as unknown as ApiInvitationTournamentSummary),
      status: asString(raw.status),
    };
  }

  throw new Error('Invitation API invalide: type inconnu');
}

/**
 * Variante tolérante : ne lève pas, renvoie null si invalide.
 */
export function tryMapApiInvitationToUi(api: unknown): InvitationReceivedReadModel | null {
  try {
    return mapApiInvitationToUi(api as ApiInvitationReceivedItem);
  } catch (e: any) {
    if (process.env.NODE_ENV === 'development') {
      const maybeId = (api as any)?.id;
      logger.debug('map drop', { id: typeof maybeId === 'number' ? maybeId : undefined, error: e?.message ?? String(e) });
    }
    return null;
  }
}
