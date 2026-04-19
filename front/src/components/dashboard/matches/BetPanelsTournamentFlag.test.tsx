import React from 'react';
import { render, screen } from '@testing-library/react';

import BetSidebarDesktop from './BetSidebarDesktop';
import BetDrawerMobile from './BetDrawerMobile';

const baseProps = {
  selectedBets: [],
  onRemoveBet: jest.fn(),
  onClearAll: jest.fn(),
  leagues: [],
  selectedLeagueId: null,
  onLeagueChange: jest.fn(),
  balance: null,
  tournamentMatches: [],
  selectedTournamentMatchId: '',
  onTournamentChange: jest.fn(),
  tournamentBalance: null,
  stake: '',
  onStakeChange: jest.fn(),
  onCreateTicket: jest.fn(),
  isSubmitting: false,
  error: null,
  isValid: false,
  totalOdds: 1,
  potentialWin: 0,
};

describe('ticket tournament feature flag UI', () => {
  it('masque le sélecteur tournoi sur le panneau desktop quand le flag est désactivé', () => {
    render(
      <BetSidebarDesktop
        {...baseProps}
        tournamentTicketCreationEnabled={false}
      />,
    );

    expect(screen.queryByText(/tournoi/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^ligue$/i)).toBeInTheDocument();
  });

  it('affiche le sélecteur tournoi sur le drawer mobile quand le flag est activé', () => {
    render(
      <BetDrawerMobile
        {...baseProps}
        isOpen
        onClose={jest.fn()}
        tournamentTicketCreationEnabled
      />,
    );

    expect(screen.getAllByText(/tournoi/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/choisir un match de tournoi/i)).toBeInTheDocument();
  });
});


