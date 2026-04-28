import type { TicketReadModel } from 'types/entities/ticket';

interface TicketContextSource {
  league_summary?: TicketReadModel['league_summary'];
  tournament_match_summary?: TicketReadModel['tournament_match_summary'];
}

export function getTicketContextLabel(ticket: TicketContextSource | null | undefined): string {
  const tournamentName = ticket?.tournament_match_summary?.name?.trim();
  if (ticket?.tournament_match_summary?.tournament_id != null) {
    return `Tournoi : ${tournamentName || 'Tournoi'}`;
  }

  const leagueName = ticket?.league_summary?.name?.trim();
  return `Ligue : ${leagueName || 'Ligue'}`;
}

