import { getTicketContextLabel } from './ticketContext';

describe('getTicketContextLabel', () => {
  it('retourne le label tournoi si le ticket a un tournament_id', () => {
    expect(getTicketContextLabel({
      league_summary: { id: 3, name: 'Liga Pro' },
      tournament_match_summary: {
        tournament_match_id: 90,
        tournament_id: 12,
        name: 'Summer Cup',
        stage_id: 4,
        type: 'semi_final',
      },
    })).toBe('Tournoi : Summer Cup');
  });

  it('retourne le label ligue si le ticket n’a pas de tournoi', () => {
    expect(getTicketContextLabel({
      league_summary: { id: 11, name: 'Ligue VIP' },
      tournament_match_summary: null,
    })).toBe('Ligue : Ligue VIP');
  });

  it('gère les valeurs manquantes sans casser le rendu', () => {
    expect(getTicketContextLabel({
      league_summary: null,
      tournament_match_summary: {
        tournament_match_id: 90,
        tournament_id: 12,
        name: '   ',
        stage_id: 4,
        type: 'semi_final',
      },
    })).toBe('Tournoi : Tournoi');

    expect(getTicketContextLabel(null)).toBe('Ligue : Ligue');
  });
});

