import type {
  ApiMatchChoiceSummary,
  ApiMatchSummary,
  ApiTicketReadModel,
} from '../../types/api/tickets';
import type { ApiLeagueSummary } from '../../types/api/leagues';
import type {
  TicketLeagueSummary,
  MatchChoiceSummary,
  MatchSummary,
  TicketReadModel,
} from '../../types/entities/ticket';

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

function asChoice(value: unknown): '1' | 'N' | '2' {
  if (value === '1' || value === 'N' || value === '2') return value;
  throw new Error('Choix invalide');
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
  return {
    id: asNumber(api.id),
    match_summary: mapApiMatchSummaryToUi(api.match_summary),
    choice: asChoice((api as any).choice),
    status: asString((api as any).status),
  };
}

function mapApiLeagueSummaryToUi(api: ApiLeagueSummary): TicketLeagueSummary {
  return {
    id: asNumber(api.id),
    name: asString(api.name),
  };
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
    mise: asNumber((api as any).mise),
    uuid: asString((api as any).uuid),
    gain: asNumber((api as any).gain),
    status: asString((api as any).status),
    league_summary: leagueSummary ? mapApiLeagueSummaryToUi(leagueSummary as ApiLeagueSummary) : null,
    tournament_match_summary: tournamentMatchSummary ?? null,
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
  } catch {
    return null;
  }
}
