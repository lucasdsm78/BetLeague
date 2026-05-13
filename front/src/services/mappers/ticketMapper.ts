import type {
  ApiMatchChoiceSummary,
  ApiMatchSummary,
  ApiSharedTicketReadModel,
  ApiTicketReadModel,
  ApiTournamentMatchSummary,
} from '../../types/api/tickets';
import type { ApiLeagueSummary } from '../../types/api/leagues';
import type {
  TicketLeagueSummary,
  MatchChoiceSummary,
  MatchSummary,
  TicketReadModel,
  MatchOddSummary,
  SharedTicketReadModel,
  TournamentMatchSummary,
} from '../../types/entities/ticket';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ticketMapper');

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

function asChoiceLabel(value: unknown): string {
  // Le back renvoie généralement match_odds.value (ex: "Draw/Away", "Over 2.5", "Home/Draw").
  // On accepte aussi des valeurs simples (1/N/2, home/draw/away) pour compat.
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function mapApiMatchSummaryToUi(api: ApiMatchSummary): MatchSummary {
  return {
    id: asNumber(api.id),
    home_team: asString(api.home_team),
    away_team: asString(api.away_team),
    time: asString(api.time),
    winner: api.winner ?? null,
  };
}

function mapApiMatchChoiceSummaryToUi(api: ApiMatchChoiceSummary): MatchChoiceSummary {
  const raw = api as any;
  const rawOddSummary = raw?.match_odd_summary;

  const matchOddSummary: MatchOddSummary | null | undefined =
    rawOddSummary && typeof rawOddSummary === 'object'
      ? {
          bet_type: asString((rawOddSummary as any).bet_type),
          bet_name: asString((rawOddSummary as any).bet_name),
        }
      : null;

  return {
    id: asNumber(api.id),
    match_summary: mapApiMatchSummaryToUi(api.match_summary),
    choice: asChoiceLabel(raw.choice),
    status: asString(raw.status),
    match_odd_summary: matchOddSummary,
  };
}

function mapApiLeagueSummaryToUi(api: ApiLeagueSummary): TicketLeagueSummary {
  return {
    id: asNumber(api.id),
    name: asString(api.name),
  };
}

function mapApiTournamentMatchSummaryToUi(api: ApiTournamentMatchSummary): TournamentMatchSummary {
  return {
    tournament_match_id: asNumber(api.tournament_match_id),
    tournament_id: asNumber(api.tournament_id),
    name: api.name == null ? null : asString(api.name),
    stage_id: asNumber(api.stage_id),
    type: asString(api.type),
  };
}

function asNumberOrZero(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  // back peut envoyer int sous forme string dans certains cas
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  throw new Error('Champ numérique invalide');
}

function asStringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Mapper "hard" (strict) : valide le shape minimal attendu côté UI.
 * Objectif: éviter que des payloads API inattendus cassent silencieusement l'UI.
 */
export function mapApiTicketToUi(api: ApiTicketReadModel): TicketReadModel {
  if (!isObject(api)) {
    throw new Error('Ticket API invalide');
  }

  const leagueSummary = (api as any).league_summary;
  const tournamentMatchSummary = (api as any).tournament_match_summary;
  const matchChoices = (api as any).match_choice_summaries;

  if (!Array.isArray(matchChoices)) {
    throw new Error('Ticket API invalide: match_choice_summaries manquant');
  }

  return {
    id: asNumber((api as any).id),
    display_number: asNumber((api as any).display_number),
    mise: asNumberOrZero((api as any).mise),
    uuid: asStringOrEmpty((api as any).uuid),
    gain: asNumberOrZero((api as any).gain),
    status: asStringOrEmpty((api as any).status),
    league_summary: leagueSummary ? mapApiLeagueSummaryToUi(leagueSummary as ApiLeagueSummary) : null,
    tournament_match_summary: tournamentMatchSummary ? mapApiTournamentMatchSummaryToUi(tournamentMatchSummary as ApiTournamentMatchSummary) : null,
    match_choice_summaries: matchChoices.map((c: any) => mapApiMatchChoiceSummaryToUi(c as ApiMatchChoiceSummary)),
  };
}

export function mapApiSharedTicketToUi(api: ApiSharedTicketReadModel): SharedTicketReadModel {
  if (!isObject(api)) {
    throw new Error('Ticket partagé API invalide');
  }

  const leagueSummary = (api as any).league_summary;
  const tournamentMatchSummary = (api as any).tournament_match_summary;
  const matchChoices = (api as any).match_choice_summaries;

  if (!Array.isArray(matchChoices)) {
    throw new Error('Ticket partagé API invalide: match_choice_summaries manquant');
  }

  return {
    uuid: asStringOrEmpty((api as any).uuid),
    mise: asNumberOrZero((api as any).mise),
    gain: asNumberOrZero((api as any).gain),
    status: asStringOrEmpty((api as any).status),
    league_summary: leagueSummary ? mapApiLeagueSummaryToUi(leagueSummary as ApiLeagueSummary) : null,
    tournament_match_summary: tournamentMatchSummary ? mapApiTournamentMatchSummaryToUi(tournamentMatchSummary as ApiTournamentMatchSummary) : null,
    match_choice_summaries: matchChoices.map((c: any) => mapApiMatchChoiceSummaryToUi(c as ApiMatchChoiceSummary)),
  };
}

/**
 * Variante tolérante : ne lève pas, renvoie null si invalide.
 * Utile pour éviter un crash d'écran si le back change.
 */
export function tryMapApiTicketToUi(api: unknown): TicketReadModel | null {
  try {
    return mapApiTicketToUi(api as ApiTicketReadModel);
  } catch (e: any) {
    if (process.env.NODE_ENV === 'development') {
      // Log sans payload complet (évite PII). On log uniquement le message d'erreur et l'id si accessible.
      const maybeId = (api as any)?.id;
      logger.debug('map drop', { id: typeof maybeId === 'number' ? maybeId : undefined, error: e?.message ?? String(e) });
    }
    return null;
  }
}
