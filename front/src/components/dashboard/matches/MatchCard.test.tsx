import React from 'react';
import { render, screen } from '@testing-library/react';

import MatchCard, { type UiMatch } from './MatchCard';

const baseMatch: UiMatch = {
  id: 1,
  homeTeam: 'Parma',
  awayTeam: 'Sassuolo',
  competition: 'Serie A',
  kickoff: '2026-05-24T15:00:00Z',
  status: 'upcoming',
  odds: {
    home: Number.NaN,
    draw: Number.NaN,
    away: Number.NaN,
  },
  oddsAll: [],
};

describe('MatchCard odds availability', () => {
  it('n’affiche pas le badge indisponible quand des marchés alternatifs existent', () => {
    render(
      <MatchCard
        match={{
          ...baseMatch,
          oddsAll: [
            {
              id: 11,
              matchOddId: 11,
              betType: 'DOUBLE_CHANCE',
              betName: 'Double chance',
              value: 'Home/Draw',
              odd: 1.42,
            },
          ],
        }}
        onAddToBet={() => {}}
      />,
    );

    expect(screen.queryByLabelText('Cotes indisponibles')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voir les autres cotes/i })).toBeInTheDocument();
  });

  it('affiche le badge indisponible quand aucun marché sélectionnable n’existe', () => {
    render(<MatchCard match={baseMatch} onAddToBet={() => {}} />);

    expect(screen.getByLabelText('Cotes indisponibles')).toBeInTheDocument();
  });
});

