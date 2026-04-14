import { mapApiLeagueSummaryToUi } from './leagueMapper';

describe('leagueMapper', () => {
  it('mappe le pot total estimé exposé par le backend', () => {
    const league = mapApiLeagueSummaryToUi({
      id: 12,
      name: 'Ligue Premium',
      max_players: 10,
      start_date: 1_710_000_000_000,
      status: 'OPEN',
      is_free: false,
      nb_btl: 10,
      nb_players_remaining: 7,
      estimated_total_pot: 30,
    });

    expect(league.estimatedTotalPot).toBe(30);
    expect(league.playersRemaining).toBe(7);
    expect(league.nbBtl).toBe(10);
    expect(league.startDate).toBe(new Date(1_710_000_000_000).toISOString());
  });

  it('protège l’UI contre une valeur négative ou invalide pour le pot estimé', () => {
    const negativePotLeague = mapApiLeagueSummaryToUi({
      id: 15,
      name: 'Ligue incohérente',
      max_players: 8,
      start_date: 1_710_000_000_000,
      estimated_total_pot: -12,
    });

    const fallbackCamelCaseLeague = mapApiLeagueSummaryToUi({
      id: 16,
      name: 'Ligue fallback',
      max_players: 8,
      start_date: 1_710_000_000_000,
      estimatedTotalPot: 42,
    } as any);

    expect(negativePotLeague.estimatedTotalPot).toBe(0);
    expect(fallbackCamelCaseLeague.estimatedTotalPot).toBe(42);
  });
});

