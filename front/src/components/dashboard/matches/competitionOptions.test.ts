import { COMPETITIONS, getCompetitionLeagueId, normalizeCompetitionLabel } from './competitionOptions';

describe('competitionOptions', () => {
  it('inclut la Ligue des champions et la Coupe du monde 2026 dans les filtres', () => {
    expect(COMPETITIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'Ligue des champions', label: 'Ligue des champions' }),
        expect.objectContaining({ value: 'Coupe du monde 2026', label: 'Coupe du monde 2026' }),
      ]),
    );
  });

  it('mappe les compétitions filtrées côté API vers leur league_id', () => {
    expect(getCompetitionLeagueId('Ligue des champions')).toBe(2);
    expect(getCompetitionLeagueId('Coupe du monde 2026')).toBe(1);
    expect(getCompetitionLeagueId('Premier League')).toBeUndefined();
  });

  it('normalise les noms API-Sports vers les libellés UI attendus', () => {
    expect(normalizeCompetitionLabel('UEFA Champions League')).toBe('Ligue des champions');
    expect(normalizeCompetitionLabel('Champions League')).toBe('Ligue des champions');
    expect(normalizeCompetitionLabel('World Cup', { leagueId: 1, season: 2026 })).toBe('Coupe du monde 2026');
    expect(normalizeCompetitionLabel('World Cup', { leagueId: 1 })).toBe('Coupe du monde');
    expect(normalizeCompetitionLabel('World Cup')).toBe('World Cup');
    expect(normalizeCompetitionLabel('Premier League')).toBe('Premier League');
    expect(normalizeCompetitionLabel('')).toBe('Tous');
    expect(normalizeCompetitionLabel(null)).toBe('Tous');
  });
});



