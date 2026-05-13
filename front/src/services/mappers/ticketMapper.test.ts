import { mapApiSharedTicketToUi, mapApiTicketToUi } from './ticketMapper';

describe('ticketMapper', () => {
  it('priorise et mappe correctement le résumé de tournoi avec son nom', () => {
    const ticket = mapApiTicketToUi({
      id: 42,
      display_number: 3,
      mise: 15,
      uuid: 'ticket-42',
      gain: 48.2,
      status: 'pending',
      league_summary: { id: 3, name: 'Liga Pro', max_players: 20 },
      tournament_match_summary: {
        tournament_match_id: 90,
        tournament_id: 12,
        name: 'Summer Cup',
        stage_id: 4,
        type: 'semi_final',
      },
      match_choice_summaries: [],
    });

    expect(ticket.tournament_match_summary).toEqual({
      tournament_match_id: 90,
      tournament_id: 12,
      name: 'Summer Cup',
      stage_id: 4,
      type: 'semi_final',
    });
    expect(ticket.display_number).toBe(3);
    expect(ticket.league_summary?.name).toBe('Liga Pro');
  });

  it('mappe un ticket partagé sans tournoi en conservant null', () => {
    const ticket = mapApiSharedTicketToUi({
      uuid: 'shared-1',
      mise: 10,
      gain: 28.5,
      status: 'CORRECT',
      league_summary: { id: 11, name: 'Ligue VIP', max_players: 20 },
      tournament_match_summary: null,
      match_choice_summaries: [],
    });

    expect(ticket.tournament_match_summary).toBeNull();
    expect(ticket.league_summary?.name).toBe('Ligue VIP');
  });
});


